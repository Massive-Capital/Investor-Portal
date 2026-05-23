import {
  effectiveDocumentSharedWithScope,
  readOfferingPreviewSections,
  sectionDisplayLabel,
  sectionSharedWithDisplay,
  type SectionSharedWithScope,
} from "@/modules/Syndication/Deals/utils/offeringPreviewDocSections"
import { readOfferingPreviewDocuments } from "@/modules/Syndication/Deals/utils/offeringPreviewDocuments"
import type { NestedPreviewDocument } from "@/modules/Syndication/Deals/utils/offeringPreviewDocSections"
import type { InvestmentDocumentAudienceContext } from "./investmentDocumentAudience"
import { nestedDocumentVisibleToInvestor } from "./investmentDocumentAudience"

export type InvestmentDetailDocumentRow = {
  id: string
  name: string
  url: string | null
  sectionLabel: string
  /** How this file is exposed on the deal Documents tab. */
  visibilityLabel: string
  source: "assigned" | "offering_link" | "esign"
  /** Pending eSign — show Sign action (opens in-page modal). */
  canSign?: boolean
  /** Dropbox Sign request for this profile send. */
  signatureRequestId?: string
  /** eSign template profile (individual, joint_tenancy, …). */
  categoryId?: string
}

function rowKey(d: { id: string; url: string | null; name: string }): string {
  const u = d.url?.trim()
  if (u) return `url:${u}`
  return `id:${d.id}:${d.name}`
}

function pushRow(
  out: InvestmentDetailDocumentRow[],
  seen: Set<string>,
  args: {
    id: string
    name: string
    url: string | null
    sectionLabel: string
    scope: SectionSharedWithScope
  },
): void {
  const scope = args.scope
  const source: InvestmentDetailDocumentRow["source"] =
    scope === "offering_page" ? "offering_link" : "assigned"
  const key = rowKey({ id: args.id, url: args.url, name: args.name })
  if (seen.has(key)) return
  seen.add(key)
  out.push({
    id: args.id,
    name: args.name,
    url: args.url,
    sectionLabel: args.sectionLabel,
    visibilityLabel: sectionSharedWithDisplay(scope),
    source,
  })
}

/**
 * Deal Documents tab (sponsor uploads): files this investor may see —
 * LP portal / Shared With targeting, or Offering link visibility.
 */
export function listDocumentsForInvestmentDetail(
  dealId: string,
  audience: InvestmentDocumentAudienceContext,
): {
  assigned: InvestmentDetailDocumentRow[]
  offeringLink: InvestmentDetailDocumentRow[]
  all: InvestmentDetailDocumentRow[]
} {
  const id = dealId.trim()
  if (!id) {
    return { assigned: [], offeringLink: [], all: [] }
  }

  const allRows: InvestmentDetailDocumentRow[] = []
  const seen = new Set<string>()

  const sections = readOfferingPreviewSections(id)
  for (const sec of sections) {
    const sl = sectionDisplayLabel(sec)
    for (const d of sec.nestedDocuments) {
      if (!nestedDocumentVisibleToInvestor(d, audience)) continue
      const scope = effectiveDocumentSharedWithScope(d, sec)
      pushRow(
        allRows,
        seen,
        {
          id: d.id,
          name: d.name,
          url: d.url,
          sectionLabel: sl,
          scope,
        },
      )
    }
  }

  if (allRows.length === 0) {
    for (const d of readOfferingPreviewDocuments(id)) {
      const scope: SectionSharedWithScope =
        d.sharedWithScope === "lp_investor" ? "lp_investor" : "offering_page"
      const legacyDoc: NestedPreviewDocument = {
        id: d.id,
        name: d.name,
        url: d.url,
        dateAdded: d.dateAdded ?? "—",
        lpDisplaySectionId: "",
        sharedDealClassIds: [],
        sharedInvestorIds: [],
        sharedWithAllInvestors: false,
        sharedSponsorUserIds: [],
        sharedWithScope: scope,
      }
      if (!nestedDocumentVisibleToInvestor(legacyDoc, audience)) continue
      pushRow(allRows, seen, {
        id: d.id,
        name: d.name,
        url: d.url,
        sectionLabel: "Documents",
        scope,
      })
    }
  }

  const assigned = allRows.filter((r) => r.source === "assigned")
  const offeringLink = allRows.filter((r) => r.source === "offering_link")
  const sortByName = (a: InvestmentDetailDocumentRow, b: InvestmentDetailDocumentRow) =>
    a.name.localeCompare(b.name, "en", { sensitivity: "base" })

  return {
    assigned: assigned.sort(sortByName),
    offeringLink: offeringLink.sort(sortByName),
    all: [...allRows].sort(sortByName),
  }
}
