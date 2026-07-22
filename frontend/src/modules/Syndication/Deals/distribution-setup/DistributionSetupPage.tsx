import { ArrowLeft } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useLocation, useNavigate, useParams } from "react-router-dom"
import { toast } from "../../../../common/components/Toast/toastStore"
import { setAppDocumentTitle } from "../../../../common/utils/appDocumentTitle"
import {
  buildDealDetailReturnSearch,
  OFFERING_DETAILS_CLASSES_RETURN,
  type DealDetailReturnState,
} from "../utils/offeringDetailsSectionNav"
import {
  fetchDistributionSetup,
  newPaymentRowId,
  saveDistributionSetup,
} from "./api/distributionSetupApi"
import { DistributionSetupSkeleton } from "./components/DistributionSetupSkeleton"
import { DistributionSimPanel } from "./components/DistributionSimPanel"
import { WaterfallBuilder } from "./components/WaterfallBuilder"
import type {
  DistributionPaymentRow,
  DistributionSetupBundle,
  DistributionWfKind,
  DistributionWfSource,
} from "./types/distribution-setup.types"
import { KIND_META } from "./types/distribution-setup.types"
import {
  blurFormatMoneyInput,
  parseMoneyDigits,
} from "../utils/offeringMoneyFormat"
import {
  defaultPayToForKind,
  investedCapitalFromClasses,
  runDistributionSim,
} from "./utils/distributionSim"
import {
  buildCashFlows,
  type HurdleCashFlow,
} from "./utils/hurdleCalculations"
import "../../usermanagement/user_management.css"
import "../deals-list.css"
import "./distribution-setup.css"

function parsePriorDistributions(text: string): Array<{
  amount: number
  date: Date
}> {
  const out: Array<{ amount: number; date: Date }> = []
  for (const line of text.split(/\n|;/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const [amtRaw, dateRaw] = trimmed.split(",").map((s) => s.trim())
    const amount = parseMoneyDigits(amtRaw ?? "")
    if (!Number.isFinite(amount) || amount === 0) continue
    const date = dateRaw ? new Date(dateRaw) : new Date()
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
  const [bundle, setBundle] = useState<DistributionSetupBundle | null>(null)
  const [activeWf, setActiveWf] = useState<DistributionWfSource>("operating")
  const [addKind, setAddKind] = useState<DistributionWfKind>("LP_PREF")
  const [simCash, setSimCash] = useState(() => blurFormatMoneyInput("25000"))
  const [simPeriod, setSimPeriod] = useState("0.25")
  const [stageMet, setStageMet] = useState<Record<number, boolean>>({})
  const [dueOverrides, setDueOverrides] = useState<Record<string, number>>({})
  const [investmentDate, setInvestmentDate] = useState(() => {
    const d = new Date()
    d.setFullYear(d.getFullYear() - 1)
    return d.toISOString().slice(0, 10)
  })
  const [priorDistributionsText, setPriorDistributionsText] = useState("")

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
      const next = await fetchDistributionSetup(dealId)
      setBundle(next)
      setDueOverrides({})
      setStageMet({})
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
      }
    }
    const invested = investedCapitalFromClasses(bundle.classes)
    const prior = parsePriorDistributions(priorDistributionsText)
    const cashAmount = (() => {
      const n = parseMoneyDigits(simCash)
      return Number.isFinite(n) ? n : 0
    })()
    const cashFlows: HurdleCashFlow[] =
      invested > 0
        ? buildCashFlows({
            investmentAmount: invested,
            investmentDate: new Date(investmentDate),
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
    })
  }, [
    bundle,
    simCash,
    simPeriod,
    rows,
    stageMet,
    dueOverrides,
    investmentDate,
    priorDistributionsText,
  ])

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
              Payment order and residual splits
            </p>
          </div>
        </div>
        <div className="ds_page_header_actions">
          <Link
            to={classSetupHref}
            state={returnState}
            className="ds_add_btn"
          >
            Class Setup
          </Link>
        </div>
      </header>

      {loading || !bundle ? (
        <DistributionSetupSkeleton />
      ) : (
        <div className="ds_page_body">
          <div className="ds_wf_switch" role="tablist" aria-label="Waterfall type">
            <button
              type="button"
              role="tab"
              aria-selected={activeWf === "operating"}
              className={activeWf === "operating" ? "is-active" : ""}
              onClick={() => setActiveWf("operating")}
            >
              Operating distributions
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeWf === "capital"}
              className={activeWf === "capital" ? "is-active" : ""}
              onClick={() => setActiveWf("capital")}
            >
              Capital event (sale / refi)
            </button>
          </div>

          <div className="ds_layout">
            <WaterfallBuilder
              rows={rows}
              classes={bundle.classes}
              promote={bundle.promote}
              addKind={addKind}
              saving={saving}
              onSave={() => void handleSave()}
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
              onInvestmentDateChange={setInvestmentDate}
              priorDistributionsText={priorDistributionsText}
              onPriorDistributionsTextChange={setPriorDistributionsText}
              investedCapital={investedCapitalFromClasses(bundle.classes)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
