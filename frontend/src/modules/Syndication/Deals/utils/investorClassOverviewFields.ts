import type { DealInvestorClass } from "../types/deal-investor-class.types"
import { parseMoneyDigits } from "./offeringMoneyFormat"

/** `subscriptionType` from Add investor class → Class type = LP. */
export function isLpInvestorClass(
  row: Pick<DealInvestorClass, "subscriptionType"> | undefined,
): boolean {
  return row?.subscriptionType?.trim().toLowerCase() === "lp"
}

export function hasInvestorClassNumberOfUnits(
  raw: string | undefined,
): boolean {
  const t = String(raw ?? "").trim()
  return Boolean(t) && t !== "—"
}

export function hasInvestorClassPricePerUnit(
  raw: string | undefined,
): boolean {
  const t = String(raw ?? "").trim()
  if (!t || t === "—") return false
  const n = parseMoneyDigits(t)
  return Number.isFinite(n)
}
