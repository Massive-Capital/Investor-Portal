import { ChevronDown, Eye, Plus } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import type { DealDetailApi } from "../api/dealsApi"
import {
  OFFERING_DETAILS_ACCORDION_SECTION_ORDER,
  offeringSectionHasInvestorPreviewTarget,
  readOfferingPreviewInvestorVisibility,
  writeOfferingPreviewInvestorVisibility,
  type OfferingDetailsSectionId,
} from "../utils/offeringPreviewInvestorVisibility"
import { scheduleOfferingInvestorPreviewServerSync } from "../utils/offeringPreviewServerState"
import { InvestorSummarySection } from "./InvestorSummarySection"
import { OfferingGallerySection } from "./OfferingGallerySection"
import "../deal-offering-details.css"
import { AssetsSection } from "./AssetsSection"
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

function initialSectionsOpen(): Record<OfferingDetailsSectionId, boolean> {
  const o = {} as Record<OfferingDetailsSectionId, boolean>
  OFFERING_DETAILS_ACCORDION_SECTION_ORDER.forEach(({ id }, i) => {
    o[id] = i === 0
  })
  return o
}

export function DealOfferingDetailsTab({
  detail,
  onDealUpdated,
}: DealOfferingDetailsTabProps) {
  const onDealUpdatedRef = useRef(onDealUpdated)
  onDealUpdatedRef.current = onDealUpdated
  const navigate = useNavigate()
  const baseId = useId()
  const [openSections, setOpenSections] = useState(initialSectionsOpen)
  const [investorPreviewVisibility, setInvestorPreviewVisibility] = useState(
    () => readOfferingPreviewInvestorVisibility(detail.id),
  )

  useEffect(() => {
    setInvestorPreviewVisibility(readOfferingPreviewInvestorVisibility(detail.id))
  }, [detail.id])

  useEffect(() => {
    writeOfferingPreviewInvestorVisibility(detail.id, investorPreviewVisibility)
    scheduleOfferingInvestorPreviewServerSync(detail.id, {
      onSuccess: (d) => onDealUpdatedRef.current?.(d),
    })
  }, [detail.id, investorPreviewVisibility])

  function sectionBody(id: OfferingDetailsSectionId) {
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
      case "documents":
        return null
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
              see how this offering reads end-to-end. Offering documents are
              managed in the <strong>Documents</strong> tab. Each row’s{" "}
              <strong>Make it visible to Investors</strong> control sets what
              appears in <strong>Preview offering</strong> and on the{" "}
              <strong>shared investor link</strong> (same sections in both).
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
        {OFFERING_DETAILS_ACCORDION_SECTION_ORDER.map(({ id, label }) => {
          const expanded = Boolean(openSections[id])
          const panelId = `${baseId}-${id}`
          const investorToggle = (
            <label
              className={`deal_offering_investor_preview_toggle${offeringSectionHasInvestorPreviewTarget(id) ? "" : " deal_offering_investor_preview_toggle--muted"}`}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              title={
                offeringSectionHasInvestorPreviewTarget(id)
                  ? "When checked, this block appears in Preview offering and on the shared investor link. Uncheck to hide it in both."
                  : "This section is not mapped to the offering preview page yet; the toggle is reserved for when it is."
              }
            >
              <input
                type="checkbox"
                checked={investorPreviewVisibility[id]}
                onChange={(e) => {
                  e.stopPropagation()
                  setInvestorPreviewVisibility((p) => ({
                    ...p,
                    [id]: e.target.checked,
                  }))
                }}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Make ${label} visible to investors in preview and shared link`}
              />
              <span className="deal_offering_investor_preview_toggle_text">
                Make it visible to Investors
              </span>
            </label>
          )
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
                  {investorToggle}
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
                    <span className="deal_offering_trigger_label">{label}</span>
                  </button>
                  {investorToggle}
                  <button
                    type="button"
                    className="deal_offering_trigger_chevron_btn"
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    aria-label={
                      expanded ? `Collapse ${label}` : `Expand ${label}`
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
