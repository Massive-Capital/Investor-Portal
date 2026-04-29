import type { DealInvestorRow } from "../types/deal-investors.types"
import {
  displayInvestorCommittedAmount,
  formatCurrencyTableDisplay,
  investorCommittedPendingSplit,
} from "../utils/offeringMoneyFormat"

type Props = { row: DealInvestorRow; alignEnd?: boolean }

/**
 * Committed / commitment column: total, or last approved + plus + new amount when pending re-approval.
 */
export function DealInvestorCommittedAmountCell({
  row,
  alignEnd = true,
}: Props) {
  const split = investorCommittedPendingSplit(row)
  if (!split) {
    const text = displayInvestorCommittedAmount(row)
    return (
      <span
        className={`deal_inv_ellipsis_text${alignEnd ? " deal_inv_ellipsis_text_end" : ""}`.trim()}
        title={text !== "—" ? text : undefined}
      >
        {text}
      </span>
    )
  }
  const approvedFmt = formatCurrencyTableDisplay(String(split.snapshot))
  const newFmt = formatCurrencyTableDisplay(String(split.incremental))
  const title = `${approvedFmt} + ${newFmt}`
  return (
    <span
      className={`deal_inv_ellipsis_text${alignEnd ? " deal_inv_ellipsis_text_end" : ""}`.trim()}
      title={title}
    >
      <span className="inline-flex items-center justify-end gap-0.5 flex-nowrap min-w-0">
        <span className="truncate">{approvedFmt}</span>
        {/* <Plus
          className="h-3.5 w-3.5 shrink-0 opacity-70"
          strokeWidth={2.5}
          aria-hidden
        /> */}
        {" "} + {" "}
        <span className="truncate">{newFmt}</span>
      </span>
    </span>
  )
}
