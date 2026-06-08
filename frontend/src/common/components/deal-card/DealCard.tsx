import { ArrowRight, CameraOff, CircleDot, MapPin } from "lucide-react"
import { useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { CardCompactAmount } from "@/common/components/card-compact-amount/CardCompactAmount"
import { InvestNowDraftProgressBar } from "@/modules/Investing/pages/invest/InvestNowDraftProgressBar"
import type { InvestNowDraftProgress } from "@/modules/Investing/pages/invest/investNowDraftProgress"
import type { InvestNowDraftResumeScope } from "@/modules/Investing/pages/invest/investNowDraftUtils"
import type { InvestNowLocationState } from "@/modules/Investing/pages/invest/investNowLocationState"
import type { InvestNowStepperPhase } from "@/modules/Investing/pages/invest/investNowFlowSteps"
import { dealInvestNowPath } from "@/modules/Syndication/Deals/utils/dealInvestNowPath"
import { dealStageChipCompactClassName } from "../../../modules/Syndication/Deals/utils/dealStageChip"
import "../../../modules/Syndication/Deals/deals-list.css"
import "./deal-card.css"

const DEAL_CARD_MONEY_METRIC_LABELS = new Set([
  "Target amount",
  "Total accepted",
  "Total funded",
  "Total distributions",
  "Minimum investment",
  "Offering size",
  "Total in-progress",
])

function renderDealCardMetricValue(label: string, value: string) {
  if (value === "—" || !DEAL_CARD_MONEY_METRIC_LABELS.has(label)) return value
  return (
    <CardCompactAmount
      amount={value}
      valueClassName="deal_card_metric_value_text"
    />
  )
}

export interface DealCardMetric {
  label: string
  value: string
}

interface DealCardProps {
  title: string
  location?: string
  statusLabel: string
  /** API deal stage (drives same colours as the deals data table) */
  dealStage?: string | null
  /** When set, overrides default stage chip class on the status badge. */
  statusBadgeClassName?: string
  /** Hide the default stage dot icon (e.g. offering-status emoji badges). */
  hideStatusIcon?: boolean
  /** Preview-only copy shown under metrics (investor dashboard). */
  previewNotice?: { message: string; tooltip?: string } | null
  metrics: DealCardMetric[]
  /** First uploaded asset image from the deal (full URL) */
  coverImageUrl?: string
  onUploadCoverClick?: () => void
  /**
   * Stable seed for {@link USE_DEAL_CARD_PLACEHOLDER_REVIEWS} (e.g. deal id).
   * Falls back to `title` when missing.
   */
  reviewPlaceholderSeed?: string
  /**
   * When true, placeholder reviews are hidden until the summary request settles
   * (avoids flashing random values before API returns).
   */
  reviewLoading?: boolean
  /** Average rating 0–5; if omitted, cards show 4.5 for display until API is wired */
  reviewRating?: number
  reviewCount?: number
  /** light.html prestige-card horizontal layout (dashboard grid) */
  prestigeLayout?: boolean
  /** Saved Invest Now wizard progress (investing dashboard draft deals). */
  investNowDraftProgress?: InvestNowDraftProgress | null
  /** Deal id — required for onboarding phase navigation from the progress panel. */
  dealId?: string
  investNowResumeScope?: InvestNowDraftResumeScope | null
  investNowReturnTo?: string
}

export function DealCard({
  title,
  location,
  statusLabel,
  dealStage = null,
  statusBadgeClassName,
  hideStatusIcon = false,
  previewNotice = null,
  metrics,
  coverImageUrl,
  onUploadCoverClick,
  prestigeLayout = false,
  investNowDraftProgress = null,
  dealId,
  investNowResumeScope = null,
  investNowReturnTo = "/dashboard",
}: DealCardProps) {
  const navigate = useNavigate()
  const hasCover = Boolean(coverImageUrl?.trim())

  const openInvestNowPhase = useCallback(
    (phaseId: InvestNowStepperPhase["id"]) => {
      const id = dealId?.trim()
      if (!id || !investNowDraftProgress) return
      navigate(dealInvestNowPath(id), {
        state: {
          returnTo: investNowReturnTo,
          mode: "resume",
          phaseId,
          investmentId: investNowResumeScope?.investmentId,
          userInvestorProfileId: investNowResumeScope?.userInvestorProfileId,
          profileId: investNowResumeScope?.profileId,
        } satisfies InvestNowLocationState,
      })
    },
    [
      dealId,
      investNowDraftProgress,
      investNowResumeScope,
      investNowReturnTo,
      navigate,
    ],
  )

  const statusBadge = (
    <span
      className={
        statusBadgeClassName ??
        `deal_card_status ${dealStageChipCompactClassName(dealStage)}`
      }
      title={previewNotice?.tooltip ?? `Stage: ${statusLabel}`}
    >
      {!hideStatusIcon ? (
        <span className="deals_list_stage_badge_icon" aria-hidden>
          <CircleDot size={12} strokeWidth={2} />
        </span>
      ) : null}
      <span className="deal_card_status_label">{statusLabel}</span>
    </span>
  )

  const mediaBlock = (
    <div className="deal_card_media">
      {hasCover ? (
        <img
          src={coverImageUrl}
          alt={`Property image for ${title}`}
          className="deal_card_cover"
          loading="eager"
          fetchPriority="high"
          decoding="async"
        />
      ) : (
        <div className="deal_card_media_placeholder">
          <CameraOff size={40} strokeWidth={1.25} aria-hidden />
          {onUploadCoverClick ? (
            <button
              type="button"
              className="deal_card_upload_btn"
              onClick={onUploadCoverClick}
            >
              Upload photo
            </button>
          ) : (
            <span className="deal_card_upload_muted">Upload photo</span>
          )}
        </div>
      )}
    </div>
  )

  const titleBlock = (
    <>
      <h3 className="deal_card_title">
        <span className="deal_card_title_text">{title}</span>
      </h3>
      {location ? (
        <p className="deal_card_location">
          <MapPin size={16} className="deal_card_location_icon" aria-hidden />
          <span className="deal_card_location_text">{location}</span>
        </p>
      ) : null}
    </>
  )

  const metricsBlock = (
    <dl className="deal_card_metrics">
      {metrics.map(({ label, value }) => (
        <div key={label} className="deal_card_metric">
          <dt className="deal_card_metric_label">{label}</dt>
          <dd className="deal_card_metric_value">
            {renderDealCardMetricValue(label, value)}
          </dd>
        </div>
      ))}
    </dl>
  )

  if (prestigeLayout) {
    return (
      <article className="deal_card deal_card--prestige">
        {statusBadge}
        <div className="deal_card_prestige_row">
          {mediaBlock}
          <div className="deal_card_prestige_body">
            <div className="deal_card_prestige_main">
              <div className="deal_card_prestige_head">{titleBlock}</div>
              {metricsBlock}
              {previewNotice?.message ? (
                <p
                  className="deal_card_preview_notice"
                  title={previewNotice.tooltip}
                >
                  {previewNotice.message}
                </p>
              ) : null}
            </div>
            {investNowDraftProgress ? (
              <>
                <div className="invest_now_onboarding_panel deal_card_prestige_progress_panel">
                  <div className="invest_now_onboarding_panel_body">
                    <InvestNowDraftProgressBar
                      embedded
                      progress={investNowDraftProgress}
                      phaseNav={{
                        onPhaseClick: openInvestNowPhase,
                        currentStepOnly: true,
                      }}
                    />
                  </div>
                </div>
                <div className="deal_card_prestige_footer">
                  <span className="deal_card_manage_cta">
                    Manage Deal
                    <ArrowRight size={18} strokeWidth={2} aria-hidden />
                  </span>
                </div>
              </>
            ) : (
              <div className="deal_card_prestige_footer">
                <span className="deal_card_manage_cta">
                  Manage Deal
                  <ArrowRight size={18} strokeWidth={2} aria-hidden />
                </span>
              </div>
            )}
          </div>
        </div>
      </article>
    )
  }

  return (
    <article className="deal_card">
      <div className="deal_card_top">
        {mediaBlock}
        <section className="deal_card_top_right">
            {!prestigeLayout ? statusBadge : null}
          <div className="deal_card_top_text">
            <div className="deal_card_head">
              {titleBlock}
              {/* <div
                className="deal_card_reviews"
                role="group"
                aria-label={
                  hasReviewCount
                    ? `${displayReviewCount} ${
                        displayReviewCount === 1 ? "Review" : "Reviews"
                      }. ${displayRating.toFixed(1)} of 5 stars average`
                    : `${DEAL_CARD_REVIEW_DEFAULT_TEXT}. ${displayRating.toFixed(1)} of 5 stars average`
                }
              >
                <div className="deal_card_reviews_stars" aria-hidden>
                  {dealCardStarRow(displayRating).map((kind, i) => {
                    if (kind === "full")
                      return (
                        <Star
                          key={i}
                          className="deal_card_star deal_card_star_full"
                          size={16}
                          strokeWidth={1.5}
                          fill="currentColor"
                        />
                      )
                    if (kind === "half")
                      return (
                        <StarHalf
                          key={i}
                          className="deal_card_star deal_card_star_half"
                          size={16}
                          strokeWidth={1.5}
                        />
                      )
                    return (
                      <Star
                        key={i}
                        className="deal_card_star deal_card_star_empty"
                        size={16}
                        strokeWidth={1.5}
                      />
                    )
                  })}
                </div>
                <span className="deal_card_reviews_count" aria-hidden>
                  {displayReviewCount}{" "}
                  {displayReviewCount === 1 ? "Review" : "Reviews"}
                </span>
                {showNoReviewsYetLabel ? (
                  <span className="deal_card_reviews_muted" aria-hidden>
                    {DEAL_CARD_REVIEW_DEFAULT_TEXT}
                  </span>
                ) : null}
              </div> */}
            </div>
          </div>
        </section>
      </div>
      <div className="deal_card_details">
        {metricsBlock}
        {previewNotice?.message ? (
          <p
            className="deal_card_preview_notice"
            title={previewNotice.tooltip}
          >
            {previewNotice.message}
          </p>
        ) : null}
      </div>
    </article>
  )
}

// Review UI is commented out in JSX; optional review* props stay on DealCardProps for callers.
