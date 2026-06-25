import { Info } from "lucide-react"
import type { ReactNode } from "react"
import { parseMoneyDigits } from "../../../modules/Syndication/Deals/utils/offeringMoneyFormat"
import {
  formatCardCompactUsdDisplay,
  formatCardCompactUsdExact,
  shouldShowCardCompactUsdTooltip,
} from "../../utils/cardCompactUsdAmount"
import "./card-compact-amount.css"

type Props = {
  amount: number | string | null | undefined
  className?: string
  valueClassName?: string
}

function parseAmount(amount: number | string | null | undefined): number {
  if (typeof amount === "number") return amount
  return parseMoneyDigits(String(amount ?? ""))
}

export function CardCompactAmount({
  amount,
  className,
  valueClassName,
}: Props) {
  const raw = String(amount ?? "").trim()
  if (!raw || raw === "—") {
    return <span className={valueClassName ?? className}>—</span>
  }

  const n = parseAmount(amount)
  if (!Number.isFinite(n)) {
    return <span className={valueClassName ?? className}>{raw}</span>
  }

  const display = formatCardCompactUsdDisplay(n)
  const exact = formatCardCompactUsdExact(n)
  const showInfo = shouldShowCardCompactUsdTooltip(n)

  return (
    <span className={["card_compact_amount", className].filter(Boolean).join(" ")}>
      <span
        className={["card_compact_amount_value", valueClassName]
          .filter(Boolean)
          .join(" ")}
      >
        {display}
      </span>
      {showInfo ? (
        <span
          className="card_compact_amount_info"
          title={exact}
          aria-label={`Exact amount: ${exact}`}
        >
          <Info size={14} strokeWidth={2} aria-hidden />
        </span>
      ) : null}
    </span>
  )
}

/** KPI / metric cards: compact amount with optional info tooltip, or em dash. */
export function cardCompactAmountOrDash(
  raw: string | number | null | undefined,
): ReactNode {
  const text = String(raw ?? "").trim()
  if (!text || text === "—") return "—"
  return <CardCompactAmount amount={raw} />
}

/** Datatable cells: same compact USD as KPI cards (e.g. Remaining), right-aligned. */
export function TableCompactAmountCell({
  amount,
  className,
}: {
  amount: string | number | null | undefined
  className?: string
}) {
  const text = String(amount ?? "").trim()
  if (!text || text === "—") {
    return <span className={className}>—</span>
  }
  return (
    <span
      className={["table_compact_amount_cell", className]
        .filter(Boolean)
        .join(" ")}
    >
      <CardCompactAmount amount={amount} />
    </span>
  )
}
