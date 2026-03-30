import {
  ClipboardList,
  CreditCard,
  DollarSign,
  LineChart,
  Plus,
  UserRound,
  Users,
} from "lucide-react"
import { Link, NavLink } from "react-router-dom"
import { ToolStyleCard } from "../../../../common/components/tool-style-card/ToolStyleCard"
import { usePortalMode } from "../../../../common/context/PortalModeContext"
import { SyndicatingDealsSection } from "../Deals/SyndicatingDealsSection"
import { dealsDashboardMetrics } from "../deals-mock-data"
import "./sponsor-dashboard.css"

function InvestingHomeDashboard() {
  return (
    <div className="sponsor_dash sponsor_dash_investing">
      <header className="sponsor_dash_header">
        <h1 className="sponsor_dash_title">Dashboard</h1>
      </header>
      <section
        className="investing_dash_panel"
        aria-label="Investing workspace"
      >
        <p className="investing_dash_lead">
          You&apos;re in investing mode. The syndication dashboard and deal
          management tools are only available when you switch to Syndicating.
        </p>
        <NavLink className="investing_dash_link" to="/investing/opportunities">
          Go to Opportunities
        </NavLink>
      </section>
    </div>
  )
}

function SyndicatingDashboard() {
  return (
    <div className="sponsor_dash sponsor_dash_syndicating">
      <header className="sponsor_dash_header">
        <h1 className="sponsor_dash_title">Syndicating dashboard</h1>
        <Link className="sponsor_dash_add_btn" to="/deals/create">
          <Plus size={18} strokeWidth={2.25} aria-hidden />
          Add deal
        </Link>
      </header>

      <section
        className="sponsor_dash_metrics"
        aria-label="Dashboard summary"
      >
        <ToolStyleCard
          variant="metric"
          icon={ClipboardList}
          title="# of reviews"
          description={dealsDashboardMetrics.reviewCount}
          footer={<a href="#reviews">Turn on reviews</a>}
        />
        <ToolStyleCard
          variant="metric"
          icon={CreditCard}
          title="Billing quota"
          description={dealsDashboardMetrics.billingQuota}
          hintTitle="Your syndication billing quota for active deals."
        />
        <ToolStyleCard
          variant="metric"
          icon={LineChart}
          title="Total target amount"
          description={dealsDashboardMetrics.totalTarget}
        />
        <ToolStyleCard
          variant="metric"
          icon={DollarSign}
          title="Total distributions"
          description={dealsDashboardMetrics.totalDistributions}
        />
        <ToolStyleCard
          variant="metric"
          icon={UserRound}
          title="# of investments"
          description={dealsDashboardMetrics.investmentCount}
          hintTitle="Count of distinct investments across deals."
        />
        <ToolStyleCard
          variant="metric"
          icon={Users}
          title="# of contacts"
          description={dealsDashboardMetrics.contactCount}
        />
      </section>

      <SyndicatingDealsSection dealsHeadingId="sponsor-deals-heading" />
    </div>
  )
}

function SponsorDashboardPage() {
  const { mode } = usePortalMode()

  if (mode === "investing") return <InvestingHomeDashboard />

  return <SyndicatingDashboard />
}

export default SponsorDashboardPage
