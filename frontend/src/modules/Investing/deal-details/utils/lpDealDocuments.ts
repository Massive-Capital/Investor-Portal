import { readOfferingPreviewDocuments } from "@/modules/Syndication/InvestorPortal/Deals/utils/offeringPreviewDocuments"
import {
  readOfferingPreviewSections,
  sectionDisplayLabel,
} from "@/modules/Syndication/InvestorPortal/Deals/utils/offeringPreviewDocSections"

export interface LpDealDocumentRow {
  id: string
  name: string
  url: string | null
  sectionLabel: string
  sharedWithLabel: string
}

/**
 * Resolves document rows for LP portal: nested sections + legacy flat list.
 * Logged-in LPs see both Offering page and LP-only scoped sections.
 */
export function listDocumentsForLpDealPage(dealId: string): LpDealDocumentRow[] {
  const id = dealId.trim()
  if (!id) return []
  const sections = readOfferingPreviewSections(id)
  const out: LpDealDocumentRow[] = []
  for (const sec of sections) {
    const sl = sectionDisplayLabel(sec)
    for (const d of sec.nestedDocuments) {
      out.push({
        id: d.id,
        name: d.name,
        url: d.url,
        sectionLabel: sl,
        sharedWithLabel: sec.visibility,
      })
    }
  }
  if (out.length > 0) return out
  for (const d of readOfferingPreviewDocuments(id)) {
    out.push({
      id: d.id,
      name: d.name,
      url: d.url,
      sectionLabel: "Documents",
      sharedWithLabel:
        d.sharedWithScope === "lp_investor" ? "LP Investor" : "Offering page",
    })
  }
  return out
}
