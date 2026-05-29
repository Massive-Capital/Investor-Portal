import type {
  InvestmentListRow,
  InvestmentOnboardingBucket,
} from "./investments.types"

/** Tab filter for a list row (API sets `onboardingBucket`; local/runtime rows infer from amount). */
export function resolveInvestmentOnboardingBucket(
  row: InvestmentListRow,
): InvestmentOnboardingBucket {
  const stored = row.onboardingBucket
  if (stored === "pending" || stored === "in_progress") return stored
  if (row.investedAmount > 0) return "in_progress"
  return "pending"
}
