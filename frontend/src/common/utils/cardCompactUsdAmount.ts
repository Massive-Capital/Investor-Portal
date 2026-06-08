const ONE_MILLION = 1_000_000

/** Full USD for tooltips (always 2 fraction digits). */
export function formatCardCompactUsdExact(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0)
}

function formatMillionsCompact(n: number): string {
  const millions = n / ONE_MILLION
  const rounded = Math.round(millions * 100) / 100
  const [whole, fracRaw = ""] = rounded.toFixed(2).split(".")
  const frac = fracRaw.replace(/0+$/, "")
  const core = frac ? `${whole}.${frac}` : whole
  return `$${core}M`
}

/**
 * Card display: full number below $1M; compact `$1M`, `$10M`, `$1.01M`, `$1.1M` at/above $1M.
 */
export function formatCardCompactUsdDisplay(n: number): string {
  if (!Number.isFinite(n)) return "—"
  if (Math.abs(n) < ONE_MILLION) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(n)
  }
  return formatMillionsCompact(n)
}

export function shouldShowCardCompactUsdTooltip(n: number): boolean {
  return Number.isFinite(n) && Math.abs(n) >= ONE_MILLION
}
