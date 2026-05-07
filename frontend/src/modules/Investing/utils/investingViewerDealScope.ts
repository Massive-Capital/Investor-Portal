import { getSessionUserEmail } from "@/common/auth/sessionUserEmail"
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

function dealMemberRowHasSponsorRole(m: DealInvestorRow): boolean {
  const role = String(m.investorRole ?? "").trim().toLowerCase()
  if (role === "lead sponsor" || role === "admin sponsor") return true
  if (role === "co-sponsor" || role === "co sponsor") return true
  for (const lab of m.memberRoleLabels ?? []) {
    const r = String(lab ?? "").trim().toLowerCase()
    if (
      r === "lead sponsor" ||
      r === "admin sponsor" ||
      r === "co-sponsor" ||
      r === "co sponsor"
    ) {
      return true
    }
  }
  return false
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
  const role = String(m.investorRole ?? "").trim().toLowerCase()
  if (role === "lp investor" || role === "lp investors") return true
  for (const lab of m.memberRoleLabels ?? []) {
    const label = String(lab ?? "").trim().toLowerCase()
    if (label === "lp investor" || label === "lp investors") return true
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
