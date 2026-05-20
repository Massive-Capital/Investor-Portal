import { ArrowLeft } from "lucide-react"
import { Link } from "react-router-dom"
import type { DealDetailApi } from "@/modules/Syndication/Deals/api/dealsApi"
import { DealOfferingPreviewInner } from "@/modules/Syndication/Deals/DealOfferingPreviewInner"
import type { DealInvestorsPayload } from "@/modules/Syndication/Deals/types/deal-investors.types"
import type { DealInvestorClass } from "@/modules/Syndication/Deals/types/deal-investor-class.types"
import { LpDealStickyCta } from "../components/lp-deal-sticky-cta"
import "@/modules/Syndication/Deals/deal-offering-portfolio.css"
import "@/modules/Syndication/Deals/deals-list.css"
import "../lp-deal-details.css"

export interface LpDealDetailsPageProps {
  deal: DealDetailApi
  classes: DealInvestorClass[]
  investorsPayload: DealInvestorsPayload
  onInvestNow: () => void
  backTo: string
  viewerRoleLabel?: string | null
}

/** Investing deal workspace — same bento offering layout as sponsor preview / shared link. */
export function LpDealDetailsPage({
  deal,
  classes,
  investorsPayload,
  onInvestNow,
  backTo,
}: LpDealDetailsPageProps) {
  return (
    <div className="lpdd deal_offer_pf_page">
      <div className="deal_offer_pf lpdd_shell">
        <div className="lpdd_back_row">
          <Link className="deals_list_inline_back" to={backTo}>
            <ArrowLeft size={18} strokeWidth={2} aria-hidden />
            Back to deals
          </Link>
        </div>

        <DealOfferingPreviewInner
          detail={deal}
          classes={classes}
          investorsPayload={investorsPayload}
          applyInvestorLinkVisibility
          isPublicOfferingRoute={false}
          showInvestNowCta
          onInvestNow={onInvestNow}
          galleryUsesPersistedSourcesOnly={false}
        />
      </div>

      <LpDealStickyCta label="Invest now" onInvest={onInvestNow} />
    </div>
  )
}
