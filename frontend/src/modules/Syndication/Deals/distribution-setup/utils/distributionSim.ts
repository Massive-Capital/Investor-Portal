import type {
  DistributionPaymentRow,
  DistributionSetupClass,
  DistributionSetupPromote,
  DistributionWfKind,
  PriorDistributionRecord,
} from "../types/distribution-setup.types"
import {
  calculatePeriodPreferredReturn,
  computeStageMetFromHurdles,
  periodsPerYearFromFactor,
  type HurdleCashFlow,
  type HurdleEvaluation,
  type WaterfallInput,
} from "./hurdleCalculations"
import {
  periodFromFactor,
  periodLabel,
  remainingDueAfterPriorPool,
  sumPriorCashInPeriod,
  type DistributionPeriod,
} from "./distributionPeriod"

function toNum(v: string | number | undefined): number {
  const n = Number(String(v ?? "").replace(/[$,%\s,]/g, ""))
  return Number.isFinite(n) ? n : 0
}

export function formatMoney(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`
}

export function formatPct(n: number): string {
  return `${Math.round(n * 10) / 10}%`
}

export function stageCount(promote: DistributionSetupPromote): number {
  return (promote.hurdles?.length ?? 0) + 1
}

export function equityParticipants(
  classes: DistributionSetupClass[],
): DistributionSetupClass[] {
  return classes.filter(
    (c) => c.classType === "lp" || c.classType === "gp",
  )
}

export function shareAt(
  promote: DistributionSetupPromote,
  classId: string,
  stage: number,
): number {
  return toNum(promote.shares?.[classId]?.[stage])
}

export function hurdleLabel(
  h: DistributionSetupPromote["hurdles"][number],
): string {
  return `${h.rate}% ${h.basis}`
}

/** Pref-style tiers whose period obligation is reduced by same-period prior cash. */
function isPeriodPrefKind(kind: DistributionWfKind): boolean {
  return kind === "LP_PREF" || kind === "PREF_CURRENT" || kind === "PREF_ACCRUED"
}

export function computeDue(
  row: DistributionPaymentRow,
  classes: DistributionSetupClass[],
  periodFactor: number,
  ignoreManual = false,
): number {
  if (!ignoreManual && row.amountMode === "input")
    return toNum(row.inputAmount)
  const list = row.payTo
    .map((id) => classes.find((c) => c.id === id))
    .filter((c): c is DistributionSetupClass => c != null)

  const periodsPerYear = periodsPerYearFromFactor(periodFactor)

  if (row.kind === "PREF_CURRENT")
    return list.reduce(
      (s, c) =>
        s +
        calculatePeriodPreferredReturn(
          toNum(c.actuallyFunded),
          toNum(c.prefEquity.currentRate) / 100,
          periodsPerYear,
        ),
      0,
    )
  if (row.kind === "PREF_ACCRUED")
    return list.reduce(
      (s, c) =>
        s +
        calculatePeriodPreferredReturn(
          toNum(c.actuallyFunded),
          Math.max(
            0,
            toNum(c.prefEquity.totalRate) - toNum(c.prefEquity.currentRate),
          ) / 100,
          1,
        ),
      0,
    )
  if (row.kind === "LP_PREF")
    return list.reduce((s, c) => {
      if (!c.preferredReturn.enabled) return s
      return (
        s +
        calculatePeriodPreferredReturn(
          toNum(c.actuallyFunded),
          toNum(c.preferredReturn.rate) / 100,
          periodsPerYear,
        )
      )
    }, 0)
  if (row.kind === "ROC")
    return list.reduce((s, c) => s + toNum(c.actuallyFunded), 0)
  return 0
}

function classDueShare(
  row: DistributionPaymentRow,
  c: DistributionSetupClass,
  periodsPerYear: number,
): number {
  if (row.kind === "PREF_CURRENT")
    return calculatePeriodPreferredReturn(
      toNum(c.actuallyFunded),
      toNum(c.prefEquity.currentRate) / 100,
      periodsPerYear,
    )
  if (row.kind === "PREF_ACCRUED")
    return calculatePeriodPreferredReturn(
      toNum(c.actuallyFunded),
      Math.max(
        0,
        toNum(c.prefEquity.totalRate) - toNum(c.prefEquity.currentRate),
      ) / 100,
      1,
    )
  if (row.kind === "LP_PREF")
    return c.preferredReturn.enabled
      ? calculatePeriodPreferredReturn(
          toNum(c.actuallyFunded),
          toNum(c.preferredReturn.rate) / 100,
          periodsPerYear,
        )
      : 0
  if (row.kind === "ROC") return toNum(c.actuallyFunded)
  return 1
}

export function calcFormulaNote(
  row: DistributionPaymentRow,
  classes: DistributionSetupClass[],
): string {
  const qtr = computeDue(row, classes, 0.25, true)
  if (row.kind === "PREF_CURRENT")
    return `funded × current rate ÷ period — e.g. ${formatMoney(qtr)} / qtr`
  if (row.kind === "PREF_ACCRUED")
    return `accrued balance to date — est. ${formatMoney(qtr)}`
  if (row.kind === "LP_PREF")
    return `Σ funded × pref rate ÷ period, + arrears — e.g. ${formatMoney(qtr)} / qtr`
  if (row.kind === "ROC") return `unreturned capital — ${formatMoney(qtr)}`
  if (row.kind === "CATCHUP")
    return `amount restoring the class to its target share of profits to date`
  return ""
}

export interface SimFlowRow {
  kind: "payment" | "stage"
  index: number
  label: string
  due: number | null
  paid: number | null
  note?: string
  shortfall?: number
  stage?: number
  skipped?: boolean
}

export interface SimResult {
  flowRows: SimFlowRow[]
  perClass: Record<string, number>
  leftover: number
  totalPaid: number
  /** Auto-evaluated promote hurdles (IRR / CoC / cumulative). */
  hurdleEvaluations: HurdleEvaluation[]
  /** Effective stage-met flags after calc + manual overrides. */
  stageMet: Record<number, boolean>
  /** Period window used for dues / CoC. */
  period: DistributionPeriod
  periodWindowLabel: string
  /** Prior cash already recorded in this period window. */
  priorCashInPeriod: number
}

export function investedCapitalFromClasses(
  classes: DistributionSetupClass[],
): number {
  return classes
    .filter((c) => c.classType === "lp" || c.classType === "gp")
    .reduce((s, c) => s + toNum(c.actuallyFunded), 0)
}

export function buildWaterfallInput(params: {
  cash: number
  periodFactor: number
  classes: DistributionSetupClass[]
  cashFlows?: HurdleCashFlow[]
  cumulativeDistributions?: number
  /** Cash already paid + current run in the selected period (for CoC). */
  cashInPeriod?: number
}): WaterfallInput {
  const investedCapital = investedCapitalFromClasses(params.classes)
  const periodsPerYear = periodsPerYearFromFactor(params.periodFactor)
  const cashFlows =
    params.cashFlows && params.cashFlows.length > 0
      ? params.cashFlows
      : []
  const periodCash =
    params.cashInPeriod != null && Number.isFinite(params.cashInPeriod)
      ? params.cashInPeriod
      : params.cash
  return {
    cashFlows,
    availableCash: params.cash,
    investedCapital,
    periodsPerYear,
    distribution: periodCash,
    cumulativeDistributions: params.cumulativeDistributions,
  }
}

export function runDistributionSim(input: {
  cash: number
  periodFactor: number
  rows: DistributionPaymentRow[]
  classes: DistributionSetupClass[]
  promote: DistributionSetupPromote
  /** Manual overrides when a hurdle cannot be auto-evaluated (e.g. IRR without history). */
  stageMetOverrides?: Record<number, boolean>
  dueOverrides: Record<string, number>
  cashFlows?: HurdleCashFlow[]
  cumulativeDistributions?: number
  /** Distribution as-of date (YYYY-MM-DD). Defaults to today. */
  asOfDate?: string
  /** Completed priors — used to reduce same-period preferred dues. */
  priorDistributions?: PriorDistributionRecord[]
  /** Exclude this prior id when attributing same-period cash (details re-sim). */
  excludePriorId?: string
}): SimResult {
  const {
    cash,
    periodFactor,
    rows,
    classes,
    promote,
    stageMetOverrides = {},
    dueOverrides,
    cashFlows,
    cumulativeDistributions,
    asOfDate,
    priorDistributions = [],
    excludePriorId,
  } = input

  const period = periodFromFactor(periodFactor)
  const asOf =
    asOfDate && /^\d{4}-\d{2}-\d{2}/.test(asOfDate)
      ? asOfDate.slice(0, 10)
      : new Date().toISOString().slice(0, 10)

  const { window, priorCash } = sumPriorCashInPeriod({
    priors: priorDistributions.map((p) => ({
      id: p.id,
      amount: toNum(p.amount),
      date: p.date,
    })),
    asOfIso: asOf,
    period,
    excludeId: excludePriorId,
  })

  const cashInPeriod = priorCash + cash
  const waterfallInput = buildWaterfallInput({
    cash,
    periodFactor,
    classes,
    cashFlows,
    cumulativeDistributions,
    cashInPeriod,
  })
  const { stageMet, evaluations: hurdleEvaluations } =
    computeStageMetFromHurdles(promote, waterfallInput, stageMetOverrides)

  // Stage map already includes manual overrides.
  const stageMetFinal: Record<number, boolean> = { ...stageMet }

  const ppy = periodsPerYearFromFactor(periodFactor)
  let remaining = cash
  /** Prior cash still available to absorb preferred period dues (waterfall order). */
  let priorPool = priorCash
  const perClass: Record<string, number> = {}
  const profit: Record<string, number> = {}
  classes.forEach((c) => {
    perClass[c.id] = 0
    profit[c.id] = 0
  })

  const flowRows: SimFlowRow[] = []
  let starved = false

  for (let i = 0; i < rows.length; i++) {
    const t = rows[i]!
    if (starved) {
      flowRows.push({
        kind: "payment",
        index: i,
        label: t.name,
        due: null,
        paid: null,
        skipped: true,
        note: "not reached — cash exhausted upstream",
      })
      continue
    }

    let fullDue: number
    if (t.kind === "CATCHUP" && t.amountMode !== "input") {
      const pct = Math.min(99, toNum(t.catchupPct) || 20)
      const lpProfit = classes
        .filter((c) => c.classType === "lp")
        .reduce((s, c) => s + (profit[c.id] || 0), 0)
      const gpProfit = (t.payTo || []).reduce(
        (s, id) => s + (profit[id] || 0),
        0,
      )
      fullDue = Math.max(0, (pct / (100 - pct)) * lpProfit - gpProfit)
    } else {
      fullDue = computeDue(t, classes, periodFactor)
    }

    let baseDue = fullDue
    let appliedFromPrior = 0
    if (
      dueOverrides[t.id] == null &&
      isPeriodPrefKind(t.kind) &&
      t.amountMode !== "input"
    ) {
      const reduced = remainingDueAfterPriorPool(fullDue, priorPool)
      baseDue = reduced.remainingDue
      appliedFromPrior = reduced.appliedFromPrior
      priorPool = reduced.poolLeft
    }

    const due =
      dueOverrides[t.id] != null ? dueOverrides[t.id]! : baseDue
    const paid = Math.min(remaining, due)
    const list = (t.payTo || [])
      .map((id) => classes.find((c) => c.id === id))
      .filter((c): c is DistributionSetupClass => c != null)

    const dues = list.map((c) => classDueShare(t, c, ppy))
    const dueSum = dues.reduce((a, b) => a + b, 0) || 1
    list.forEach((c, ci) => {
      const share = paid * (dues[ci]! / dueSum)
      perClass[c.id] = (perClass[c.id] || 0) + share
      if (t.kind === "LP_PREF" || t.kind === "CATCHUP")
        profit[c.id] = (profit[c.id] || 0) + share
    })
    remaining -= paid

    const notes: string[] = []
    if (appliedFromPrior > 0.5) {
      notes.push(
        `${formatMoney(appliedFromPrior)} already covered by prior ${periodLabel(period).toLowerCase()} distributions`,
      )
    }
    if (fullDue > due + 0.5 && dueOverrides[t.id] == null) {
      notes.push(
        `full ${periodLabel(period).toLowerCase()} due ${formatMoney(fullDue)}`,
      )
    }

    flowRows.push({
      kind: "payment",
      index: i,
      label: t.name,
      due,
      paid,
      shortfall: due - paid > 0.5 ? due - paid : undefined,
      note: notes.length ? notes.join(" · ") : undefined,
    })
    if (remaining <= 0.005) {
      remaining = 0
      starved = true
    }
  }

  const S = stageCount(promote)
  const parts = equityParticipants(classes)
  let active = 0
  while (active < S - 1 && stageMetFinal[active + 1]) active++

  if (parts.length) {
    for (let s = 0; s < S; s++) {
      const idx = rows.length + s
      const stageLabel =
        s === 0
          ? "Split remaining cash — stage 1 (base shares)"
          : `Split remaining cash — stage ${s + 1} (after Hurdle ${s})`

      if (s < active) {
        const ev = hurdleEvaluations[s]
        flowRows.push({
          kind: "stage",
          index: idx,
          stage: s,
          label: stageLabel,
          due: null,
          paid: null,
          note: ev?.detail
            ? `Hurdle ${s + 1} met (${ev.detail}) — cash passes to the next stage ↓`
            : `Hurdle ${s + 1} met — cash passes to the next stage ↓`,
        })
        continue
      }
      if (s > active) {
        const ev = hurdleEvaluations[s - 1]
        flowRows.push({
          kind: "stage",
          index: idx,
          stage: s,
          label: stageLabel,
          due: null,
          paid: null,
          skipped: true,
          note: ev?.detail
            ? `not reached — Hurdle ${s} not met (${ev.detail})`
            : `not reached — Hurdle ${s} not met yet`,
        })
        continue
      }
      if (remaining <= 0.005) {
        flowRows.push({
          kind: "stage",
          index: idx,
          stage: s,
          label: stageLabel,
          due: null,
          paid: null,
          skipped: true,
          note: "not reached — cash exhausted upstream",
        })
        continue
      }
      const shares = parts.map((c) => shareAt(promote, c.id, s))
      const tot = shares.reduce((a, b) => a + b, 0) || 1
      parts.forEach((c, ci) => {
        const share = remaining * (shares[ci]! / tot)
        perClass[c.id] = (perClass[c.id] || 0) + share
        profit[c.id] = (profit[c.id] || 0) + share
      })
      flowRows.push({
        kind: "stage",
        index: idx,
        stage: s,
        label: stageLabel,
        due: remaining,
        paid: remaining,
        note: "splits all remaining cash — stop",
      })
      remaining = 0
    }
  }

  const totalPaid = Object.values(perClass).reduce((a, b) => a + b, 0)
  return {
    flowRows,
    perClass,
    leftover: remaining,
    totalPaid,
    hurdleEvaluations,
    stageMet: stageMetFinal,
    period,
    periodWindowLabel: window.label,
    priorCashInPeriod: priorCash,
  }
}

export { factorFromPeriod, periodFromFactor, periodLabel } from "./distributionPeriod"
export type { DistributionPeriod } from "./distributionPeriod"

export function defaultPayToForKind(
  kind: DistributionWfKind,
  classes: DistributionSetupClass[],
): string[] {
  if (kind === "LP_PREF" || kind === "ROC")
    return classes.filter((c) => c.classType === "lp").map((c) => c.id)
  if (kind === "PREF_CURRENT" || kind === "PREF_ACCRUED")
    return classes
      .filter((c) => c.classType === "preferred_equity")
      .map((c) => c.id)
  if (kind === "CATCHUP")
    return classes.filter((c) => c.classType === "gp").map((c) => c.id)
  return []
}
