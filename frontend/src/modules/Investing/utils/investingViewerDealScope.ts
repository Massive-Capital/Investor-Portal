import { getSessionUserEmail } from "@/common/auth/sessionUserEmail"
import { dealMemberRoleLabelIsLpInvestor } from "@/common/auth/roleUtils"
import {
  INVESTOR_ROLE_SELECT_OPTIONS,
  LP_INVESTORS_ROLE_LABEL,
} from "@/modules/Syndication/Deals/constants/investor-profile"
import { fetchDealInvestors } from "@/modules/Syndication/Deals/api/dealsApi"
import type {
  DealInvestorRow,
  DealInvestorsPayload,
} from "@/modules/Syndication/Deals/types/deal-investors.types"
import type { DealListRow } from "@/modules/Syndication/Deals/types/deals.types"
import { parseMoneyDigits } from "@/modules/Syndication/Deals/utils/offeringMoneyFormat"

/**
 * Committed (USD) across investor rows for the given login email. Matches
 * the investing dashboard "your amount" when rows are the API subset for LP
 * or full roster for company users.
 */
export function committedAmountForViewerEmail(
  payload: DealInvestorsPayload,
  viewerEmailNorm: string,
): number {
  if (!viewerEmailNorm) return 0
  let sum = 0
  for (const inv of payload.investors) {
    const em = String(inv.userEmail ?? "").trim().toLowerCase()
    if (!em || em === "—" || em !== viewerEmailNorm) continue
    const n = parseMoneyDigits(String(inv.committed ?? ""))
    if (Number.isFinite(n)) sum += n
  }
  return sum
}

/**
 * Investor-only surfaces (e.g. dashboard “Your deals”, investment rows): you
 * have a positive committed amount. Does not include sponsor-only deals.
 */
export function dealIsInViewerInvestingScope(
  payload: DealInvestorsPayload,
): boolean {
  const em = getSessionUserEmail().trim().toLowerCase()
  if (!em) return false
  return committedAmountForViewerEmail(payload, em) > 0
}

const SPONSOR_ROLE_DISPLAY_ORDER = [
  "Lead Sponsor",
  "Admin Sponsor",
  "Co-Sponsor",
] as const

function sponsorRoleDisplayLabel(stored: string | undefined): string | null {
  const t = String(stored ?? "").trim()
  if (!t || t === "—") return null
  const byVal = INVESTOR_ROLE_SELECT_OPTIONS.find((o) => o.value === t)
  if (byVal?.label) {
    if (byVal.label === "Admin sponsor") return "Admin Sponsor"
    if (byVal.label === "Co-sponsor") return "Co-Sponsor"
    return byVal.label
  }
  const byLabel = INVESTOR_ROLE_SELECT_OPTIONS.find((o) => o.label === t)
  if (byLabel?.label) {
    if (byLabel.label === "Admin sponsor") return "Admin Sponsor"
    if (byLabel.label === "Co-sponsor") return "Co-Sponsor"
    return byLabel.label
  }
  const lower = t.toLowerCase()
  if (lower === "lead sponsor") return "Lead Sponsor"
  if (lower === "admin sponsor") return "Admin Sponsor"
  if (lower === "co-sponsor" || lower === "co sponsor") return "Co-Sponsor"
  return null
}

function sponsorRoleLabelsFromRow(m: DealInvestorRow): string[] {
  const out = new Set<string>()
  const roleLabel = sponsorRoleDisplayLabel(m.investorRole)
  if (roleLabel) out.add(roleLabel)
  for (const lab of m.memberRoleLabels ?? []) {
    const l = sponsorRoleDisplayLabel(lab)
    if (l) out.add(l)
  }
  return [...out]
}

function dealMemberRowHasSponsorRole(m: DealInvestorRow): boolean {
  return sponsorRoleLabelsFromRow(m).length > 0
}

/**
 * When the API does not send {@link DealInvestorRow.addedByIsSponsorOnDeal},
 * infer from the adder’s roster row in the same payload (if present).
 */
function adderInInvestorsListIsSponsor(
  addedByUserId: string,
  members: DealInvestorRow[],
): boolean {
  const k = String(addedByUserId).trim().toLowerCase()
  if (!k) return false
  for (const m of members) {
    if (
      String(m.contactId ?? "").trim().toLowerCase() === k &&
      dealMemberRowHasSponsorRole(m)
    ) {
      return true
    }
  }
  return false
}

function rowHasLpInvestorRole(m: DealInvestorRow): boolean {
  if (dealMemberRoleLabelIsLpInvestor(m.investorRole ?? "")) return true
  for (const lab of m.memberRoleLabels ?? []) {
    if (dealMemberRoleLabelIsLpInvestor(lab ?? "")) return true
  }
  return false
}

/**
 * Viewer is invited / linked to this deal as an LP investor (no positive
 * commitment required yet).
 */
function viewerOnDealAsInvitedInvestor(
  payload: DealInvestorsPayload,
  viewerEmailNorm: string,
): boolean {
  if (!viewerEmailNorm) return false
  for (const m of payload.investors) {
    const rowEmail = String(m.userEmail ?? "").trim().toLowerCase()
    if (rowEmail !== viewerEmailNorm) continue
    if (m.investorKind === "lp_roster") return true
    if (rowHasLpInvestorRole(m)) return true
    if (m.addedByIsSponsorOnDeal === true) return true
    if (
      m.addedByIsSponsorOnDeal === undefined &&
      m.addedByUserId &&
      adderInInvestorsListIsSponsor(m.addedByUserId, payload.investors)
    ) {
      return true
    }
  }
  return false
}

/**
 * `/investing/deals` table: only deals where the viewer is invested (positive
 * committed amount) or invited / linked as an LP investor on the roster.
 */
export function dealIsInViewerInvestingDealsPageScope(
  payload: DealInvestorsPayload,
): boolean {
  const em = getSessionUserEmail().trim().toLowerCase()
  if (!em) return false
  if (committedAmountForViewerEmail(payload, em) > 0) return true
  return viewerOnDealAsInvitedInvestor(payload, em)
}

function investingViewerEmailNorm(): string {
  return getSessionUserEmail().trim().toLowerCase()
}

/**
 * `GET /deals` (with `includeParticipantDeals`) already enforces
 * `lpInvestorEmailScopedDealIds` on the server. Session `lp_investor_deal_ids` can
 * lag after a new LP invite, so we do not filter the response again here.
 */
export function applyLpSessionDealIdScope(
  rows: DealListRow[],
): DealListRow[] {
  return rows
}

/**
 * Full investor roster (not `lpInvestorsOnly`) is required to match
 * `userEmail` + `committed` for the session.
 */
export async function filterDealListToViewerInvested(
  rows: DealListRow[],
): Promise<DealListRow[]> {
  const viewerEmailNorm = investingViewerEmailNorm()
  if (!viewerEmailNorm) return []
  const toScan = applyLpSessionDealIdScope(rows)
  const withPayload = await Promise.all(
    toScan.map(async (row) => {
      const payload = await fetchDealInvestors(row.id, {
        lpInvestorsOnly: false,
      })
      return { row, payload }
    }),
  )
  return withPayload
    .filter(({ payload }) => dealIsInViewerInvestingScope(payload))
    .map(({ row }) => row)
}

/**
 * Investing deals route: sponsor or committed. Does not use
 * {@link applyLpSessionDealIdScope} so a sponsor is not pre-excluded (LP deal id
 * lists are investor-scoped, not syndication-scoped).
 */
export type ViewerInvestingDealRoles = {
  /** Lead Sponsor, Admin Sponsor, and/or Co-Sponsor when applicable. */
  sponsorRoleLabels: string[]
  isInvestor: boolean
}

/**
 * Sponsor vs LP investor on a deal for the investing deals table (not mutually exclusive).
 */
export function resolveViewerInvestingDealRoles(
  members: DealInvestorRow[],
  investors: DealInvestorRow[],
  viewerEmailNorm: string,
  investorPayload?: DealInvestorsPayload,
): ViewerInvestingDealRoles {
  const sponsorLabels = new Set<string>()
  let isInvestor = false
  if (!viewerEmailNorm) return { sponsorRoleLabels: [], isInvestor }

  for (const list of [members, investors]) {
    for (const m of list) {
      const rowEmail = String(m.userEmail ?? "").trim().toLowerCase()
      if (rowEmail !== viewerEmailNorm) continue
      for (const lab of sponsorRoleLabelsFromRow(m)) sponsorLabels.add(lab)
      if (rowHasLpInvestorRole(m)) isInvestor = true
    }
  }

  if (investorPayload) {
    if (committedAmountForViewerEmail(investorPayload, viewerEmailNorm) > 0) {
      isInvestor = true
    }
    if (viewerOnDealAsInvitedInvestor(investorPayload, viewerEmailNorm)) {
      isInvestor = true
    }
  }

  const sponsorRoleLabels = SPONSOR_ROLE_DISPLAY_ORDER.filter((l) =>
    sponsorLabels.has(l),
  )
  return { sponsorRoleLabels, isInvestor }
}

/** Display label for investing → Deals tab “Your role” column. */
export function formatViewerInvestingDealRolesLabel(
  roles: ViewerInvestingDealRoles,
): string {
  const parts: string[] = [...roles.sponsorRoleLabels]
  if (roles.isInvestor) parts.push(LP_INVESTORS_ROLE_LABEL)
  if (parts.length === 0) return "—"
  return parts.join(", ")
}

export async function filterDealListToInvestingDealsPage(
  rows: DealListRow[],
): Promise<DealListRow[]> {
  const viewerEmailNorm = investingViewerEmailNorm()
  if (!viewerEmailNorm) return []
  const withPayload = await Promise.all(
    rows.map(async (row) => {
      const payload = await fetchDealInvestors(row.id, {
        lpInvestorsOnly: false,
      })
      return { row, payload }
    }),
  )
  return withPayload
    .filter(({ payload }) => dealIsInViewerInvestingDealsPageScope(payload))
    .map(({ row }) => row)
}
