/**
 * Keep the “Investments” local row in sync with the same rules as
 * `DealDetailPage` → LP “Invest now” (committed amount, profile, deal name).
 * Usable for any user who has an investor row (not only a platform admin or LP
 * in preview): syndicating add/edit investment, or after the investors list refetch.
 */
import { getSessionUserEmail } from "@/common/auth/sessionUserEmail"
import { committedAmountForViewerEmail } from "@/modules/Investing/utils/investingViewerDealScope"
import type { DealDetailApi } from "@/modules/Syndication/InvestorPortal/Deals/api/dealsApi"
import type { AddInvestmentFormValues } from "@/modules/Syndication/InvestorPortal/Deals/deal-members/add-investment/add_deal_member_types"
import { formatInvestedAsFromInv } from "./investedAsDisplay"
import { investorProfileLabel } from "@/modules/Syndication/InvestorPortal/Deals/constants/investor-profile"
import type {
  DealInvestorRow,
  DealInvestorsPayload,
} from "@/modules/Syndication/InvestorPortal/Deals/types/deal-investors.types"
import { parseMoneyDigits } from "@/modules/Syndication/InvestorPortal/Deals/utils/offeringMoneyFormat"
import { upsertRuntimeInvestmentRow } from "./investmentsRuntimeStore"

function normEmail(s: string): string {
  return s.trim().toLowerCase()
}

function pickPrimaryViewerRow(
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

function formatDealCloseDateForInvestments(raw: string | undefined | null): string {
  const t = String(raw ?? "").trim()
  if (!t) return "—"
  const d = new Date(t)
  if (!Number.isFinite(d.getTime())) return t
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

/**
 * When the add/edit investment form is for the signed-in contact, mirror
 * `handleLpInvestNowSuccess` (same `upsertRuntimeInvestmentRow` fields).
 */
export function upsertRuntimeFromViewerAddInvestmentForm(input: {
  dealId: string
  values: AddInvestmentFormValues
  dealDetail: DealDetailApi | null | undefined
}): void {
  const em = getSessionUserEmail()?.trim().toLowerCase() ?? ""
  if (!em) return
  const formEmail = String(input.values.contactEmail ?? "").trim().toLowerCase()
  if (!formEmail || formEmail !== em) return
  const n = parseMoneyDigits(String(input.values.commitmentAmount ?? "").trim())
  if (!Number.isFinite(n) || n <= 0) return
  const deal = input.dealDetail
  const investmentName =
    deal?.dealName?.trim() || deal?.propertyName?.trim() || "Deal"
  const pid = String(input.values.profileId ?? "").trim()
  upsertRuntimeInvestmentRow({
    dealId: input.dealId.trim(),
    investmentName,
    offeringName: investmentName,
    investmentProfile: pid ? investorProfileLabel(pid) : "—",
    commitmentProfileId: pid || undefined,
    investedAmount: n,
    distributedAmount: 0,
    currentValuation: deal?.offeringSize?.trim() || "—",
    dealCloseDate: formatDealCloseDateForInvestments(deal?.closeDate),
    status: "Active",
    actionRequired: "None",
  })
}

/**
 * After the investors API returns (full or LP-scoped), sync the runtime row
 * for the current user when the payload shows a positive committed amount
 * (same as LP invest success re-reading the roster).
 * Uses the full `listRow` on `dealDetail` when available for display fields.
 */
export function upsertRuntimeForViewerFromInvestorsPayload(
  dealId: string,
  payload: DealInvestorsPayload,
  dealDetail: DealDetailApi | null | undefined,
): void {
  const em = getSessionUserEmail()
  if (!em?.trim()) return
  const emn = normEmail(em)
  const committed = committedAmountForViewerEmail(payload, emn)
  if (committed <= 0) return
  const inv = pickPrimaryViewerRow(payload.investors, emn)
  const deal = dealDetail
  const listRow = deal?.listRow
  const investmentName =
    listRow?.dealName?.trim() ||
    deal?.dealName?.trim() ||
    deal?.propertyName?.trim() ||
    "Deal"
  /** Match list API: offering column is the deal/offering name, not share class. */
  const offeringName = investmentName
  const investmentProfile = formatInvestedAsFromInv(inv, undefined)
  upsertRuntimeInvestmentRow({
    dealId: dealId.trim(),
    investmentName,
    offeringName,
    investmentProfile,
    commitmentProfileId: inv
      ? String(inv.profileId ?? "").trim() || undefined
      : undefined,
    userInvestorProfileId: inv
      ? String(inv.userInvestorProfileId ?? "").trim() || undefined
      : undefined,
    userInvestorProfileName: inv
      ? String(inv.userInvestorProfileName ?? "").trim() || undefined
      : undefined,
    investedAmount: committed,
    distributedAmount: 0,
    currentValuation: deal?.offeringSize?.trim() || "—",
    dealCloseDate: (listRow?.closeDateDisplay || "—").trim() || "—",
    status: (listRow?.dealStage || "Active").trim() || "Active",
    actionRequired: "None",
  })
}
