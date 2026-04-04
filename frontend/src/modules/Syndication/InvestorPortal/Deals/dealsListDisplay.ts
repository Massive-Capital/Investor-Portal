/** Display helpers for the Deals list table only */

import {
  DEAL_FORM_TYPE_OPTIONS,
  DEAL_TYPE_LABELS,
  type DealTypeOption,
} from "./types/deals.types"

export {
  formatDateDdMmmYyyy as formatDealListDateDisplay,
  dateSortValue,
} from "../../../../common/utils/formatDateDisplay"

/** Human-readable deal type for tables (wizard codes + legacy option keys). */
export function dealTypeDisplayLabel(code: string): string {
  if (!code || code === "—") return "—"
  const fromForm = DEAL_FORM_TYPE_OPTIONS.find((o) => o.value === code)
  if (fromForm) return fromForm.label
  const k = code as DealTypeOption
  return DEAL_TYPE_LABELS[k] ?? code
}

const moneyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatCommittedCurrency(raw: string): string {
  if (raw == null) return "—"
  const s = String(raw).trim()
  if (s === "" || s === "—") return "—"
  const n = Number.parseFloat(s.replace(/[^0-9.-]/g, ""))
  if (!Number.isFinite(n)) return s
  return moneyFmt.format(n)
}

export function committedSortValue(raw: string): number {
  const n = Number.parseFloat(String(raw ?? "").replace(/[^0-9.-]/g, ""))
  return Number.isFinite(n) ? n : 0
}

export function parseInvestorCountFromCell(raw: string): number {
  const n = Number.parseInt(String(raw ?? "").replace(/\D/g, ""), 10)
  return Number.isFinite(n) ? n : 0
}

export function formatInvestorCountDisplay(raw: string): string {
  const s = String(raw ?? "").trim()
  if (s === "" || s === "—") return "—"
  return String(parseInvestorCountFromCell(raw))
}
