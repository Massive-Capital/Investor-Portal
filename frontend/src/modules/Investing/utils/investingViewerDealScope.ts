import { getSessionUserEmail } from "@/common/auth/sessionUserEmail"
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
 * Investing home / deals: include when the viewer has committed capital, or is
 * lead, admin, or co-sponsor on the deal (syndicating role). Full roster is
 * required to resolve sponsor role — use {@link filterDealListToViewerInvested}
 * which fetches with `lpInvestorsOnly: false`.
 */
export function dealIsInViewerInvestingScope(
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

/**
 * Full investor roster (not `lpInvestorsOnly`) is required so lead/admin/co
 * rows exist for syndicators switching to investing.
 */
export async function filterDealListToViewerInvested(
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
    .filter(({ payload }) => dealIsInViewerInvestingScope(payload))
    .map(({ row }) => row)
}
