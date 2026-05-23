import type { DealInvestorClass } from "@/modules/Syndication/Deals/types/deal-investor-class.types"
import type { DealInvestorRow } from "@/modules/Syndication/Deals/types/deal-investors.types"
import type { NestedPreviewDocument } from "@/modules/Syndication/Deals/utils/offeringPreviewDocSections"
export type InvestmentDocumentAudienceContext = {
  viewerRows: DealInvestorRow[]
  dealClasses: DealInvestorClass[]
  /** All investor row ids for this viewer (email match), for Shared With id resolution. */
  viewerInvestorIds: ReadonlySet<string>
}

function investorRowMatchesDealClass(
  row: DealInvestorRow,
  classId: string,
  dealClasses: DealInvestorClass[],
): boolean {
  const rowClass = row.investorClass?.trim()
  if (!rowClass || rowClass === "—") return false
  if (rowClass === classId) return true
  const cls = dealClasses.find((c) => c.id === classId)
  const className = cls?.name?.trim()
  return Boolean(className && rowClass === className)
}

function hasExplicitDocumentAudience(doc: NestedPreviewDocument): boolean {
  return (
    doc.sharedWithAllInvestors ||
    doc.sharedDealClassIds.length > 0 ||
    doc.sharedInvestorIds.length > 0 ||
    (doc.sharedSponsorUserIds?.length ?? 0) > 0
  )
}

/**
 * Workspace document is visible when Shared With targets this investor (or everyone),
 * or when no audience is selected (all LPs allowed by the section).
 */
export function nestedDocumentVisibleToInvestor(
  doc: NestedPreviewDocument,
  ctx: InvestmentDocumentAudienceContext,
): boolean {
  if (!hasExplicitDocumentAudience(doc)) return true
  if (doc.sharedWithAllInvestors) return true

  const { viewerRows, dealClasses, viewerInvestorIds } = ctx

  for (const id of doc.sharedInvestorIds) {
    if (viewerInvestorIds.has(id)) return true
  }

  for (const row of viewerRows) {
    if (doc.sharedInvestorIds.includes(row.id)) return true
  }

  for (const classId of doc.sharedDealClassIds) {
    for (const row of viewerRows) {
      if (investorRowMatchesDealClass(row, classId, dealClasses)) return true
    }
  }

  for (const sponsorUid of doc.sharedSponsorUserIds ?? []) {
    const key = sponsorUid.trim().toLowerCase()
    if (!key) continue
    for (const row of viewerRows) {
      if (row.addedByUserId?.trim().toLowerCase() === key) return true
    }
  }

  return false
}
