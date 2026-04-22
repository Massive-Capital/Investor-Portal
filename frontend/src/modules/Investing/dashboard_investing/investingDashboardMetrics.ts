import { getSessionUserEmail } from "@/common/auth/sessionUserEmail"
import { isLpInvestorSessionUser } from "@/common/auth/roleUtils"
import { fetchDealInvestors, fetchDealsList } from "@/modules/Syndication/InvestorPortal/Deals/api/dealsApi"
import {
  acceptedAmountForPayload,
  formatUsdDashboardAmount,
  fundedAmountForPayload,
} from "@/modules/Syndication/InvestorPortal/Deals/dealsDashboardMoney"
import type {
  DealInvestorRow,
  DealInvestorsPayload,
} from "@/modules/Syndication/InvestorPortal/Deals/types/deal-investors.types"
import type { DealListRow } from "@/modules/Syndication/InvestorPortal/Deals/types/deals.types"
import { parseMoneyDigits } from "@/modules/Syndication/InvestorPortal/Deals/utils/offeringMoneyFormat"

export interface InvestingDashboardMetrics {
  /** Active (non-archived) deals in investing scope */
  dealCount: number
  totalInvestedDisplay: string
  totalDistributedDisplay: string
  /**
   * LP: sum of your committed $ on investment rows that are not counter-signed
   * (or complete / inactive) — see `loadInvestingDashboardMetrics` filters.
   * Non-LP: sum of per-deal list “Total in-progress” fields.
   */
  totalInProgressDisplay: string
}

function formatInvestingMoney(n: number): string {
  const x = Number.isFinite(n) ? n : 0
  if (x === 0) return "$0"
  return formatUsdDashboardAmount(x)
}

function totalInProgressNumberForRow(row: DealListRow): number {
  const n = parseMoneyDigits(String(row.totalInProgress ?? "").trim())
  return Number.isFinite(n) ? n : 0
}

/** Not yet GP countersigned or complete; not inactive / draft / past / closed. */
const EXCLUDE_FROM_IN_PROGRESS: ReadonlySet<string> = new Set([
  "Counter-signed",
  "Funding instructions sent",
  "Funds fully received (complete)",
  "Inactive (bought out, assigned, or sold)",
  "Canceled (did not complete)",
  "Draft (hidden to investors)",
  "Past (hidden)",
  "Closed (no new investments allowed)",
  "Coming soon (no new investments allowed)",
])

/**
 * Committed $ on one row when the investment is “active” and the GP has not
 * countersigned yet (matches the Total in-progress dashboard hint).
 */
function inProgressNotCountersignedCommittedOnRow(row: DealInvestorRow): number {
  const status = String(row.status ?? "").trim()
  if (!status || status === "—" || EXCLUDE_FROM_IN_PROGRESS.has(status))
    return 0
  const n = parseMoneyDigits(String(row.committed ?? ""))
  if (!Number.isFinite(n) || n <= 0) return 0
  return n
}

/**
 * For the signed-in LP, sum committed amounts on rows that are active and
 * not yet counter-signed.
 */
function inProgressNotCountersignedForViewer(
  payload: DealInvestorsPayload,
  viewerEmailNorm: string,
): number {
  if (!viewerEmailNorm) return 0
  let sum = 0
  for (const inv of payload.investors) {
    const em = String(inv.userEmail ?? "").trim().toLowerCase()
    if (!em || em === "—" || em !== viewerEmailNorm) continue
    sum += inProgressNotCountersignedCommittedOnRow(inv)
  }
  return sum
}

/**
 * Sum committed amounts for investor rows belonging to the signed-in LP (email match).
 * Used instead of deal-wide KPI / full roster totals on the investing home dashboard.
 */
function committedAmountForViewerLpRows(
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
 * KPIs for `/` in investing mode: same deal scope as
 * `GET /deals?includeParticipantDeals=1`, excluding archived deals for counts and sums.
 */
export async function loadInvestingDashboardMetrics(): Promise<InvestingDashboardMetrics> {
  const list = await fetchDealsList({ includeParticipantDeals: true })
  const active = list.filter((r) => !r.archived)
  const lpViewer = isLpInvestorSessionUser()
  const viewerEmail = getSessionUserEmail()
  const useLpInvestorScope = lpViewer && Boolean(viewerEmail)

  if (active.length === 0) {
    return {
      dealCount: 0,
      totalInvestedDisplay: formatInvestingMoney(0),
      totalDistributedDisplay: formatInvestingMoney(0),
      totalInProgressDisplay: formatInvestingMoney(0),
    }
  }

  const perDeal = await Promise.all(
    active.map(async (row) => {
      const payload = await fetchDealInvestors(row.id, {
        lpInvestorsOnly: useLpInvestorScope,
      })
      return { row, payload }
    }),
  )

  let sumInvested = 0
  let sumDistributed = 0
  let sumInProgress = 0

  const lpEmailNorm = useLpInvestorScope
    ? String(viewerEmail ?? "").trim().toLowerCase()
    : ""

  for (const { row, payload } of perDeal) {
    if (useLpInvestorScope) {
      sumInvested += committedAmountForViewerLpRows(payload, lpEmailNorm)
      sumInProgress += inProgressNotCountersignedForViewer(payload, lpEmailNorm)
    } else {
      sumInvested += acceptedAmountForPayload(payload)
      sumInProgress += totalInProgressNumberForRow(row)
    }
    sumDistributed += fundedAmountForPayload(payload)
  }

  return {
    dealCount: active.length,
    totalInvestedDisplay: formatInvestingMoney(sumInvested),
    totalDistributedDisplay: formatInvestingMoney(sumDistributed),
    totalInProgressDisplay: formatInvestingMoney(sumInProgress),
  }
}
