import type { DealInvestorClass } from "../types/deal-investor-class.types"
import {
  blurFormatMoneyInput,
  parseMoneyDigits,
  parseNumberOfUnitsDigits,
} from "./offeringMoneyFormat"

/** `subscriptionType` from Add investor class → Class type = LP. */
export function isLpInvestorClass(
  row: Pick<DealInvestorClass, "subscriptionType"> | undefined,
): boolean {
  return row?.subscriptionType?.trim().toLowerCase() === "lp"
}

export function hasInvestorClassNumberOfUnits(
  raw: string | undefined,
): boolean {
  const n = parseNumberOfUnitsDigits(String(raw ?? ""))
  return Number.isFinite(n) && n > 0
}

export function hasInvestorClassPricePerUnit(
  raw: string | undefined,
): boolean {
  const t = String(raw ?? "").trim()
  if (!t || t === "—") return false
  const n = parseMoneyDigits(t)
  return Number.isFinite(n)
}

function stripMoneyForRaiseAmount(raw: string): string {
  return String(raw ?? "")
    .replace(/[$,\s]/g, "")
    .trim()
}

/** Raise amount used for price-per-unit: distributions first, then ownership/offering size. */
export function investorClassRaiseAmountForPricePerUnit(input: {
  offeringSize: string
  raiseAmountDistributions: string
}): string {
  const dist = String(input.raiseAmountDistributions ?? "").trim()
  if (stripMoneyForRaiseAmount(dist)) return dist
  return String(input.offeringSize ?? "").trim()
}

/** Price per unit = raise amount ÷ number of units (empty when inputs are invalid). */
export function computeInvestorClassPricePerUnit(
  raiseAmount: string,
  numberOfUnits: string,
): string {
  const raise = parseMoneyDigits(raiseAmount)
  const units = parseNumberOfUnitsDigits(numberOfUnits)
  if (!Number.isFinite(raise) || !Number.isFinite(units) || units <= 0) {
    return ""
  }
  const price = raise / units
  if (!Number.isFinite(price)) return ""
  return blurFormatMoneyInput(String(price))
}

export function computeInvestorClassPricePerUnitFromForm(input: {
  offeringSize: string
  raiseAmountDistributions: string
  numberOfUnits: string
}): string {
  return computeInvestorClassPricePerUnit(
    investorClassRaiseAmountForPricePerUnit(input),
    input.numberOfUnits,
  )
}
