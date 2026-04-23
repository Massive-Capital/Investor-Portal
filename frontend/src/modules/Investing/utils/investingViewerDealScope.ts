import { getSessionUserEmail } from "@/common/auth/sessionUserEmail"
import {
  getLpInvestorDealIdsFromSession,
  isLpInvestorSessionUser,
} from "@/common/auth/roleUtils"
import { fetchDealInvestors } from "@/modules/Syndication/InvestorPortal/Deals/api/dealsApi"
import type { DealInvestorsPayload } from "@/modules/Syndication/InvestorPortal/Deals/types/deal-investors.types"
import type { DealListRow } from "@/modules/Syndication/InvestorPortal/Deals/types/deals.types"
import { resolveViewerDealMemberRole } from "@/modules/Syndication/InvestorPortal/Deals/utils/dealDetailTabVisibility"
import { parseMoneyDigits } from "@/modules/Syndication/InvestorPortal/Deals/utils/offeringMoneyFormat"

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

/**
 * `/investing/deals` table: any deal you sponsor (lead, admin, co) or you have
 * your own capital committed on.
 */
export function dealIsInViewerInvestingDealsPageScope(
  payload: DealInvestorsPayload,
): boolean {
  const sessionEmail = getSessionUserEmail()
  const em = sessionEmail.trim().toLowerCase()
  if (!em) return false
  if (committedAmountForViewerEmail(payload, em) > 0) return true
  const kind = resolveViewerDealMemberRole(payload.investors, sessionEmail)
  return (
    kind === "lead_sponsor" ||
    kind === "admin_sponsor" ||
    kind === "co_sponsor"
  )
}

function investingViewerEmailNorm(): string {
  return getSessionUserEmail().trim().toLowerCase()
}

/** When the session is LP-scoped and the API provided deal ids, skip other org deals. */
export function applyLpSessionDealIdScope(
  rows: DealListRow[],
): DealListRow[] {
  if (!isLpInvestorSessionUser()) return rows
  const lpIds = getLpInvestorDealIdsFromSession()
  if (lpIds.length === 0) return rows
  const allow = new Set(lpIds)
  return rows.filter((r) => allow.has(r.id))
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
