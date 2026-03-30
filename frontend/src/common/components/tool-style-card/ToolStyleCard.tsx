import { type LucideIcon, HelpCircle } from "lucide-react"
import type { ReactNode } from "react"
import "./tool-style-card.css"

interface ToolStyleCardProps {
  icon: LucideIcon
  title: string
  description: string
  footer?: ReactNode
  hintTitle?: string
  onClick?: () => void
  className?: string
  /** KPI row: label beside icon, large bold value (description), optional footer */
  variant?: "default" | "metric"
}

export function ToolStyleCard({
  icon: Icon,
  title,
  description,
  footer,
  hintTitle,
  onClick,
  className = "",
  variant = "default",
}: ToolStyleCardProps) {
  const rootClass = [
    "tool_style_card",
    onClick ? "tool_style_card_clickable" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ")

  const hintEl = hintTitle ? (
    <span
      className="tool_style_card_hint"
      title={hintTitle}
      aria-label={hintTitle}
    >
      <HelpCircle size={14} strokeWidth={2} />
    </span>
  ) : null

  const inner =
    variant === "metric" ? (
      <>
        <div className="tool_style_card_metric_top">
          <div className="tool_style_card_icon_box" aria-hidden>
            <Icon className="tool_style_card_icon" size={22} strokeWidth={1.75} />
          </div>
          <div className="tool_style_card_metric_body">
            <div className="tool_style_card_label_cluster">
              <span className="tool_style_card_label_inline">{title}</span>
              {hintEl}
            </div>
            <p className="tool_style_card_value_lead">{description}</p>
          </div>
        </div>
        {footer ? <div className="tool_style_card_footer">{footer}</div> : null}
      </>
    ) : (
      <>
        <div className="tool_style_card_icon_box" aria-hidden>
          <Icon className="tool_style_card_icon" size={22} strokeWidth={1.75} />
        </div>
        <div className="tool_style_card_title_row">
          <h3 className="tool_style_card_title">{title}</h3>
          {hintEl}
        </div>
        <p className="tool_style_card_desc">{description}</p>
        {footer ? <div className="tool_style_card_footer">{footer}</div> : null}
      </>
    )

  if (onClick) {
    return (
      <button type="button" className={rootClass} onClick={onClick}>
        {inner}
      </button>
    )
  }

  return <div className={rootClass}>{inner}</div>
}
