import { useCallback, useEffect, useState } from "react"
import type { DealDetailApi } from "../api/dealsApi"
import { DocumentsSection } from "./DocumentsSection"
import "../deal-offering-details.css"
import "../deal-members/add-investment/add_deal_modal.css"
import {
  readOfferingPreviewInvestorVisibility,
  writeOfferingPreviewInvestorVisibility,
} from "../utils/offeringPreviewInvestorVisibility"
import { scheduleOfferingInvestorPreviewServerSync } from "../utils/offeringPreviewServerState"

type DealDocumentsTabProps = {
  dealId: string
  onOfferingPreviewSynced?: (deal: DealDetailApi) => void
}

export function DealDocumentsTab({
  dealId,
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
      <div className="deal_documents_tab_panel">
        <header className="deal_documents_tab_header">
          <div className="deal_documents_tab_header_text">
            <p className="deal_documents_tab_lead">
              Add PDFs or external links for the offering preview.{" "}
              <strong>Make it visible to Investors</strong> turns this list on or
              off in <strong>Preview offering</strong> and on the{" "}
              <strong>shared investor link</strong>.
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
        </header>
        <DocumentsSection
          key={dealId}
          dealId={dealId}
          onOfferingPreviewSynced={onOfferingPreviewSynced}
        />
      </div>
    </div>
  )
}
