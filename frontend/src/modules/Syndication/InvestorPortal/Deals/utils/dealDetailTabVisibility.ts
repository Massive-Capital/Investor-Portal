import { LP_INVESTOR_ROLE_VALUE } from "../constants/investor-profile"
import type { DealInvestorRow } from "../types/deal-investors.types"

export type ViewerDealMemberRole =
  | "lead_sponsor"
  | "admin_sponsor"
  | "co_sponsor"
  | "lp_investor"
  | null

/**
 * Match the signed-in user’s email to a deal roster row and classify sponsor / LP role.
 * Returns null when the viewer is not on the roster (typical org owner / admin).
 */
export function resolveViewerDealMemberRole(
  members: DealInvestorRow[],
  sessionEmail: string,
): ViewerDealMemberRole {
  const em = sessionEmail.trim().toLowerCase()
  if (!em || !em.includes("@")) return null
  for (const m of members) {
    const rowEmail = String(m.userEmail ?? "").trim().toLowerCase()
    if (rowEmail !== em) continue
    const role = String(m.investorRole ?? "").trim().toLowerCase()
    if (!role || role === "—") continue
    if (role === "lead sponsor") return "lead_sponsor"
    if (role === "admin sponsor") return "admin_sponsor"
    if (role === "co-sponsor" || role === "co sponsor") return "co_sponsor"
    if (
      role === LP_INVESTOR_ROLE_VALUE.toLowerCase() ||
      role === "lp investors"
    )
      return "lp_investor"
  }
  return null
}

const CO_SPONSOR_HIDDEN_TABS = new Set([
  "deal_members",
  "investor_communication",
  "distributions",
])

/** Which deal detail tab ids the viewer may open, based on roster role. */
export function visibleDealDetailTabIds(
  role: ViewerDealMemberRole,
): Set<string> {
  const all = new Set([
    "offering_details",
    "documents",
    "esign_templates",
    "investors",
    "investor_communication",
    "distributions",
    "deal_members",
  ])
  if (role === null) return all
  if (role === "lead_sponsor" || role === "admin_sponsor") return all
  if (role === "lp_investor") {
    const s = new Set(all)
    s.delete("deal_members")
    return s
  }
  if (role === "co_sponsor") {
    const s = new Set(all)
    for (const id of CO_SPONSOR_HIDDEN_TABS) s.delete(id)
    return s
  }
  return all
}
