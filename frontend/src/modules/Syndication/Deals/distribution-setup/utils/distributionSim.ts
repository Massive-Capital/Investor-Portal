import type {
  DistributionPaymentRow,
  DistributionSetupClass,
  DistributionSetupPromote,
  DistributionWfKind,
} from "../types/distribution-setup.types"

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

  if (row.kind === "PREF_CURRENT")
    return list.reduce(
      (s, c) =>
        s + toNum(c.actuallyFunded) * (toNum(c.prefEquity.currentRate) / 100) * periodFactor,
      0,
    )
  if (row.kind === "PREF_ACCRUED")
    return list.reduce(
      (s, c) =>
        s +
        toNum(c.actuallyFunded) *
          (Math.max(
            0,
            toNum(c.prefEquity.totalRate) - toNum(c.prefEquity.currentRate),
          ) /
            100),
      0,
    )
  if (row.kind === "LP_PREF")
    return list.reduce((s, c) => {
      if (!c.preferredReturn.enabled) return s
      return (
        s +
        toNum(c.actuallyFunded) *
          (toNum(c.preferredReturn.rate) / 100) *
          periodFactor
      )
    }, 0)
  if (row.kind === "ROC")
    return list.reduce((s, c) => s + toNum(c.actuallyFunded), 0)
  return 0
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
}

export function runDistributionSim(input: {
  cash: number
  periodFactor: number
  rows: DistributionPaymentRow[]
  classes: DistributionSetupClass[]
  promote: DistributionSetupPromote
  stageMet: Record<number, boolean>
  dueOverrides: Record<string, number>
}): SimResult {
  const {
    cash,
    periodFactor,
    rows,
    classes,
    promote,
    stageMet,
    dueOverrides,
  } = input
  let remaining = cash
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

    let baseDue: number
    if (t.kind === "CATCHUP" && t.amountMode !== "input") {
      const pct = Math.min(99, toNum(t.catchupPct) || 20)
      const lpProfit = classes
        .filter((c) => c.classType === "lp")
        .reduce((s, c) => s + (profit[c.id] || 0), 0)
      const gpProfit = (t.payTo || []).reduce(
        (s, id) => s + (profit[id] || 0),
        0,
      )
      baseDue = Math.max(0, (pct / (100 - pct)) * lpProfit - gpProfit)
    } else {
      baseDue = computeDue(t, classes, periodFactor)
    }

    const due =
      dueOverrides[t.id] != null ? dueOverrides[t.id]! : baseDue
    const paid = Math.min(remaining, due)
    const list = (t.payTo || [])
      .map((id) => classes.find((c) => c.id === id))
      .filter((c): c is DistributionSetupClass => c != null)

    const dues = list.map((c) => {
      if (t.kind === "PREF_CURRENT")
        return (
          toNum(c.actuallyFunded) *
          (toNum(c.prefEquity.currentRate) / 100) *
          periodFactor
        )
      if (t.kind === "PREF_ACCRUED")
        return (
          toNum(c.actuallyFunded) *
          (Math.max(
            0,
            toNum(c.prefEquity.totalRate) - toNum(c.prefEquity.currentRate),
          ) /
            100)
        )
      if (t.kind === "LP_PREF")
        return c.preferredReturn.enabled
          ? toNum(c.actuallyFunded) *
              (toNum(c.preferredReturn.rate) / 100) *
              periodFactor
          : 0
      if (t.kind === "ROC") return toNum(c.actuallyFunded)
      return 1
    })
    const dueSum = dues.reduce((a, b) => a + b, 0) || 1
    list.forEach((c, ci) => {
      const share = paid * (dues[ci]! / dueSum)
      perClass[c.id] = (perClass[c.id] || 0) + share
      if (t.kind === "LP_PREF" || t.kind === "CATCHUP")
        profit[c.id] = (profit[c.id] || 0) + share
    })
    remaining -= paid
    flowRows.push({
      kind: "payment",
      index: i,
      label: t.name,
      due,
      paid,
      shortfall: due - paid > 0.5 ? due - paid : undefined,
    })
    if (remaining <= 0.005) {
      remaining = 0
      starved = true
    }
  }

  const S = stageCount(promote)
  const parts = equityParticipants(classes)
  let active = 0
  while (active < S - 1 && stageMet[active + 1]) active++

  if (parts.length) {
    for (let s = 0; s < S; s++) {
      const idx = rows.length + s
      const stageLabel =
        s === 0
          ? "Split remaining cash — stage 1 (base shares)"
          : `Split remaining cash — stage ${s + 1} (after Hurdle ${s})`

      if (s < active) {
        flowRows.push({
          kind: "stage",
          index: idx,
          stage: s,
          label: stageLabel,
          due: null,
          paid: null,
          note: `Hurdle ${s + 1} met — cash passes to the next stage ↓`,
        })
        continue
      }
      if (s > active) {
        flowRows.push({
          kind: "stage",
          index: idx,
          stage: s,
          label: stageLabel,
          due: null,
          paid: null,
          skipped: true,
          note: `not reached — Hurdle ${s} not met yet`,
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
  return { flowRows, perClass, leftover: remaining, totalPaid }
}

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
