import {
  ClipboardList,
  CreditCard,
  DollarSign,
  LayoutDashboard,
  LineChart,
  Plus,
  UserRound,
  Users,
} from "lucide-react"
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { ToolStyleCard } from "../../../../common/components/tool-style-card/ToolStyleCard"
import { usePortalMode } from "@/modules/Investing/context/PortalModeContext"
import { InvestingDashboardPage } from "@/modules/Investing/dashboard_investing"
import { SyndicatingDealsSection } from "../Deals/SyndicatingDealsSection"
import {
  loadSyndicationDashboardSummary,
  type SyndicationDashboardSummary,
} from "./syndicationDashboardData"
import "../../../usermanagement/user_management.css"
import "./sponsor-dashboard.css"

function formatDashboardValue(
  loading: boolean,
  summary: SyndicationDashboardSummary | null,
  pick: (s: SyndicationDashboardSummary) => string,
): string {
  if (loading || summary == null) return "—"
  return pick(summary)
}

function totalInvestorsAcrossDealsDisplay(
  loading: boolean,
  summary: SyndicationDashboardSummary | null,
): string {
  if (loading || summary == null) return "—"
  return String(summary.totalInvestorRows)
}

function SyndicatingDashboard() {
  const [summary, setSummary] = useState<SyndicationDashboardSummary | null>(
    null,
  )
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const s = await loadSyndicationDashboardSummary()
        if (!cancelled) setSummary(s)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="um_page sponsor_dash sponsor_dash_syndicating">
      <div className="um_members_header_block">
        <div className="um_header_row">
          <h2 className="um_title um_title_with_icon">
            <LayoutDashboard
              className="um_title_icon"
              size={26}
              strokeWidth={1.75}
              aria-hidden
            />
            Syndicating dashboard
          </h2>
          <Link
            className="um_btn_primary sponsor_dash_add_link"
            to="/deals/create"
          >
            <Plus size={18} aria-hidden />
            Add deal
          </Link>
        </div>
      </div>

      <section
        className="sponsor_dash_metrics"
        aria-label="Dashboard summary"
        aria-busy={loading}
      >
           <ToolStyleCard
          variant="metric"
          icon={LineChart}
          title="Total target amount"
          description={formatDashboardValue(loading, summary, (s) => s.totalTargetDisplay)}
        />
            
        <ToolStyleCard
          variant="metric"
          icon={DollarSign}
          title="Total distributions"
          description={formatDashboardValue(loading, summary, (s) => s.totalDistributionsDisplay)}
        />
         <ToolStyleCard
          variant="metric"
          icon={UserRound}
          title="# of investors"
          description={totalInvestorsAcrossDealsDisplay(loading, summary)}
          hintTitle="Sum of investors on each deal (same as the row count on the deal Investors tab), added across all your deals."
        />
        <ToolStyleCard
          variant="metric"
          icon={Users}
          title="# of contacts"
          description={formatDashboardValue(loading, summary, (s) =>
            String(s.contactsCount),
          )}
          hintTitle="Contacts added under your company (same list as Add contacts / CRM)."
        />
        <ToolStyleCard
          variant="metric"
          icon={ClipboardList}
          title="# of reviews"
          description="—"
          // footer={<a href="#reviews">Turn on reviews</a>}
        />
        <ToolStyleCard
          variant="metric"
          icon={CreditCard}
          title="Billing quota"
          description="—"
          hintTitle="Your syndication billing quota for active deals."
        />
 
       
      </section>

      <SyndicatingDealsSection dealsHeadingId="sponsor-deals-heading" />
    </section>
  )
}

function SponsorDashboardPage() {
  const { mode } = usePortalMode()

  if (mode === "investing") return <InvestingDashboardPage />

  return <SyndicatingDashboard />
}

export default SponsorDashboardPage
