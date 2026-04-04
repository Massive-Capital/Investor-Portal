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
import { Link, NavLink } from "react-router-dom"
import { ToolStyleCard } from "../../../../common/components/tool-style-card/ToolStyleCard"
import { usePortalMode } from "../../../../common/context/PortalModeContext"
import { SyndicatingDealsSection } from "../Deals/SyndicatingDealsSection"
import {
  loadSyndicationDashboardSummary,
  type SyndicationDashboardSummary,
} from "./syndicationDashboardData"
import "../../../usermanagement/user_management.css"
import "./sponsor-dashboard.css"

function InvestingHomeDashboard() {
  return (
    <section className="um_page sponsor_dash sponsor_dash_investing">
      <div className="um_members_header_block">
        <div className="um_header_row">
          <h2 className="um_title um_title_with_icon">
            <LayoutDashboard
              className="um_title_icon"
              size={26}
              strokeWidth={1.75}
              aria-hidden
            />
            Dashboard
          </h2>
        </div>
      </div>
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
    </section>
  )
}

function formatDashboardValue(
  loading: boolean,
  summary: SyndicationDashboardSummary | null,
  pick: (s: SyndicationDashboardSummary) => string,
): string {
  if (loading || summary == null) return "—"
  return pick(summary)
}

function investmentCountDisplay(
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
          icon={ClipboardList}
          title="# of reviews"
          description="—"
          footer={<a href="#reviews">Turn on reviews</a>}
        />
        <ToolStyleCard
          variant="metric"
          icon={CreditCard}
          title="Billing quota"
          description="—"
          hintTitle="Your syndication billing quota for active deals."
        />
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
          title="# of investments"
          description={investmentCountDisplay(loading, summary)}
          hintTitle="Investor rows across all deals (same count as the Investors tab per deal)."
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
      </section>

      <SyndicatingDealsSection dealsHeadingId="sponsor-deals-heading" />
    </section>
  )
}

function SponsorDashboardPage() {
  const { mode } = usePortalMode()

  if (mode === "investing") return <InvestingHomeDashboard />

  return <SyndicatingDashboard />
}

export default SponsorDashboardPage
