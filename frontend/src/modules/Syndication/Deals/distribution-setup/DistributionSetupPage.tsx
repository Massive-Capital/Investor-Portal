import { ArrowLeft, Building2, CircleDollarSign } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useLocation, useNavigate, useParams } from "react-router-dom"
import { TabsScrollStrip } from "../../../../common/components/tabs-scroll-strip/TabsScrollStrip"
import { toast } from "../../../../common/components/Toast/toastStore"
import { setAppDocumentTitle } from "../../../../common/utils/appDocumentTitle"
import {
  buildDealDetailReturnSearch,
  OFFERING_DETAILS_CLASSES_RETURN,
  type DealDetailReturnState,
} from "../utils/offeringDetailsSectionNav"
import {
  fetchDistributionSetup,
  completeDistributionSetup,
  newPaymentRowId,
  saveDistributionSetup,
} from "./api/distributionSetupApi"
import { fetchDealById, fetchDealInvestors } from "../api/dealsApi"
import { allocateInvestorDistributionLines } from "../tabs/distributions/utils/investorDistributionAllocation"
import { DistributionSetupSkeleton } from "./components/DistributionSetupSkeleton"
import { DistributionSimPanel } from "./components/DistributionSimPanel"
import { WaterfallBuilder } from "./components/WaterfallBuilder"
import type {
  DistributionPaymentRow,
  DistributionSetupBundle,
  DistributionWfKind,
  DistributionWfSource,
  PriorDistributionRecord,
} from "./types/distribution-setup.types"
import { KIND_META } from "./types/distribution-setup.types"
import {
  blurFormatMoneyInput,
  parseMoneyDigits,
} from "../utils/offeringMoneyFormat"
import {
  defaultPayToForKind,
  investedCapitalFromClasses,
  periodFromFactor,
  runDistributionSim,
} from "./utils/distributionSim"
import {
  buildCashFlows,
  type HurdleCashFlow,
} from "./utils/hurdleCalculations"
import { resolveDealInvestmentDateIso } from "./utils/resolveDealInvestmentDate"
import "../../usermanagement/user_management.css"
import "../deals-list.css"
import "./distribution-setup.css"

function priorRecordsToCashFlows(
  records: PriorDistributionRecord[],
): Array<{ amount: number; date: Date }> {
  const out: Array<{ amount: number; date: Date }> = []
  for (const row of records) {
    const amount = parseMoneyDigits(row.amount)
    if (!Number.isFinite(amount) || amount === 0) continue
    const date = new Date(row.date)
    if (Number.isNaN(date.getTime())) continue
    out.push({ amount, date })
  }
  return out
}

export function DistributionSetupPage() {
  const { dealId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const returnState = location.state as DealDetailReturnState | null

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [bundle, setBundle] = useState<DistributionSetupBundle | null>(null)
  const [activeWf, setActiveWf] = useState<DistributionWfSource>("operating")
  const [addKind, setAddKind] = useState<DistributionWfKind>("LP_PREF")
  const [simCash, setSimCash] = useState(() => blurFormatMoneyInput("25000"))
  const [simPeriod, setSimPeriod] = useState("0.25")
  const [stageMet, setStageMet] = useState<Record<number, boolean>>({})
  const [dueOverrides, setDueOverrides] = useState<Record<string, number>>({})
  const [investmentDate, setInvestmentDate] = useState("")
  const [investmentDateSource, setInvestmentDateSource] = useState<
    "close" | "funded" | "none"
  >("none")

  const dealDetailPath =
    dealId != null && dealId !== ""
      ? `/deals/${encodeURIComponent(dealId)}`
      : "/deals"

  const classSetupHref = dealId
    ? `/deals/${encodeURIComponent(dealId)}/class-setup`
    : "/deals"

  const goBack = useCallback(() => {
    const qs = buildDealDetailReturnSearch({
      tab:
        returnState?.returnTab ??
        OFFERING_DETAILS_CLASSES_RETURN.returnTab ??
        "offering_details",
      offeringSection:
        returnState?.returnSection ??
        OFFERING_DETAILS_CLASSES_RETURN.returnSection,
    })
    navigate(`${dealDetailPath}${qs}`)
  }, [
    dealDetailPath,
    navigate,
    returnState?.returnSection,
    returnState?.returnTab,
  ])

  const load = useCallback(async () => {
    if (!dealId) return
    setLoading(true)
    try {
      const [next, deal, invPayload] = await Promise.all([
        fetchDistributionSetup(dealId),
        fetchDealById(dealId).catch(() => null),
        fetchDealInvestors(dealId, { lpInvestorsOnly: false }).catch(
          () => null,
        ),
      ])
      setBundle(next)
      setDueOverrides({})
      setStageMet({})

      const closeDate = deal?.closeDate ?? null
      const fromClose = resolveDealInvestmentDateIso({ closeDate })
      if (fromClose) {
        setInvestmentDate(fromClose)
        setInvestmentDateSource("close")
      } else {
        const fromFunded = resolveDealInvestmentDateIso({
          investors: invPayload?.investors ?? [],
        })
        if (fromFunded) {
          setInvestmentDate(fromFunded)
          setInvestmentDateSource("funded")
        } else {
          setInvestmentDate("")
          setInvestmentDateSource("none")
        }
      }
    } catch (err) {
      toast.error(
        "Could not load distribution setup",
        err instanceof Error ? err.message : "Try again later.",
      )
    } finally {
      setLoading(false)
    }
  }, [dealId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setAppDocumentTitle("Distribution Setup")
  }, [])

  const rows = bundle?.waterfalls[activeWf] ?? []

  function patchRows(nextRows: DistributionPaymentRow[]) {
    if (!bundle) return
    setBundle({
      ...bundle,
      waterfalls: {
        ...bundle.waterfalls,
        [activeWf]: nextRows,
      },
    })
  }

  function handleAddRow() {
    if (!bundle) return
    const row: DistributionPaymentRow = {
      id: newPaymentRowId(),
      kind: addKind,
      name: KIND_META[addKind].defaultName,
      payTo: defaultPayToForKind(addKind, bundle.classes),
      amountMode: "calc",
      inputAmount: blurFormatMoneyInput("0") || "$0",
      catchupPct: "20",
    }
    patchRows([...rows, row])
  }

  async function handleSave() {
    if (!dealId || !bundle || saving) return
    setSaving(true)
    try {
      const saved = await saveDistributionSetup(dealId, bundle.waterfalls)
      setBundle(saved)
      toast.success("Distribution setup saved")
    } catch (err) {
      toast.error(
        "Save failed",
        err instanceof Error ? err.message : "Try again.",
      )
    } finally {
      setSaving(false)
    }
  }

  const sim = useMemo(() => {
    if (!bundle) {
      return {
        flowRows: [],
        perClass: {},
        leftover: 0,
        totalPaid: 0,
        hurdleEvaluations: [],
        stageMet: {},
        period: "quarterly" as const,
        periodWindowLabel: "",
        priorCashInPeriod: 0,
      }
    }
    const invested = investedCapitalFromClasses(bundle.classes)
    const prior = priorRecordsToCashFlows(bundle.priorDistributions)
    const cashAmount = (() => {
      const n = parseMoneyDigits(simCash)
      return Number.isFinite(n) ? n : 0
    })()
    const invDate = (() => {
      if (!investmentDate || !/^\d{4}-\d{2}-\d{2}$/.test(investmentDate)) {
        return new Date()
      }
      const d = new Date(`${investmentDate}T00:00:00`)
      return Number.isNaN(d.getTime()) ? new Date() : d
    })()
    const cashFlows: HurdleCashFlow[] =
      invested > 0
        ? buildCashFlows({
            investmentAmount: invested,
            investmentDate: invDate,
            distributions: [
              ...prior,
              {
                amount: cashAmount,
                date: new Date(),
              },
            ],
          })
        : []
    const cumulativeDistributions =
      prior.reduce((s, d) => s + d.amount, 0) + cashAmount
    const asOf = new Date().toISOString().slice(0, 10)

    return runDistributionSim({
      cash: cashAmount,
      periodFactor: Number(simPeriod) || 0.25,
      rows,
      classes: bundle.classes,
      promote: bundle.promote,
      stageMetOverrides: stageMet,
      dueOverrides,
      cashFlows,
      cumulativeDistributions,
      asOfDate: asOf,
      priorDistributions: bundle.priorDistributions,
    })
  }, [
    bundle,
    simCash,
    simPeriod,
    rows,
    stageMet,
    dueOverrides,
    investmentDate,
  ])

  async function handleComplete() {
    if (!dealId || !bundle || completing) return
    const amount = parseMoneyDigits(simCash)
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error(
        "Cannot complete",
        "Enter cash available greater than $0 first.",
      )
      return
    }
    setCompleting(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const period = periodFromFactor(Number(simPeriod) || 0.25)
      let investorPayments:
        | Array<{
            investorId: string
            contactId?: string
            userEmail?: string
            investorName: string
            classId: string
            className: string
            capital: number
            percentOfClass: number
            payment: number
          }>
        | undefined
      try {
        const invPayload = await fetchDealInvestors(dealId, {
          lpInvestorsOnly: false,
        })
        const lines = allocateInvestorDistributionLines({
          investors: invPayload.investors ?? [],
          classes: bundle.classes,
          perClass: sim.perClass,
        })
        if (lines.length > 0) {
          investorPayments = lines.map((l) => ({
            investorId: l.investorId,
            ...(l.contactId ? { contactId: l.contactId } : {}),
            ...(l.userEmail ? { userEmail: l.userEmail } : {}),
            investorName: l.investorName,
            classId: l.classId,
            className: l.className,
            capital: l.capital,
            percentOfClass: l.percentOfClass,
            payment: l.payment,
          }))
        }
      } catch {
        // Backend capital-weighted fallback still runs without client lines.
      }
      const saved = await completeDistributionSetup(dealId, bundle.waterfalls, {
        source: activeWf,
        amount,
        date: today,
        period,
        name:
          activeWf === "capital"
            ? `Capital event · ${today}`
            : `Operating · ${today}`,
        ...(investorPayments ? { investorPayments } : {}),
      })
      setBundle(saved)
      toast.success(
        "Distribution completed",
        "It now appears under Prior distributions and on the Distributions tab.",
      )
    } catch (err) {
      toast.error(
        "Complete failed",
        err instanceof Error ? err.message : "Try again.",
      )
    } finally {
      setCompleting(false)
    }
  }

  if (!dealId) {
    return (
      <div className="deals_list_page deals_detail_page deals_dist_setup_page">
        <p className="deals_list_not_found">Missing deal.</p>
        <Link to="/deals" className="deals_list_inline_back">
          Back to deals
        </Link>
      </div>
    )
  }

  return (
    <div className="deals_list_page deals_detail_page deals_dist_setup_page">
      <header className="deals_list_head ds_page_header">
        <div className="deals_list_title_row">
          <button
            type="button"
            className="deals_list_back_circle"
            onClick={goBack}
            aria-label="Back to deal"
          >
            <ArrowLeft size={20} strokeWidth={2} aria-hidden />
          </button>
          <div className="ds_page_header_text">
            <h1 className="deals_list_title">Distribution Setup</h1>
            <p className="ds_page_subtitle">
              {bundle?.dealName ? `${bundle.dealName} · ` : ""}
              Step 2 of 2 — payment order and residual splits (after Class Setup)
            </p>
          </div>
        </div>
        <div className="ds_page_header_actions">
          <Link
            to={classSetupHref}
            state={returnState}
            className="um_toolbar_export_btn"
          >
            Class Setup
          </Link>
          <button
            type="button"
            className="um_btn_primary"
            disabled={loading || !bundle || saving}
            onClick={() => void handleSave()}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </header>

      {loading || !bundle ? (
        <DistributionSetupSkeleton />
      ) : (
        <div className="ds_page_body">
          <div className="um_members_tabs_outer deals_tabs_outer um_segmented_tabs_outer ds_wf_tabs_outer">
            <TabsScrollStrip scrollClassName="deals_tabs_scroll um_segmented_tabs_scroll">
              <div
                className="um_members_tabs_row deals_tabs_row um_segmented_tabs_row"
                role="tablist"
                aria-label="Waterfall type"
              >
                <button
                  type="button"
                  id="ds-wf-tab-operating"
                  role="tab"
                  aria-selected={activeWf === "operating"}
                  aria-controls="ds-wf-panel"
                  className={`um_members_tab deals_tabs_tab um_segmented_tab${
                    activeWf === "operating" ? " um_members_tab_active" : ""
                  }`}
                  onClick={() => {
                    setActiveWf("operating")
                    setDueOverrides({})
                    setStageMet({})
                  }}
                >
                  <CircleDollarSign
                    className="deals_tabs_icon um_segmented_tab_icon"
                    size={16}
                    strokeWidth={2}
                    aria-hidden
                  />
                  <span className="deals_tabs_label um_segmented_tab_label">
                    Operating
                  </span>
                </button>
                <button
                  type="button"
                  id="ds-wf-tab-capital"
                  role="tab"
                  aria-selected={activeWf === "capital"}
                  aria-controls="ds-wf-panel"
                  className={`um_members_tab deals_tabs_tab um_segmented_tab${
                    activeWf === "capital" ? " um_members_tab_active" : ""
                  }`}
                  onClick={() => {
                    setActiveWf("capital")
                    setDueOverrides({})
                    setStageMet({})
                  }}
                >
                  <Building2
                    className="deals_tabs_icon um_segmented_tab_icon"
                    size={16}
                    strokeWidth={2}
                    aria-hidden
                  />
                  <span className="deals_tabs_label um_segmented_tab_label">
                    Capital event
                  </span>
                </button>
              </div>
            </TabsScrollStrip>
          </div>

          <div id="ds-wf-panel" role="tabpanel" className="ds_layout">
            <WaterfallBuilder
              rows={rows}
              classes={bundle.classes}
              promote={bundle.promote}
              addKind={addKind}
              activeWf={activeWf}
              onAddKindChange={setAddKind}
              onAddRow={handleAddRow}
              onChangeRow={(id, next) =>
                patchRows(rows.map((r) => (r.id === id ? next : r)))
              }
              onMoveRow={(id, dir) => {
                const i = rows.findIndex((r) => r.id === id)
                if (i < 0) return
                const j = i + dir
                if (j < 0 || j >= rows.length) return
                const next = [...rows]
                const tmp = next[i]!
                next[i] = next[j]!
                next[j] = tmp
                patchRows(next)
              }}
              onDeleteRow={(id) =>
                patchRows(rows.filter((r) => r.id !== id))
              }
            />

            <DistributionSimPanel
              cash={simCash}
              periodFactor={simPeriod}
              onCashChange={setSimCash}
              onPeriodChange={setSimPeriod}
              sim={sim}
              classes={bundle.classes}
              stageMet={sim.stageMet}
              onToggleStageMet={(stage, met) =>
                setStageMet((prev) => ({ ...prev, [stage]: met }))
              }
              onDueOverride={(rowId, value) => {
                const n = parseMoneyDigits(value)
                setDueOverrides((prev) => ({
                  ...prev,
                  [rowId]: Number.isFinite(n) ? n : 0,
                }))
              }}
              rowIds={rows.map((r) => r.id)}
              investmentDate={investmentDate}
              onInvestmentDateChange={(v) => {
                setInvestmentDate(v)
                setInvestmentDateSource("none")
              }}
              investmentDateSource={investmentDateSource}
              priorDistributions={bundle.priorDistributions}
              investedCapital={investedCapitalFromClasses(bundle.classes)}
              completing={completing}
              onComplete={() => void handleComplete()}
            />
          </div>
        </div>
      )}
    </div>
  )
}
