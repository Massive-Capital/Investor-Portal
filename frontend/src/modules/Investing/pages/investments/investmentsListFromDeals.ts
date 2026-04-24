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
import {
  fetchUserInvestorProfileNameMap,
  formatInvestedAsFromInv,
  investorCommitmentTypeFromInv,
  profileNameForInvestmentBreakdown,
} from "./investedAsDisplay"
import { investmentRuntimeIdForDeal, readRuntimeInvestmentRowById } from "./investmentsRuntimeStore"
import type {
  InvestmentBreakdownLine,
  InvestmentDetailRecord,
  InvestmentListRow,
} from "./investments.types"

function normEmail(s: string): string {
  return s.trim().toLowerCase()
}

function primaryViewerRow(
  investors: DealInvestorRow[],
  viewerEmailNorm: string,
): DealInvestorRow | undefined {
  const matches = positiveViewerCommitments(investors, viewerEmailNorm)
  if (matches.length === 0) return undefined
  return matches[0]
}

/** Deal investor rows for this viewer with a positive committed amount, largest first. */
function positiveViewerCommitments(
  investors: DealInvestorRow[],
  viewerEmailNorm: string,
): DealInvestorRow[] {
  const out: { inv: DealInvestorRow; amt: number }[] = []
  for (const inv of investors) {
    if (normEmail(String(inv.userEmail ?? "")) !== viewerEmailNorm) continue
    const amt = parseMoneyDigits(String(inv.committed ?? ""))
    if (Number.isFinite(amt) && amt > 0) out.push({ inv, amt })
  }
  out.sort((a, b) => b.amt - a.amt)
  return out.map((x) => x.inv)
}

/** Split `list.investmentProfile` "Name — Type" for detail fallback when not loading per-field from API. */
function splitListInvestmentProfile(combined: string): {
  profileName: string
  investorType: string
} {
  const t = (combined ?? "").trim()
  if (!t || t === "—") return { profileName: "—", investorType: "—" }
  const idx = t.indexOf(" — ")
  if (idx >= 0) {
    return {
      profileName: t.slice(0, idx).trim() || "—",
      investorType: t.slice(idx + 3).trim() || "—",
    }
  }
  return { profileName: "—", investorType: t }
}

/**
 * One row per **deal commitment** the viewer has on this deal (each `DealInvestorRow` with
 * a positive `committed` amount). That way two investments as Individual with different
 * book profile names (e.g. A and B) always show as two lines with the correct amount on each.
 * The lead “Total for this deal” in the detail tab still uses the list row’s full committed sum.
 */
function buildProfileBreakdownForDeal(
  myCommitments: DealInvestorRow[],
  nameMap: ReadonlyMap<string, string>,
): InvestmentBreakdownLine[] {
  const out: InvestmentBreakdownLine[] = []
  for (const inv of myCommitments) {
    const amt = parseMoneyDigits(String(inv.committed ?? "")) || 0
    if (amt <= 0) continue
    out.push({
      profileName: profileNameForInvestmentBreakdown(inv, nameMap),
      investorType: investorCommitmentTypeFromInv(inv),
      investedAmount: amt,
    })
  }
  return out.sort((a, b) => {
    const byName = (a.profileName || "").localeCompare(
      b.profileName || "",
      "en",
      { sensitivity: "base" },
    )
    if (byName !== 0) return byName
    const byType = (a.investorType || "").localeCompare(
      b.investorType || "",
      "en",
      { sensitivity: "base" },
    )
    if (byType !== 0) return byType
    return (a.investedAmount || 0) - (b.investedAmount || 0)
  })
}

function listRowFromDealAndInvestors(
  listRow: DealListRow,
  inv: DealInvestorRow | undefined,
  committed: number,
  nameByUserProfileId: ReadonlyMap<string, string> | undefined,
): InvestmentListRow {
  const dealId = listRow.id
  const profileId = inv ? String(inv.profileId ?? "").trim() : ""
  const userInvProfId = inv
    ? String(inv.userInvestorProfileId ?? "").trim()
    : ""
  const userInvProfName = inv
    ? String(inv.userInvestorProfileName ?? "").trim()
    : ""
  return {
    id: investmentRuntimeIdForDeal(dealId),
    dealId,
    investmentName: listRow.dealName?.trim() || "—",
    /** Deal/offering title — not investor class (Class A, etc.). */
    offeringName: listRow.dealName?.trim() || "—",
    investmentProfile: formatInvestedAsFromInv(inv, nameByUserProfileId),
    commitmentProfileId: profileId || undefined,
    userInvestorProfileId: userInvProfId || undefined,
    userInvestorProfileName: userInvProfName || undefined,
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
 * When `nameByUserProfileIdFromBook` is omitted, a profile book fetch runs here. Prefer
 * passing the map from `getMergedInvestmentListRows` in `investmentsRuntimeData` to avoid duplicate fetches.
 */
export async function loadInvestmentListRowsFromDeals(
  nameByUserProfileIdFromBook?: ReadonlyMap<string, string>,
): Promise<InvestmentListRow[]> {
  const em = getSessionUserEmail()
  if (!em?.trim()) return []
  const emn = normEmail(em)
  const list = applyLpSessionDealIdScope(
    await fetchDealsList({ includeParticipantDeals: true }),
  )
  const active = list.filter((r) => !r.archived)
  if (active.length === 0) return []

  const nameMap =
    nameByUserProfileIdFromBook ??
    (await fetchUserInvestorProfileNameMap())
  const out: InvestmentListRow[] = []
  for (const row of active) {
    const payload = await fetchDealInvestors(row.id, { lpInvestorsOnly: false })
    const committed = committedAmountForViewerEmail(payload, emn)
    if (committed <= 0) continue
    const inv = primaryViewerRow(payload.investors, emn)
    out.push(listRowFromDealAndInvestors(row, inv, committed, nameMap))
  }
  return out
}

function defaultDetailRecord(
  list: InvestmentListRow,
  deal: DealDetailApi,
  investedAsBreakdown?: InvestmentBreakdownLine[],
): InvestmentDetailRecord {
  const breakdown: InvestmentBreakdownLine[] =
    investedAsBreakdown && investedAsBreakdown.length > 0
      ? investedAsBreakdown
      : (() => {
          const s = splitListInvestmentProfile(
            (list.investmentProfile ?? "").trim() || "—",
          )
          return [
            {
              profileName: s.profileName,
              investorType: s.investorType,
              investedAmount: list.investedAmount,
            },
          ]
        })()
  const investedAsLine =
    breakdown.length > 1
      ? "See table below for each commitment"
      : [
          (breakdown[0]?.profileName ?? "").trim(),
          (breakdown[0]?.investorType ?? "").trim(),
        ]
          .filter((s) => s && s !== "—")
          .join(" — ") || "—"
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
    investedAs: investedAsLine,
    investedAsBreakdown: breakdown,
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
  const myCommitments = positiveViewerCommitments(payload.investors, emn)
  const inv = myCommitments[0]
  const nameMap = await fetchUserInvestorProfileNameMap()
  const list = listRowFromDealAndInvestors(
    deal.listRow,
    inv,
    committed,
    nameMap,
  )
  const investedAsBreakdown = buildProfileBreakdownForDeal(
    myCommitments,
    nameMap,
  )
  return defaultDetailRecord(list, deal, investedAsBreakdown)
}
