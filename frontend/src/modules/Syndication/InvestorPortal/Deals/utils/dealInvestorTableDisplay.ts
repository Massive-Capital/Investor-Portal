import {
  ADD_MEMBER_DRAFT_ROW_ID,
  investorRowShowsDraftBadge,
} from "../deal-members/add-investment/addMemberDraftInvestorRow"
import type { DealInvestorRow } from "../types/deal-investors.types"
import { investmentStatusLabel } from "../constants/investment-status"

/**
 * Status column: avoid repeating "Draft" when the row is already marked as draft
 * (badge / draft row).
 */
export function dealInvestorStatusForTable(row: DealInvestorRow): string {
  if (row.id === ADD_MEMBER_DRAFT_ROW_ID) return "—"
  const s = String(row.status ?? "").trim()
  if (!s || s === "—") return "—"
  const draftContext = investorRowShowsDraftBadge(row)
  if (draftContext && s.toLowerCase() === "draft") return "—"
  return s
}

/**
 * Status for display: maps stored DB/API values (e.g. `Signed`, `Soft committed`)
 * to the same labels used in Add Investment, when applicable.
 */
export function dealInvestorStatusDisplayLabel(row: DealInvestorRow): string {
  const t = dealInvestorStatusForTable(row)
  if (t === "—") return "—"
  return investmentStatusLabel(t)
}
