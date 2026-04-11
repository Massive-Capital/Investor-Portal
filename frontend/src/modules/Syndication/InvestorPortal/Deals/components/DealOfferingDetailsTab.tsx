import { ChevronDown, Eye, Plus } from "lucide-react"
import { useId, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import type { DealDetailApi } from "../api/dealsApi"
import { InvestorSummarySection } from "./InvestorSummarySection"
import { OfferingGallerySection } from "./OfferingGallerySection"
import "../deal-offering-details.css"
import { AssetsSection } from "./AssetsSection"
// import { DocumentsSection } from "./DocumentsSection"
import { KeyHighlightsSection } from "./KeyHighlightsSection"
import { FundingInfoSection } from "./FundingInfoSection"
import { OfferingAnnouncementSection } from "./OfferingAnnouncementSection"
import { OfferingInformationSection } from "./OfferingInformationSection"
import { OfferingOverviewSection } from "./OfferingOverviewSection"
import "../deal-members/add-investment/add_deal_modal.css"
interface DealOfferingDetailsTabProps {
  detail: DealDetailApi
  onDealUpdated?: (deal: DealDetailApi) => void
}

type SectionId =
  | "make_announcement"
  | "overview"
  | "offering_information"
  | "gallery"
  | "summary"
  // | "documents"
  | "assets"
  | "key_highlights"
  | "funding_instructions"

const SECTION_ORDER: { id: SectionId; label: string }[] = [
  { id: "make_announcement", label: "Make announcement" },
  { id: "overview", label: "Overview" },
  { id: "offering_information", label: "Classes" },
  { id: "gallery", label: "Gallery" },
  { id: "summary", label: "Summary" },
  // { id: "documents", label: "Documents" },
  { id: "assets", label: "Assets" },
  { id: "key_highlights", label: "Key Highlights" },
  { id: "funding_instructions", label: "Funding Info" },
]

function initialSectionsOpen(): Record<SectionId, boolean> {
  const o = {} as Record<SectionId, boolean>
  SECTION_ORDER.forEach(({ id }, i) => {
    o[id] = i === 0
  })
  return o
}

export function DealOfferingDetailsTab({
  detail,
  onDealUpdated,
}: DealOfferingDetailsTabProps) {
  const navigate = useNavigate()
  const baseId = useId()
  const [openSections, setOpenSections] = useState(initialSectionsOpen)

  function sectionBody(id: SectionId) {
    switch (id) {
      case "make_announcement":
        return (
          <OfferingAnnouncementSection
            dealId={detail.id}
            initialTitle={detail.dealAnnouncementTitle}
            initialMessage={detail.dealAnnouncementMessage}
            onSaved={(d) => onDealUpdated?.(d)}
          />
        )
      case "overview":
        return (
          <OfferingOverviewSection
            detail={detail}
            onSaved={(d) => onDealUpdated?.(d)}
          />
        )
      case "offering_information":
        return <OfferingInformationSection dealId={detail.id} />
      case "gallery":
        return (
          <OfferingGallerySection
            detail={detail}
            onDealUpdated={onDealUpdated}
          />
        )
      case "summary":
        return (
          <InvestorSummarySection
            dealId={detail.id}
            initialStoredHtml={detail.investorSummaryHtml}
            onSaved={(d) => onDealUpdated?.(d)}
          />
        )
      // case "documents":
      //   return <DocumentsSection />
      case "assets":
        return <AssetsSection key={detail.id} detail={detail} />
      case "key_highlights":
        return (
          <KeyHighlightsSection
            dealId={detail.id}
            initialStoredJson={detail.keyHighlightsJson}
            onSaved={(d) => onDealUpdated?.(d)}
          />
        )
      case "funding_instructions":
        return <FundingInfoSection />
      default:
        return null
    }
  }

  return (
    <div className="deal_offering_root">
      <div className="deal_offering_top">
        <div className="deal_offering_top_row">
          <div className="deal_offering_intro_block">
            <p className="deal_offering_intro">
              Configure sections below, then open the investor-facing preview to
              see how this offering reads end-to-end.
            </p>
          </div>
          <button
            type="button"
            className="deal_offering_preview_btn"
            onClick={() =>
              navigate(
                `/deals/${encodeURIComponent(detail.id)}/offering-portfolio`,
              )
            }
          >
            <Eye size={18} strokeWidth={2} aria-hidden />
            <span>Preview offering</span>
          </button>
        </div>
        {/* <dl
          className="deal_offering_metrics"
          aria-label="Key offering figures"
        >
          <div className="deal_offering_metric">
            <dt>Offering size</dt>
            <dd>{offeringSizeDisplay}</dd>
          </div>
          <div className="deal_offering_metric">
            <dt>Raise target</dt>
            <dd>{raiseTargetDisplay}</dd>
          </div>
          <div className="deal_offering_metric">
            <dt>Investors</dt>
            <dd title="Total number of investors">
              {investorsDisplay}
            </dd>
          </div>
          <div className="deal_offering_metric">
            <dt>Total accepted</dt>
            <dd>{totalAcceptedDisplay}</dd>
          </div>
        </dl> */}
      </div>
      <div className="deal_offering_stack" role="list">
        {SECTION_ORDER.map(({ id, label }) => {
          const expanded = Boolean(openSections[id])
          const panelId = `${baseId}-${id}`
          return (
            <div
              key={id}
              className={`deal_offering_section${expanded ? " deal_offering_section_expanded" : ""}`}
              role="listitem"
            >
              {id === "offering_information" ? (
                <div className="deal_offering_trigger_row">
                  <button
                    type="button"
                    id={`${panelId}-trigger`}
                    className="deal_offering_trigger_toggle"
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    onClick={() =>
                      setOpenSections((prev) => ({
                        ...prev,
                        [id]: !prev[id],
                      }))
                    }
                  >
                    <span className="deal_offering_trigger_label">
                      {label}
                    </span>
                  </button>
                  <Link
                    to={`/deals/${encodeURIComponent(detail.id)}/investor-classes/new`}
                    className="um_btn_primary deal_offering_add_ic_btn deal_offering_add_ic_header"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Plus size={18} strokeWidth={2} aria-hidden />
                    Add Investor Class
                  </Link>
                  <button
                    type="button"
                    className="deal_offering_trigger_chevron_btn"
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    aria-label={
                      expanded
                        ? `Collapse ${label}`
                        : `Expand ${label}`
                    }
                    onClick={() =>
                      setOpenSections((prev) => ({
                        ...prev,
                        [id]: !prev[id],
                      }))
                    }
                  >
                    <ChevronDown
                      size={20}
                      strokeWidth={2}
                      aria-hidden
                      className={`deal_offering_chevron${expanded ? " deal_offering_chevron_open" : ""}`}
                    />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  id={`${panelId}-trigger`}
                  className="deal_offering_trigger"
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  onClick={() =>
                    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }))
                  }
                >
                  <span className="deal_offering_trigger_label">{label}</span>
                  <ChevronDown
                    size={20}
                    strokeWidth={2}
                    aria-hidden
                    className={`deal_offering_chevron${expanded ? " deal_offering_chevron_open" : ""}`}
                  />
                </button>
              )}
              <div
                id={panelId}
                role="region"
                aria-labelledby={`${panelId}-trigger`}
                hidden={!expanded}
                className="deal_offering_panel"
              >
                {expanded ? sectionBody(id) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
