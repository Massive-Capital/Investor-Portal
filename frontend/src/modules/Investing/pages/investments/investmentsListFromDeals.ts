/**
 * Build “Investments” list and detail from deal + investor APIs when the
 * signed-in user has a positive committed amount on a deal.
 */
import { getSessionUserEmail } from "@/common/auth/sessionUserEmail"
import {
  applyLpSessionDealIdScope,
  committedAmountForViewerEmail,
} from "@/modules/Investing/utils/investingViewerDealScope"
import {
  fetchDealById,
  fetchDealInvestors,
  fetchDealsList,
} from "@/modules/Syndication/InvestorPortal/Deals/api/dealsApi"
import type { DealDetailApi } from "@/modules/Syndication/InvestorPortal/Deals/api/dealsApi"
import type { DealInvestorRow } from "@/modules/Syndication/InvestorPortal/Deals/types/deal-investors.types"
import type { DealListRow } from "@/modules/Syndication/InvestorPortal/Deals/types/deals.types"
import { parseMoneyDigits } from "@/modules/Syndication/InvestorPortal/Deals/utils/offeringMoneyFormat"
import { investmentRuntimeIdForDeal, readRuntimeInvestmentRowById } from "./investmentsRuntimeStore"
import type { InvestmentDetailRecord, InvestmentListRow } from "./investments.types"

function normEmail(s: string): string {
  return s.trim().toLowerCase()
}

function primaryViewerRow(
  investors: DealInvestorRow[],
  viewerEmailNorm: string,
): DealInvestorRow | undefined {
  const matches = investors.filter(
    (i) => normEmail(String(i.userEmail ?? "")) === viewerEmailNorm,
  )
  if (matches.length === 0) return undefined
  matches.sort((a, b) => {
    const na = parseMoneyDigits(String(a.committed ?? ""))
    const nb = parseMoneyDigits(String(b.committed ?? ""))
    return (Number.isFinite(nb) ? nb : 0) - (Number.isFinite(na) ? na : 0)
  })
  return matches[0]
}

function listRowFromDealAndInvestors(
  listRow: DealListRow,
  inv: DealInvestorRow | undefined,
  committed: number,
): InvestmentListRow {
  const dealId = listRow.id
  return {
    id: investmentRuntimeIdForDeal(dealId),
    dealId,
    investmentName: listRow.dealName?.trim() || "—",
    offeringName: (inv?.investorClass || listRow.investorClass || "—").trim() || "—",
    investmentProfile: (inv?.entitySubtitle || inv?.displayName || "—")
      .trim() || "—",
    investedAmount: committed,
    distributedAmount: 0,
    currentValuation: "—",
    dealCloseDate: (listRow.closeDateDisplay || "—").trim() || "—",
    status: (listRow.dealStage || "—").trim() || "—",
    actionRequired: "None",
    archived: false,
  }
}

/**
 * One row per deal where the viewer’s committed amount is positive.
 */
export async function loadInvestmentListRowsFromDeals(): Promise<InvestmentListRow[]> {
  const em = getSessionUserEmail()
  if (!em?.trim()) return []
  const emn = normEmail(em)
  const list = applyLpSessionDealIdScope(
    await fetchDealsList({ includeParticipantDeals: true }),
  )
  const active = list.filter((r) => !r.archived)
  if (active.length === 0) return []

  const out: InvestmentListRow[] = []
  for (const row of active) {
    const payload = await fetchDealInvestors(row.id, { lpInvestorsOnly: false })
    const committed = committedAmountForViewerEmail(payload, emn)
    if (committed <= 0) continue
    const inv = primaryViewerRow(payload.investors, emn)
    out.push(listRowFromDealAndInvestors(row, inv, committed))
  }
  return out
}

function defaultDetailRecord(list: InvestmentListRow, deal: DealDetailApi): InvestmentDetailRecord {
  return {
    id: list.id,
    list,
    propertyName: deal.propertyName?.trim() || deal.dealName || "—",
    propertyType: (deal.listRow?.propertyType || "Other").trim() || "Other",
    propertyStatus: "Other",
    city: (deal.city || "—").trim() || "—",
    state: (deal.state || "—").trim() || "—",
    numberOfUnits: "—",
    occupancyPct: "—",
    ownedSince: "—",
    yearBuilt: "—",
    investedAs: "Limited partner",
    ownershipPct: "—",
    generalComments: "",
    overallAssetValue: "0",
    netOperatingIncome: "0",
    outstandingLoans: "0",
    debtService: "0",
    loanType: "Other",
    ioOrAmortizing: "Amortizing",
    maturityDate: "—",
    lender: "—",
    interestRatePct: "—",
  }
}

/**
 * Detail view for a deal the viewer has invested in (server-backed when not in localStorage).
 * `investmentIdOrDealId` may be a deal id or a `runtime-…` id (resolved via local row’s `dealId`).
 */
export async function loadInvestmentDetailFromDeal(
  investmentIdOrDealId: string,
): Promise<InvestmentDetailRecord | undefined> {
  let did = investmentIdOrDealId.trim()
  if (!did) return undefined
  if (did.startsWith("runtime-")) {
    const fromStore = readRuntimeInvestmentRowById(did)
    const resolved = fromStore?.dealId?.trim()
    if (resolved) did = resolved
    else return undefined
  }
  const em = getSessionUserEmail()
  if (!em?.trim()) return undefined
  const emn = normEmail(em)
  let deal: DealDetailApi
  let payload: Awaited<ReturnType<typeof fetchDealInvestors>>
  try {
    ;[deal, payload] = await Promise.all([
      fetchDealById(did),
      fetchDealInvestors(did, { lpInvestorsOnly: false }),
    ])
  } catch {
    return undefined
  }
  const committed = committedAmountForViewerEmail(payload, emn)
  if (committed <= 0) return undefined
  const inv = primaryViewerRow(payload.investors, emn)
  const list = listRowFromDealAndInvestors(deal.listRow, inv, committed)
  return defaultDetailRecord(list, deal)
}
