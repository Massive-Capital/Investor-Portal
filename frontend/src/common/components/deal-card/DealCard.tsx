import { CameraOff, CircleDot, MapPin } from "lucide-react"
import { dealStageChipCompactClassName } from "../../../modules/Syndication/Deals/utils/dealStageChip"
import "../../../modules/Syndication/Deals/deals-list.css"
import "./deal-card.css"

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
}

export function DealCard({
  title,
  location,
  statusLabel,
  dealStage = null,
  metrics,
  coverImageUrl,
  onUploadCoverClick,
}: DealCardProps) {
  const hasCover = Boolean(coverImageUrl?.trim())

  return (
    <article className="deal_card">
      <div className="deal_card_top">
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
                  Upload cover photo
                </button>
              ) : (
                <span className="deal_card_upload_muted">Upload cover photo</span>
              )}
            </div>
          )}
        </div>
        <section className="deal_card_top_right">
            <span
            className={`deal_card_status ${dealStageChipCompactClassName(dealStage)}`}
            title={`Stage: ${statusLabel}`}
          >
            <span className="deals_list_stage_badge_icon" aria-hidden>
              <CircleDot size={12} strokeWidth={2} />
            </span>
            <span className="deal_card_status_label">{statusLabel}</span>
          </span>
          <div className="deal_card_top_text">
            <div className="deal_card_head">
              <h3 className="deal_card_title">
                <span className="deal_card_title_text">{title}</span>
              </h3>
              {location ? (
                <p className="deal_card_location">
                  <MapPin size={16} className="deal_card_location_icon" aria-hidden />
                  <span className="deal_card_location_text">{location}</span>
                </p>
              ) : null}
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
        <dl className="deal_card_metrics">
          {metrics.map(({ label, value }) => (
            <div key={label} className="deal_card_metric">
              <dt className="deal_card_metric_label">{label}</dt>
              <dd className="deal_card_metric_value">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </article>
  )
}

// Review UI is commented out in JSX; optional review* props stay on DealCardProps for callers.
