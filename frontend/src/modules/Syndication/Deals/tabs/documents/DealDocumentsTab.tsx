import { useCallback, useEffect, useState } from "react"
import type { DealDetailApi } from "../../api/dealsApi"
import { DocumentsSection } from "./DocumentsSection"
import "../../deal-offering-details.css"
import "../deal_members/add-investment/add_deal_modal.css"
import {
  readOfferingPreviewInvestorVisibility,
  writeOfferingPreviewInvestorVisibility,
} from "../../utils/offeringPreviewInvestorVisibility"
import { scheduleOfferingInvestorPreviewServerSync } from "../../utils/offeringPreviewServerState"

type DealDocumentsTabProps = {
  dealId: string
  investorsListRefreshKey?: number
  onOfferingPreviewSynced?: (deal: DealDetailApi) => void
}

export function DealDocumentsTab({
  dealId,
  investorsListRefreshKey = 0,
  onOfferingPreviewSynced,
}: DealDocumentsTabProps) {
  const [documentsInvestorLink, setDocumentsInvestorLink] = useState(true)

  useEffect(() => {
    setDocumentsInvestorLink(
      readOfferingPreviewInvestorVisibility(dealId).documents,
    )
  }, [dealId])

  const onDocumentsInvestorLinkChange = useCallback(
    (checked: boolean) => {
      const full = readOfferingPreviewInvestorVisibility(dealId)
      writeOfferingPreviewInvestorVisibility(dealId, {
        ...full,
        documents: checked,
      })
      setDocumentsInvestorLink(checked)
      scheduleOfferingInvestorPreviewServerSync(dealId, {
        onSuccess: onOfferingPreviewSynced,
      })
    },
    [dealId, onOfferingPreviewSynced],
  )

  return (
    <div className="deal_documents_tab_root">
      <div className="deal_offering_top deal_documents_tab_intro">
        <div className="deal_offering_top_row">
          <div className="deal_offering_intro_block">
            <p className="deal_offering_intro deal_documents_tab_lead">
              Add PDFs or external links for the offering preview.{" "}
              <strong>Make it visible to Investors</strong> must be on, or
              documents won’t show in <strong>Preview offering</strong> or on the{" "}
              <strong>shared investor link</strong>. In each section’s table,{" "}
              <strong>Visibility</strong> (scroll the table on narrow screens)
              means: <strong>Offering page</strong> — preview, shared link, and
              portal; <strong>LP Investor</strong> —{" "}
              <em>only</em> when an LP is logged in on the deal in the portal, not
              on the no-login shared link. Use <strong>Shared With</strong> on each
              file to pick deal classes, <strong>All Investors</strong>, and/or
              individual investors (deal members appear there as investors; name and
              email) when you want to note who the document is for.
            </p>
          </div>
          <label className="deal_documents_tab_investor_toggle">
            <input
              type="checkbox"
              checked={documentsInvestorLink}
              onChange={(e) =>
                onDocumentsInvestorLinkChange(e.target.checked)
              }
              aria-label="Make documents visible to investors in preview and shared link"
            />
            <span className="deal_documents_tab_investor_toggle_label">
              Make it visible to Investors
            </span>
          </label>
        </div>
      </div>
      <div className="deal_offering_stack" role="list">
        <section
          className="deal_offering_section deal_documents_list_section"
          role="listitem"
          aria-label="Offering documents"
        >
          <DocumentsSection
            key={dealId}
            dealId={dealId}
            investorsListRefreshKey={investorsListRefreshKey}
            onOfferingPreviewSynced={onOfferingPreviewSynced}
          />
        </section>
      </div>
    </div>
  )
}
