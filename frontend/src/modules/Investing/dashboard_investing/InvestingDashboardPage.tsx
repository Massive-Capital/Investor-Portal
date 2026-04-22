import {
  Briefcase,
  DollarSign,
  LayoutDashboard,
  LineChart,
  PiggyBank,
} from "lucide-react"
import { useEffect, useState } from "react"
import { NavLink } from "react-router-dom"
import { ToolStyleCard } from "@/common/components/tool-style-card/ToolStyleCard"
import { SyndicatingDealsSection } from "@/modules/Syndication/InvestorPortal/Deals/SyndicatingDealsSection"
import "@/modules/usermanagement/user_management.css"
import "@/modules/Syndication/InvestorPortal/Dashboard/sponsor-dashboard.css"
import {
  loadInvestingDashboardMetrics,
  type InvestingDashboardMetrics,
} from "./investingDashboardMetrics"
import "./dashboard-investing.css"

function metricDescription(
  loading: boolean,
  metrics: InvestingDashboardMetrics | null,
  pick: (m: InvestingDashboardMetrics) => string,
): string {
  if (loading || metrics == null) return "—"
  return pick(metrics)
}

export function InvestingDashboardPage() {
  const [metrics, setMetrics] = useState<InvestingDashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const m = await loadInvestingDashboardMetrics()
        if (!cancelled) setMetrics(m)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

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
            Investor dashboard
          </h2>
          <NavLink className="um_btn_secondary sponsor_dash_add_link" to="/investing/deals">
            All deals
          </NavLink>
        </div>
      </div>

      {/* <section
        className="investing_dash_panel"
        aria-label="Investing workspace shortcuts"
      >
        <p className="investing_dash_lead">
          Metrics reflect active (non-archived) deals in your investing scope —
          organization deals plus deals where you are on the roster.
        </p>
        <div className="investing_dash_links">
          <NavLink className="investing_dash_link" to="/investing/deals">
            Deals table
          </NavLink>
          <NavLink className="investing_dash_link" to="/investing/opportunities">
            Opportunities
          </NavLink>
        </div>
      </section> */}

      <section
        className="sponsor_dash_metrics investing_dash_top_metrics"
        aria-label="Investing summary"
        aria-busy={loading}
      >
        <ToolStyleCard
          variant="metric"
          icon={PiggyBank}
          title="Total invested"
          description={metricDescription(loading, metrics, (m) => m.totalInvestedDisplay)}
          hintTitle="Your committed amounts on each active deal. LP investor accounts only include your own investments, not other participants on the same deals."
        />
        <ToolStyleCard
          variant="metric"
          icon={DollarSign}
          title="Total distributed"
          description={metricDescription(loading, metrics, (m) => m.totalDistributedDisplay)}
          hintTitle="Sum of funded amounts from investor KPIs on each active deal."
        />
        <ToolStyleCard
          variant="metric"
          icon={Briefcase}
          title="# of deals"
          description={metricDescription(loading, metrics, (m) => String(m.dealCount))}
          hintTitle="Count of active (non-archived) deals visible in investing mode."
        />
        <ToolStyleCard
          variant="metric"
          icon={LineChart}
          title="Total in-progress"
          description={metricDescription(loading, metrics, (m) => m.totalInProgressDisplay)}
          hintTitle="Calculated as the sum of active investments that have not been countersigned."
        />
      </section>

      <SyndicatingDealsSection
        dealsHeadingId="investing-deals-heading"
        includeParticipantDeals
        dealsSectionTitle="Your deals"
      />
    </section>
  )
}
