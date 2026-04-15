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
  let hasLead = false
  let hasAdmin = false
  let hasCo = false
  let hasLp = false
  for (const m of members) {
    const rowEmail = String(m.userEmail ?? "").trim().toLowerCase()
    if (rowEmail !== em) continue
    const role = String(m.investorRole ?? "").trim().toLowerCase()
    if (!role || role === "—") continue
    if (role === "lead sponsor") hasLead = true
    else if (role === "admin sponsor") hasAdmin = true
    else if (role === "co-sponsor" || role === "co sponsor") hasCo = true
    if (
      role === LP_INVESTOR_ROLE_VALUE.toLowerCase() ||
      role === "lp investors"
    )
      hasLp = true
  }
  if (hasLead) return "lead_sponsor"
  if (hasAdmin) return "admin_sponsor"
  if (hasCo) return "co_sponsor"
  if (hasLp) return "lp_investor"
  return null
}

/**
 * Roster `investor_role` for the signed-in viewer when they appear on the deal
 * roster (lead sponsor, LP investor, etc.).
 */
export function resolveViewerDealInvestorRoleRaw(
  members: DealInvestorRow[],
  sessionEmail: string,
): string | null {
  const em = sessionEmail.trim().toLowerCase()
  if (!em || !em.includes("@")) return null
  for (const m of members) {
    const rowEmail = String(m.userEmail ?? "").trim().toLowerCase()
    if (rowEmail !== em) continue
    const raw = String(m.investorRole ?? "").trim()
    if (!raw || raw === "—") return null
    return raw
  }
  return null
}

/** Roster `investor_role` when the viewer is Lead / Admin / Co-sponsor; otherwise null. */
export function resolveViewerSponsorInvestorRoleRaw(
  members: DealInvestorRow[],
  sessionEmail: string,
): string | null {
  const kind = resolveViewerDealMemberRole(members, sessionEmail)
  if (
    kind !== "lead_sponsor" &&
    kind !== "admin_sponsor" &&
    kind !== "co_sponsor"
  ) {
    return null
  }
  return resolveViewerDealInvestorRoleRaw(members, sessionEmail)
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
