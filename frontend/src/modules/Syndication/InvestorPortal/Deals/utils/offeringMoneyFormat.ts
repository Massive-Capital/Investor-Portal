import type { DealInvestorRow } from "../types/deal-investors.types"

/** Parse a money-ish string (with $, commas) to a number. */
export function parseMoneyDigits(s: string): number {
  if (s == null || !String(s).trim()) return NaN
  const n = parseFloat(String(s).replace(/[^0-9.-]/g, ""))
  return Number.isFinite(n) ? n : NaN
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
  if (sum === 0) return "—"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(sum)
}

/**
 * Committed column: use API `committed` when set; otherwise derive from
 * `commitmentAmountRaw` + `extraContributionAmounts` (same as table normalization).
 */
export function displayInvestorCommittedAmount(row: DealInvestorRow): string {
  const c = String(row.committed ?? "").trim()
  if (c && c !== "—") return c
  const fromParts = formatCommittedFromRawParts(
    String(row.commitmentAmountRaw ?? "").trim(),
    row.extraContributionAmounts ?? [],
  )
  return fromParts !== "—" ? fromParts : "—"
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
