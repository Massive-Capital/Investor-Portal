/** Parse a money-ish string (with $, commas) to a number. */
export function parseMoneyDigits(s: string): number {
  if (s == null || !String(s).trim()) return NaN
  const n = parseFloat(String(s).replace(/[^0-9.-]/g, ""))
  return Number.isFinite(n) ? n : NaN
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
