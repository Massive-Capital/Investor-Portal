import { applyOfferingInvestorPreviewJsonFromServer } from "@/modules/Syndication/Deals/utils/offeringPreviewServerState"

/** Hydrate local document sections from server `offeringInvestorPreviewJson`. */
export function syncInvestmentDealDocumentPreview(
  dealId: string,
  offeringInvestorPreviewJson: string | null | undefined,
  opts?: { notify?: boolean },
): void {
  const id = dealId.trim()
  if (!id) return
  applyOfferingInvestorPreviewJsonFromServer(id, offeringInvestorPreviewJson, opts)
}
