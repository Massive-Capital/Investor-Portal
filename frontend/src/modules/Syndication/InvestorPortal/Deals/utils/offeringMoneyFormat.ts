import type { DealInvestorRow } from "../types/deal-investors.types"
import { investorRowIsFundApproved } from "./dealInvestorTableDisplay"

/** Parse a money-ish string (with $, commas) to a number. */
export function parseMoneyDigits(s: string): number {
  if (s == null || !String(s).trim()) return NaN
  const n = parseFloat(String(s).replace(/[^0-9.-]/g, ""))
  return Number.isFinite(n) ? n : NaN
}

/**
 * USD for deal investor / member tables: always two fraction digits (e.g. $1,234.00).
 */
export function formatCurrencyTableDisplay(raw: string | undefined | null): string {
  const t = String(raw ?? "").trim()
  if (!t || t === "—") return "—"
  const n = parseMoneyDigits(t)
  if (!Number.isFinite(n)) return t
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

/** USD $0.00 for committed amount when none or zero (matches table column). */
export function formatCommittedZeroUsd(): string {
  return formatCurrencyTableDisplay("0")
}

/**
 * Sum commitment + extra amounts (same idea as backend `formatCommitted`) for display
 * when the API omits a pre-formatted `committed` string but sends raw amounts.
 */
export function formatCommittedFromRawParts(
  commitmentAmount: string,
  extras: string[],
): string {
  const raw = [commitmentAmount, ...extras.map(String)]
  const nums = raw
    .map((s) => parseFloat(String(s).replace(/[^0-9.-]/g, "")))
    .filter((n) => Number.isFinite(n))
  if (nums.length === 0) return "—"
  const sum = nums.reduce((a, b) => a + b, 0)
  return formatCurrencyTableDisplay(String(sum))
}

/**
 * Committed column: use API `committed` when set; otherwise derive from
 * `commitmentAmountRaw` + `extraContributionAmounts` (same as table normalization).
 */
export function displayInvestorCommittedAmount(row: DealInvestorRow): string {
  const c = String(row.committed ?? "").trim()
  if (c && c !== "—") return formatCurrencyTableDisplay(c)
  const fromParts = formatCommittedFromRawParts(
    String(row.commitmentAmountRaw ?? "").trim(),
    row.extraContributionAmounts ?? [],
  )
  if (fromParts !== "—") return fromParts
  return formatCommittedZeroUsd()
}

/**
 * When fund is not yet re-approved after an LP increase: last approved total vs additional commitment.
 * Used for Committed column split display.
 */
export function investorCommittedPendingSplit(row: DealInvestorRow): {
  snapshot: number
  incremental: number
} | null {
  if (investorRowIsFundApproved(row)) return null
  const snapRaw = String(row.fundApprovedCommitmentSnapshot ?? "").trim()
  if (!snapRaw) return null
  const snapshot = parseMoneyDigits(snapRaw)
  if (!Number.isFinite(snapshot) || snapshot <= 0) return null
  const total = parseMoneyDigits(displayInvestorCommittedAmount(row))
  if (!Number.isFinite(total)) return null
  const incremental = Math.round((total - snapshot) * 100) / 100
  if (incremental <= 0.009) return null
  return { snapshot, incremental }
}

/** Plain text / CSV when split applies: `$100.00 + $50.00`. */
export function displayInvestorCommittedAmountExport(row: DealInvestorRow): string {
  const split = investorCommittedPendingSplit(row)
  if (!split) return displayInvestorCommittedAmount(row)
  return `${formatCurrencyTableDisplay(String(split.snapshot))} + ${formatCurrencyTableDisplay(String(split.incremental))}`
}

/**
 * Dollars for the “Total Funded” KPI: fully funded rows use full commitment;
 * rows pending re-approval after an LP increase count only the last approved snapshot
 * (the incremental portion is excluded until the sponsor approves again).
 */
export function fundedAmountForTotalFundedKpi(row: DealInvestorRow): number {
  const total = parseMoneyDigits(displayInvestorCommittedAmount(row))
  if (!Number.isFinite(total)) return 0
  if (investorRowIsFundApproved(row)) return total
  const split = investorCommittedPendingSplit(row)
  if (split) return split.snapshot
  return 0
}

/** True when total committed (same basis as the Committed column) is zero. */
export function investorRowCommittedAmountIsZero(row: DealInvestorRow): boolean {
  const n = parseMoneyDigits(displayInvestorCommittedAmount(row))
  return Number.isFinite(n) && n === 0
}

/** Deal Members: committed total from other investors this member added (see API field). */
export function displayAddedInvestorsCommittedAmount(row: DealInvestorRow): string {
  const c = String(row.addedInvestorsCommitted ?? "").trim()
  if (c && c !== "—") return formatCurrencyTableDisplay(c)
  return "—"
}

/** Format for KPI / read-only display: $1,234 or $1,234.56 */
export function formatMoneyFieldDisplay(raw: string | undefined | null): string {
  if (raw == null || !String(raw).trim()) return "—"
  const n = parseMoneyDigits(String(raw))
  if (!Number.isFinite(n)) return String(raw).trim()
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n)
}

/** Normalize user input on blur to a consistent currency string. */
export function blurFormatMoneyInput(raw: string): string {
  const t = raw.trim()
  if (!t) return ""
  const n = parseMoneyDigits(t)
  if (!Number.isFinite(n)) return raw
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n)
}

/** Committed-amount field: live typing + prefill (same rules as blur). */
export function formatCurrencyUsdTypeInput(raw: string): string {
  return blurFormatMoneyInput(raw)
}

/** Whole number or decimal count for “number of units” (class offering). */
export function blurFormatNumberOfUnitsInput(raw: string): string {
  const t = String(raw ?? "").trim()
  if (!t) return ""
  const n = parseFloat(t.replace(/[^0-9.]/g, ""))
  if (!Number.isFinite(n) || n < 0) return ""
  if (Number.isInteger(n) || Math.abs(n - Math.round(n)) < 1e-9) {
    return String(Math.max(0, Math.round(n)))
  }
  return String(Math.round(n * 1e6) / 1e6)
}
