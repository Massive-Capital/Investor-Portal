import type { DealInvestorClass } from "../types/deal-investor-class.types"
import {
  investorClassStatusLabel,
  investorClassVisibilityLabel,
} from "../utils/offeringDisplayLabels"
import { formatMoneyFieldDisplay } from "../utils/offeringMoneyFormat"

export interface OfferingPreviewClassBentoCardProps {
  investorClass: DealInvestorClass
}

export function OfferingPreviewClassBentoCard({
  investorClass,
}: OfferingPreviewClassBentoCardProps) {
  const name = investorClass.name?.trim() || "Untitled class"
  const minimum = formatMoneyFieldDisplay(investorClass.minimumInvestment)
  const status = investorClassStatusLabel(investorClass.status ?? "")
  const visibility = investorClassVisibilityLabel(investorClass.visibility ?? "")

  return (
    <article className="deal_offer_pf_bento_class_card">
      <h3 className="deal_offer_pf_bento_class_card_title">{name}</h3>
      <dl className="deal_offer_pf_bento_class_card_meta">
        <div className="deal_offer_pf_bento_class_card_row">
          <dt>Minimum investment</dt>
          <dd>{minimum}</dd>
        </div>
        <div className="deal_offer_pf_bento_class_card_row">
          <dt>Status</dt>
          <dd>{status}</dd>
        </div>
        <div className="deal_offer_pf_bento_class_card_row">
          <dt>Visibility</dt>
          <dd>{visibility}</dd>
        </div>
      </dl>
    </article>
  )
}
