import { CameraOff, MapPin } from "lucide-react"
import "./deal-card.css"

export interface DealCardMetric {
  label: string
  value: string
}

interface DealCardProps {
  title: string
  location?: string
  statusLabel: string
  metrics: DealCardMetric[]
  /** First uploaded asset image from the deal (full URL) */
  coverImageUrl?: string
  onUploadCoverClick?: () => void
}

export function DealCard({
  title,
  location,
  statusLabel,
  metrics,
  coverImageUrl,
  onUploadCoverClick,
}: DealCardProps) {
  const hasCover = Boolean(coverImageUrl?.trim())

  return (
    <article className="deal_card">
      <div className="deal_card_media">
        <span className="deal_card_status">{statusLabel}</span>
        {hasCover ? (
          <img
            src={coverImageUrl}
            alt={`Property image for ${title}`}
            className="deal_card_cover"
            loading="lazy"
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
      <div className="deal_card_body">
        <h3 className="deal_card_title">
          <span className="deal_card_title_text">{title}</span>
        </h3>
        {location ? (
          <p className="deal_card_location">
            <MapPin size={16} className="deal_card_location_icon" aria-hidden />
            <span>{location}</span>
          </p>
        ) : null}
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
