import type { DealInvestorRow } from "../../types/deal-investors.types"
import { investorRowShowsEsignStatusLink } from "../../utils/investorEsignStatus"

export interface DealInvestorSignedCellProps {
  row: DealInvestorRow
  onOpenEsignStatus?: (row: DealInvestorRow) => void
}

function signedColumnButtonClass(display: string): string {
  const value = display.trim().toLowerCase()
  if (value === "pending") return "deal_inv_signed_btn deal_inv_signed_btn--pending"
  if (value === "completed") return "deal_inv_signed_btn deal_inv_signed_btn--completed"
  return "deal_inv_signed_btn"
}

export function DealInvestorSignedCell({
  row,
  onOpenEsignStatus,
}: DealInvestorSignedCellProps) {
  const display = String(row.signedDate ?? "").trim() || "—"
  const clickable = investorRowShowsEsignStatusLink(row) && onOpenEsignStatus

  if (!clickable) {
    return (
      <span
        className="deal_inv_ellipsis_text"
        title={display !== "—" ? display : undefined}
      >
        {display}
      </span>
    )
  }

  return (
    <button
      type="button"
      className={signedColumnButtonClass(display)}
      title="View eSign status"
      onClick={(e) => {
        e.stopPropagation()
        onOpenEsignStatus(row)
      }}
    >
      <span className="deal_inv_ellipsis_text">{display}</span>
    </button>
  )
}
