import type { LucideIcon } from "lucide-react"
import { useId } from "react"
import { Sparkline, sparklineFromSeed } from "./Sparkline"

export type MetricTone = "blue" | "green" | "amber" | "violet" | "slate" | "rose"

const TONE_COLORS: Record<MetricTone, string> = {
  blue: "#3b82f6",
  green: "#22c55e",
  amber: "#f59e0b",
  violet: "#8b5cf6",
  slate: "#64748b",
  rose: "#f43f5e",
}

type MetricKpiCardProps = {
  label: string
  value: string
  icon: LucideIcon
  tone?: MetricTone
  footer?: string
  subfooter?: string
  loading?: boolean
  sparkSeed?: number
}

export function MetricKpiCard({
  label,
  value,
  icon: Icon,
  tone = "blue",
  footer,
  subfooter,
  loading = false,
  sparkSeed = 1,
}: MetricKpiCardProps) {
  const gradientId = useId()
  const color = TONE_COLORS[tone]
  const points = sparklineFromSeed(sparkSeed)

  return (
    <article className="pm_kpi_card" aria-busy={loading}>
      <div className="pm_kpi_card_head">
        <span className="pm_kpi_label">{label}</span>
        <span className={`pm_kpi_icon pm_kpi_icon_${tone}`} aria-hidden>
          <Icon size={16} strokeWidth={2} />
        </span>
      </div>
      <p className="pm_kpi_value">{loading ? "—" : value}</p>
      <div className="pm_kpi_spark_row">
        <Sparkline
          points={points}
          color={color}
          width={140}
          height={40}
          gradientId={gradientId}
        />
      </div>
      {(footer || subfooter) && !loading ? (
        <div className="pm_kpi_footer">
          {footer ? <span className="pm_kpi_footer_main">{footer}</span> : null}
          {subfooter ? (
            <span className="pm_kpi_footer_sub">{subfooter}</span>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}
