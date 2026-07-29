import { ArrowLeft } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  DataTable,
  type DataTableColumn,
} from "../../../../../common/components/data-table/DataTable"
import { TableCompactAmountCell } from "../../../../../common/components/card-compact-amount/CardCompactAmount"
import { toast } from "../../../../../common/components/Toast"
import { setAppDocumentTitle } from "../../../../../common/utils/appDocumentTitle"
import { fetchDealInvestors } from "../../api/dealsApi"
import {
  fetchDistributionSetup,
  patchDistributionInvestorPercent,
} from "../../distribution-setup/api/distributionSetupApi"
import type {
  DistributionSetupBundle,
  PriorDistributionRecord,
} from "../../distribution-setup/types/distribution-setup.types"
import {
  factorFromPeriod,
  investedCapitalFromClasses,
  runDistributionSim,
} from "../../distribution-setup/utils/distributionSim"
import {
  buildCashFlows,
  type HurdleCashFlow,
} from "../../distribution-setup/utils/hurdleCalculations"
import type { DealInvestorRow } from "../../types/deal-investors.types"
import {
  formatCurrencyUsdTypeInput,
  formatPercentTypeInput,
  moneyAmountOnBlur,
  parseMoneyDigits,
  sanitizePercentTypingInput,
} from "../../utils/offeringMoneyFormat"
import { buildDealDetailReturnSearch } from "../../utils/offeringDetailsSectionNav"
import {
  allocateInvestorDistributionLines,
  applyPaymentEdit,
  applyPercentOfClassEdit,
  recalculatePaymentsFromPercentOfClass,
  type InvestorDistributionLine,
} from "./utils/investorDistributionAllocation"
import "../../../usermanagement/user_management.css"
import "../../deals-list.css"
import "../../distribution-setup/distribution-setup.css"
import "./distributions-tab.css"
import "./distribution-details.css"

function formatDistributionDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso || "—"
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function sourceLabel(source: string | undefined): string {
  const s = (source ?? "").trim().toLowerCase()
  if (s === "capital" || s === "capital_event") return "Capital event"
  if (s === "operating") return "Operating"
  return "—"
}

function priorRecordsToCashFlows(
  records: PriorDistributionRecord[],
): Array<{ amount: number; date: Date }> {
  const out: Array<{ amount: number; date: Date }> = []
  for (const row of records) {
    const amount = parseMoneyDigits(row.amount)
    if (!Number.isFinite(amount) || amount === 0) continue
    const date = new Date(`${row.date}T00:00:00`)
    if (Number.isNaN(date.getTime())) continue
    out.push({ amount, date })
  }
  return out
}

function blurFormatPercentClamped(raw: string): string {
  const t = sanitizePercentTypingInput(raw)
  if (!t) return ""
  const n = parseFloat(t)
  if (!Number.isFinite(n)) return ""
  return `${Math.max(0, Math.min(100, n)).toFixed(2)}%`
}

function linesFromStoredPayments(
  distribution: PriorDistributionRecord,
): InvestorDistributionLine[] | null {
  const stored = distribution.investorPayments
  if (!stored?.length) return null
  return stored.map((p) => ({
    investorId: p.investorId,
    ...(p.contactId?.trim() ? { contactId: p.contactId.trim() } : {}),
    ...(p.userEmail?.trim()
      ? { userEmail: p.userEmail.trim().toLowerCase() }
      : {}),
    investorName: p.investorName || "—",
    classId: p.classId,
    className: p.className || "—",
    capital: parseMoneyDigits(p.capital) || 0,
    percentOfClass: Number(String(p.percentOfClass).replace(/[^0-9.-]/g, "")) || 0,
    payment: parseMoneyDigits(p.payment) || 0,
  }))
}

export function DistributionDetailsPage() {
  const { dealId: dealIdParam, distributionId: distIdParam } = useParams()
  const navigate = useNavigate()
  const dealId = (dealIdParam ?? "").trim()
  const distributionId = (distIdParam ?? "").trim()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [bundle, setBundle] = useState<DistributionSetupBundle | null>(null)
  const [investors, setInvestors] = useState<DealInvestorRow[]>([])
  const [distribution, setDistribution] =
    useState<PriorDistributionRecord | null>(null)
  const [lines, setLines] = useState<InvestorDistributionLine[]>([])
  const [pctDrafts, setPctDrafts] = useState<Record<string, string>>({})
  const [paymentDrafts, setPaymentDrafts] = useState<Record<string, string>>(
    {},
  )
  const [savingInvestorId, setSavingInvestorId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const backHref = `/deals/${encodeURIComponent(dealId)}${buildDealDetailReturnSearch(
    { tab: "distributions" },
  )}`

  const load = useCallback(async () => {
    if (!dealId || !distributionId) return
    setLoading(true)
    setError(null)
    try {
      const [setup, invPack] = await Promise.all([
        fetchDistributionSetup(dealId),
        fetchDealInvestors(dealId),
      ])
      const found =
        (setup.priorDistributions ?? []).find((p) => p.id === distributionId) ??
        null
      setBundle(setup)
      setInvestors(invPack.investors ?? [])
      setDistribution(found)
      if (!found) {
        setError("That distribution was not found for this deal.")
      }
    } catch (err) {
      setBundle(null)
      setInvestors([])
      setDistribution(null)
      setError(
        err instanceof Error ? err.message : "Could not load distribution.",
      )
    } finally {
      setLoading(false)
    }
  }, [dealId, distributionId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setAppDocumentTitle("Distribution details")
  }, [])

  const classPaymentByClassId = useMemo(() => {
    if (!bundle || !distribution) return {} as Record<string, number>
    const cash = parseMoneyDigits(distribution.amount)
    if (!Number.isFinite(cash) || cash <= 0) return {}

    const source =
      (distribution.source ?? "").trim().toLowerCase() === "capital" ||
      (distribution.source ?? "").trim().toLowerCase() === "capital_event"
        ? "capital"
        : "operating"
    const rows =
      source === "capital"
        ? bundle.waterfalls.capital
        : bundle.waterfalls.operating

    const period =
      distribution.period === "monthly" ||
      distribution.period === "quarterly" ||
      distribution.period === "annual"
        ? distribution.period
        : "quarterly"
    const periodFactor = factorFromPeriod(period)

    const priorsBefore = (bundle.priorDistributions ?? []).filter(
      (p) =>
        p.id !== distribution.id &&
        (p.date < distribution.date ||
          (p.date === distribution.date && p.id < distribution.id)),
    )
    const prior = priorRecordsToCashFlows(priorsBefore)
    const invested = investedCapitalFromClasses(bundle.classes)
    const distDate = new Date(`${distribution.date}T00:00:00`)
    const cashFlows: HurdleCashFlow[] =
      invested > 0
        ? buildCashFlows({
            investmentAmount: invested,
            investmentDate: new Date(
              distDate.getFullYear() - 1,
              distDate.getMonth(),
              distDate.getDate(),
            ),
            distributions: [...prior, { amount: cash, date: distDate }],
          })
        : []
    const cumulativeDistributions =
      prior.reduce((s, d) => s + d.amount, 0) + cash

    const sim = runDistributionSim({
      cash,
      periodFactor,
      rows,
      classes: bundle.classes,
      promote: bundle.promote,
      stageMetOverrides: {},
      dueOverrides: {},
      cashFlows,
      cumulativeDistributions,
      asOfDate: distribution.date,
      priorDistributions: bundle.priorDistributions,
      excludePriorId: distribution.id,
    })
    return sim.perClass
  }, [bundle, distribution])

  const computedLines = useMemo(() => {
    if (!bundle || !distribution) return []
    const fromStored = linesFromStoredPayments(distribution)
    const base =
      fromStored?.length
        ? fromStored
        : allocateInvestorDistributionLines({
            investors,
            classes: bundle.classes,
            perClass: classPaymentByClassId,
          })
    // Prefer investor-stored distribution % when present on the roster.
    const withInvestorPct = base.map((line) => {
      const inv = investors.find(
        (i) =>
          i.id === line.investorId ||
          (line.contactId &&
            i.contactId?.trim().toLowerCase() ===
              line.contactId.trim().toLowerCase()),
      )
      const stored = inv?.percentOfClassDistributions
      if (!stored?.trim()) return line
      const n = Number(String(stored).replace(/[^0-9.-]/g, ""))
      if (!Number.isFinite(n) || n < 0) return line
      return { ...line, percentOfClass: Math.min(100, n) }
    })
    return recalculatePaymentsFromPercentOfClass(
      withInvestorPct,
      classPaymentByClassId,
    )
  }, [bundle, distribution, investors, classPaymentByClassId])

  useEffect(() => {
    setLines(computedLines)
    const pctNext: Record<string, string> = {}
    const payNext: Record<string, string> = {}
    for (const row of computedLines) {
      pctNext[row.investorId] = Number.isFinite(row.percentOfClass)
        ? `${(Math.round(row.percentOfClass * 100) / 100).toFixed(2)}%`
        : ""
      payNext[row.investorId] = Number.isFinite(row.payment)
        ? moneyAmountOnBlur(String(Math.round(row.payment * 100) / 100))
        : ""
    }
    setPctDrafts(pctNext)
    setPaymentDrafts(payNext)
  }, [computedLines])

  useEffect(() => {
    setPage(1)
  }, [lines.length])

  const pagination = useMemo(
    () => ({
      page,
      pageSize,
      totalItems: lines.length,
      onPageChange: setPage,
      onPageSizeChange: (n: number) => {
        setPageSize(n)
        setPage(1)
      },
      ariaLabel: "Distribution investors pagination",
    }),
    [page, pageSize, lines.length],
  )

  const totalPayment = useMemo(
    () => lines.reduce((s, r) => s + r.payment, 0),
    [lines],
  )

  const syncInvestorPct = useCallback(
    (investorId: string, nextPct: number) => {
      setInvestors((prev) =>
        prev.map((inv) => {
          const line = lines.find((l) => l.investorId === investorId)
          const match =
            inv.id === investorId ||
            (line?.contactId &&
              inv.contactId?.trim().toLowerCase() ===
                line.contactId.trim().toLowerCase())
          if (!match) return inv
          return {
            ...inv,
            percentOfClassDistributions: `${(Math.round(nextPct * 100) / 100).toFixed(2)}%`,
          }
        }),
      )
    },
    [lines],
  )

  const persistShare = useCallback(
    async (
      investorId: string,
      payload: { percentOfClass?: number; payment?: number },
      localLines: InvestorDistributionLine[],
    ) => {
      if (!dealId || !distributionId) return
      setSavingInvestorId(investorId)
      try {
        const saved = await patchDistributionInvestorPercent(
          dealId,
          distributionId,
          { investorId, ...payload },
        )
        setBundle(saved)
        const found =
          (saved.priorDistributions ?? []).find(
            (p) => p.id === distributionId,
          ) ?? null
        setDistribution(found)
        const updated = localLines.find((l) => l.investorId === investorId)
        if (updated) syncInvestorPct(investorId, updated.percentOfClass)
        toast.success(
          "Share updated",
          "% of class and payment stay in sync.",
        )
      } catch (err) {
        toast.error(
          "Could not save",
          err instanceof Error ? err.message : "Try again.",
        )
        void load()
      } finally {
        setSavingInvestorId(null)
      }
    },
    [dealId, distributionId, syncInvestorPct, load],
  )

  const savePercent = useCallback(
    async (investorId: string, raw: string) => {
      const t = sanitizePercentTypingInput(raw)
      const n = t ? parseFloat(t) : NaN
      if (!Number.isFinite(n)) {
        toast.error("Invalid percent", "Enter a number between 0 and 100.")
        return
      }
      const nextPct = Math.max(0, Math.min(100, n))
      const nextLines = applyPercentOfClassEdit({
        lines,
        investorId,
        nextPercent: nextPct,
        classPaymentByClassId,
      })
      setLines(nextLines)
      const updated = nextLines.find((l) => l.investorId === investorId)
      setPctDrafts((prev) => ({
        ...prev,
        [investorId]: `${(Math.round(nextPct * 100) / 100).toFixed(2)}%`,
      }))
      if (updated) {
        setPaymentDrafts((prev) => ({
          ...prev,
          [investorId]: moneyAmountOnBlur(
            String(Math.round(updated.payment * 100) / 100),
          ),
        }))
      }
      await persistShare(investorId, { percentOfClass: nextPct }, nextLines)
    },
    [lines, classPaymentByClassId, persistShare],
  )

  const savePayment = useCallback(
    async (investorId: string, raw: string) => {
      const amount = parseMoneyDigits(raw)
      if (!Number.isFinite(amount) || amount < 0) {
        toast.error("Invalid payment", "Enter a valid dollar amount.")
        return
      }
      const nextLines = applyPaymentEdit({
        lines,
        investorId,
        nextPayment: amount,
        classPaymentByClassId,
      })
      setLines(nextLines)
      const updated = nextLines.find((l) => l.investorId === investorId)
      if (updated) {
        setPctDrafts((prev) => ({
          ...prev,
          [investorId]: `${(Math.round(updated.percentOfClass * 100) / 100).toFixed(2)}%`,
        }))
        setPaymentDrafts((prev) => ({
          ...prev,
          [investorId]: moneyAmountOnBlur(
            String(Math.round(updated.payment * 100) / 100),
          ),
        }))
      }
      await persistShare(investorId, { payment: amount }, nextLines)
    },
    [lines, classPaymentByClassId, persistShare],
  )

  const columns: DataTableColumn<InvestorDistributionLine>[] = useMemo(
    () => [
      {
        id: "investor",
        header: "Investor",
        colWidth: "14rem",
        thClassName: "deal_dist_th_investor",
        tdClassName: "deal_dist_td_investor",
        sortValue: (row) => row.investorName.toLowerCase(),
        cell: (row) => (
          <span className="deal_dist_details_investor_name">
            {row.investorName}
          </span>
        ),
      },
      {
        id: "class",
        header: "Class",
        colWidth: "11rem",
        thClassName: "deal_dist_th_class",
        tdClassName: "deal_dist_td_class",
        sortValue: (row) => row.className.toLowerCase(),
        cell: (row) => (
          <span className="deal_dist_class_badge" title={row.className}>
            {row.className}
          </span>
        ),
      },
      {
        id: "capital",
        header: "Capital",
        align: "right",
        colWidth: "9.5rem",
        thClassName: "deals_th_align_right deal_dist_th_capital",
        tdClassName: "um_td_numeric deals_td_align_right deal_dist_td_capital",
        sortValue: (row) => row.capital,
        cell: (row) => <TableCompactAmountCell amount={row.capital} />,
      },
      {
        id: "pct",
        header: "% of class",
        align: "right",
        colWidth: "8.5rem",
        thClassName: "deals_th_align_right deal_dist_th_pct",
        tdClassName: "um_td_numeric deals_td_align_right deal_dist_td_pct",
        sortValue: (row) => row.percentOfClass,
        cell: (row) => (
          <input
            type="text"
            className="deal_dist_details_pct_input"
            inputMode="decimal"
            aria-label={`Percent of class for ${row.investorName}`}
            value={pctDrafts[row.investorId] ?? ""}
            disabled={savingInvestorId === row.investorId}
            placeholder="0.00%"
            onChange={(e) => {
              const next = formatPercentTypeInput(e.target.value, 100)
              setPctDrafts((prev) => ({
                ...prev,
                [row.investorId]: next,
              }))
            }}
            onBlur={(e) => {
              const formatted = blurFormatPercentClamped(e.target.value)
              setPctDrafts((prev) => ({
                ...prev,
                [row.investorId]: formatted,
              }))
              const prevN = row.percentOfClass
              const nextN = formatted
                ? parseFloat(sanitizePercentTypingInput(formatted))
                : NaN
              if (
                !Number.isFinite(nextN) ||
                Math.abs(nextN - prevN) < 0.0005
              ) {
                return
              }
              void savePercent(row.investorId, formatted)
            }}
          />
        ),
      },
      {
        id: "payment",
        header: "Payment",
        align: "right",
        colWidth: "9.5rem",
        thClassName: "deals_th_align_right deal_dist_th_payment",
        tdClassName: "um_td_numeric deals_td_align_right deal_dist_td_payment",
        sortValue: (row) => row.payment,
        cell: (row) => (
          <input
            type="text"
            className="deal_dist_details_pct_input deal_dist_details_pay_input"
            inputMode="decimal"
            aria-label={`Payment for ${row.investorName}`}
            value={paymentDrafts[row.investorId] ?? ""}
            disabled={savingInvestorId === row.investorId}
            placeholder="$0.00"
            onChange={(e) => {
              setPaymentDrafts((prev) => ({
                ...prev,
                [row.investorId]: formatCurrencyUsdTypeInput(e.target.value),
              }))
            }}
            onBlur={(e) => {
              const formatted = moneyAmountOnBlur(e.target.value)
              setPaymentDrafts((prev) => ({
                ...prev,
                [row.investorId]: formatted,
              }))
              const nextN = parseMoneyDigits(formatted)
              if (
                !Number.isFinite(nextN) ||
                Math.abs(nextN - row.payment) < 0.005
              ) {
                return
              }
              void savePayment(row.investorId, formatted)
            }}
          />
        ),
      },
    ],
    [
      pctDrafts,
      paymentDrafts,
      savingInvestorId,
      savePercent,
      savePayment,
    ],
  )

  if (!dealId || !distributionId) {
    return (
      <div className="deals_list_page deals_detail_page deals_dist_setup_page">
        <p className="deals_list_not_found">Missing deal or distribution.</p>
        <Link to="/deals" className="deals_list_inline_back">
          Back to deals
        </Link>
      </div>
    )
  }

  const title =
    distribution?.name?.trim() ||
    (distribution
      ? `Distribution · ${formatDistributionDate(distribution.date)}`
      : "Distribution details")

  return (
    <div className="deals_list_page deals_detail_page deals_dist_setup_page deal_dist_details_page">
      <header className="deals_list_head ds_page_header">
        <div className="deals_list_title_row">
          <button
            type="button"
            className="deals_list_back_circle"
            onClick={() => navigate(backHref)}
            aria-label="Back to distributions"
          >
            <ArrowLeft size={20} strokeWidth={2} aria-hidden />
          </button>
          <div className="ds_page_header_text">
            <h1 className="deals_list_title">Distribution details</h1>
            <p className="ds_page_subtitle">
              {bundle?.dealName ? `${bundle.dealName} · ` : ""}
              {title}
            </p>
          </div>
        </div>
        <div className="ds_page_header_actions">
          <Link to={backHref} className="um_toolbar_export_btn">
            Back to Distributions
          </Link>
        </div>
      </header>

      {loading ? (
        <p className="deal_dist_details_loading">Loading distribution…</p>
      ) : error && !distribution ? (
        <div className="um_panel deal_dist_details_error_panel">
          <p>{error}</p>
          <Link to={backHref} className="deals_list_inline_back">
            Back to Distributions
          </Link>
        </div>
      ) : distribution ? (
        <div className="ds_page_body deal_dist_details_body">
          <div
            className="deal_dist_summary deal_dist_details_summary"
            aria-live="polite"
          >
            <div className="deal_dist_summary_item">
              <span className="deal_dist_summary_label">Date</span>
              <span className="deal_dist_summary_value">
                {formatDistributionDate(distribution.date)}
              </span>
            </div>
            <div className="deal_dist_summary_item">
              <span className="deal_dist_summary_label">Cash distributed</span>
              <span className="deal_dist_summary_value deal_dist_summary_value_money">
                <TableCompactAmountCell amount={distribution.amount} />
              </span>
            </div>
            <div className="deal_dist_summary_item">
              <span className="deal_dist_summary_label">Waterfall</span>
              <span className="deal_dist_summary_value">
                <span className="deal_dist_wf_badge">
                  {sourceLabel(distribution.source)}
                </span>
              </span>
            </div>
            <div className="deal_dist_summary_item">
              <span className="deal_dist_summary_label">Investor payments</span>
              <span className="deal_dist_summary_value deal_dist_summary_value_money">
                <TableCompactAmountCell
                  amount={Math.round(totalPayment * 100) / 100}
                />
              </span>
            </div>
          </div>

          <div className="um_panel um_members_tab_panel deals_list_table_panel deals_list_card_surface deal_inv_table_panel deal_dist_panel">
            <div className="deal_dist_details_table_intro">
              <h2 className="deal_dist_heading">Investors</h2>
              <p className="deal_dist_lead">
                % of class and payment are linked: edit either one and the other
                updates (payment = class waterfall × % ÷ 100).
              </p>
            </div>
            <DataTable
              visualVariant="members"
              membersTableClassName="um_table_members deal_inv_table deal_dist_table deal_dist_details_table"
              columns={columns}
              rows={lines}
              getRowKey={(row) => row.investorId}
              emptyLabel="No funded investors matched to classes for this distribution."
              initialSort={{ columnId: "payment", direction: "desc" }}
              pagination={pagination}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
