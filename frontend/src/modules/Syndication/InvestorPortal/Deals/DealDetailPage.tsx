import {
  ArrowLeft,
  Building2,
  CircleDollarSign,
  Home,
  MoreHorizontal,
  Network,
  Search,
  UsersRound,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { DataTablePagination } from "../../../../common/components/DataTablePagination/DataTablePagination"
import { ToolStyleCard } from "../../../../common/components/tool-style-card/ToolStyleCard"
import { dealDetailApiToRecord, type DealRecord } from "../deals-mock-data"
import { setAppDocumentTitle } from "../../../../common/utils/appDocumentTitle"
import "../../../usermanagement/user_management.css"
import { fetchDealById } from "./api/dealsApi"
import "./deal-summary.css"

/** Replace `[]` with API-loaded rows when offerings endpoint exists. */
export interface DealOfferingRow {
  id: string
  offeringName: string
  internalName: string
  offeringSize: string
  status: string
  visibility: string
  type: string
}

const DEAL_SUMMARY_TABS = [
  { id: "offerings", label: "Offerings" },
  { id: "classes", label: "Classes", dot: true },
  { id: "investments", label: "Investments" },
  { id: "assets", label: "Assets" },
  { id: "distributions", label: "Distributions" },
  { id: "documents", label: "Documents" },
  { id: "valuation", label: "Valuation forms" },
  { id: "updates", label: "Updates" },
  { id: "members", label: "Members" },
  { id: "kpis", label: "KPIs" },
] as const

export function DealDetailPage() {
  const { dealId } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<string>("offerings")
  const [offeringQuery, setOfferingQuery] = useState("")
  const [offeringsPage, setOfferingsPage] = useState(1)
  const [offeringsPageSize, setOfferingsPageSize] = useState(10)
  const [offerings] = useState<DealOfferingRow[]>([])
  const [deal, setDeal] = useState<DealRecord | null | undefined>(undefined)

  useEffect(() => {
    if (!dealId) {
      setDeal(undefined)
      return
    }
    let cancelled = false
    setDeal(undefined)
    void (async () => {
      try {
        const d = await fetchDealById(dealId)
        if (!cancelled) setDeal(dealDetailApiToRecord(d))
      } catch {
        if (!cancelled) setDeal(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [dealId])

  useEffect(() => {
    if (!dealId) return
    if (deal === undefined) {
      setAppDocumentTitle("Deal")
      return
    }
    if (deal === null) {
      setAppDocumentTitle("Deal not found")
      return
    }
    setAppDocumentTitle(deal.title.trim() || "Deal")
  }, [dealId, deal])

  const filteredOfferings = useMemo(() => {
    const q = offeringQuery.trim().toLowerCase()
    if (!q) return offerings
    return offerings.filter(
      (o) =>
        o.offeringName.toLowerCase().includes(q) ||
        o.internalName.toLowerCase().includes(q) ||
        o.status.toLowerCase().includes(q),
    )
  }, [offeringQuery, offerings])

  const paginatedOfferings = useMemo(() => {
    const start = (offeringsPage - 1) * offeringsPageSize
    return filteredOfferings.slice(start, start + offeringsPageSize)
  }, [filteredOfferings, offeringsPage, offeringsPageSize])

  useEffect(() => {
    setOfferingsPage(1)
  }, [offeringQuery])

  useEffect(() => {
    const totalPages = Math.max(
      1,
      Math.ceil(filteredOfferings.length / offeringsPageSize),
    )
    if (offeringsPage > totalPages) setOfferingsPage(totalPages)
  }, [
    filteredOfferings.length,
    offeringsPageSize,
    offeringsPage,
    filteredOfferings,
  ])

  if (!dealId)
    return (
      <div className="deal_summary_page">
        <p className="deal_summary_not_found">Missing deal.</p>
      </div>
    )

  if (deal === undefined)
    return (
      <div className="deal_summary_page">
        <p className="deal_summary_not_found">Loading deal…</p>
      </div>
    )

  if (!deal)
    return (
      <div className="deal_summary_page">
        <p className="deal_summary_not_found">
          Deal not found.{" "}
          <Link to="/deals">Back to deals</Link>
        </p>
      </div>
    )

  const displayName = deal.title

  return (
    <div className="deal_summary_page">
      <h1 className="deal_summary_top_title">{displayName}</h1>

      <nav className="deal_summary_breadcrumb" aria-label="Breadcrumb">
        <Link to="/">
          <Home size={16} strokeWidth={2} aria-hidden />
          <span className="visually_hidden">Home</span>
        </Link>
        <span className="deal_summary_breadcrumb_sep" aria-hidden>
          ›
        </span>
        <Link to="/deals">Deals</Link>
        <span className="deal_summary_breadcrumb_sep" aria-hidden>
          ›
        </span>
        <span aria-current="page">{displayName}</span>
      </nav>

      <div className="deal_summary_actions_row">
        <div className="deal_summary_actions_left">
          <Link className="deal_summary_back_btn" to="/deals">
            <ArrowLeft size={16} strokeWidth={2} aria-hidden />
            Back
          </Link>
          <div className="deal_summary_heading_block">
            <h2 className="deal_summary_heading">Deal summary</h2>
            <span className="deal_summary_status">{deal.statusLabel}</span>
          </div>
        </div>
        <div className="deal_summary_actions_right">
          <button type="button" className="deal_summary_btn_secondary">
            Manage deal
          </button>
          <button type="button" className="deal_summary_btn_primary">
            + Add investment
          </button>
        </div>
      </div>

      <section
        className="deal_summary_metrics_grid"
        aria-label="Deal summary metrics"
      >
        <ToolStyleCard
          variant="metric"
          icon={CircleDollarSign}
          title="Investments started"
          description="$0"
          hintTitle="Investments that have begun the subscription process"
        />
        <ToolStyleCard
          variant="metric"
          icon={Network}
          title="Documents signed"
          description="$0"
          hintTitle="Fully executed subscription documents"
        />
        <ToolStyleCard
          variant="metric"
          icon={UsersRound}
          title="Total funded"
          description={deal.totalFunded}
          hintTitle="Capital wired and confirmed"
        />
        <ToolStyleCard
          variant="metric"
          icon={Building2}
          title="Total accepted"
          description={deal.totalAccepted}
          hintTitle="Commitments accepted toward the raise"
        />
      </section>

      <ul className="deal_summary_tabs" role="tablist" aria-label="Deal sections">
        {DEAL_SUMMARY_TABS.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <li key={tab.id} className="deal_summary_tab" role="none">
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`deal_summary_tab_btn${isActive ? " deal_summary_tab_btn_active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="deal_summary_tab_label">
                  {tab.label}
                  {"newBadge" in tab && tab.newBadge ? (
                    <span className="deal_summary_tab_new">NEW</span>
                  ) : null}
                </span>
                {"dot" in tab && tab.dot ? (
                  <span
                    className="deal_summary_tab_dot"
                    aria-label="Has notifications"
                  />
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>

      {activeTab === "offerings" ? (
        <div
          className="deal_summary_panel"
          role="tabpanel"
          aria-label="Offerings"
        >
          <div className="um_panel deal_summary_offerings_panel">
            <p className="deal_summary_panel_intro">
              <a href="#/">Read this article</a> to learn more about creating a
              new offering.
            </p>
            <div className="um_toolbar">
              <div className="um_search_wrap">
                <Search className="um_search_icon" size={18} aria-hidden />
                <input
                  type="search"
                  className="um_search_input"
                  placeholder="Search offerings…"
                  value={offeringQuery}
                  onChange={(e) => setOfferingQuery(e.target.value)}
                  aria-label="Search offerings"
                />
              </div>
              <div className="um_toolbar_actions">
                <button
                  type="button"
                  className="deal_summary_btn_secondary deal_summary_btn_toolbar"
                >
                  Manage permissions
                </button>
                <button
                  type="button"
                  className="deal_summary_btn_primary deal_summary_btn_toolbar"
                >
                  + Add offering
                </button>
              </div>
            </div>

            <div className="um_table_wrap">
              <table className="um_table">
                <thead>
                  <tr>
                    <th scope="col">Offering name</th>
                    <th scope="col">Internal name</th>
                    <th scope="col">Offering size</th>
                    <th scope="col">Status</th>
                    <th scope="col">Visibility</th>
                    <th scope="col">Type</th>
                    <th scope="col" className="um_th_actions">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOfferings.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <p className="um_hint deal_summary_offerings_empty">
                          {offeringQuery.trim()
                            ? "No offerings match your search."
                            : "Once you've added a class, create an offering to start raising capital."}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    paginatedOfferings.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <span className="deal_summary_offering_name">
                            {row.offeringName}
                          </span>
                        </td>
                        <td>{row.internalName}</td>
                        <td>{row.offeringSize}</td>
                        <td>{row.status}</td>
                        <td>{row.visibility}</td>
                        <td>{row.type}</td>
                        <td className="um_td_actions">
                          <div className="um_kebab_root">
                            <button
                              type="button"
                              className="um_kebab_trigger"
                              aria-label={`Actions for ${row.offeringName}`}
                            >
                              <MoreHorizontal size={18} aria-hidden />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <DataTablePagination
                page={offeringsPage}
                pageSize={offeringsPageSize}
                totalItems={filteredOfferings.length}
                onPageChange={setOfferingsPage}
                onPageSizeChange={setOfferingsPageSize}
                ariaLabel="Offerings table pagination"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="deal_summary_panel" role="tabpanel">
          <p className="deal_summary_panel_intro" style={{ marginBottom: 0 }}>
            This section is not built yet. Choose another tab.
          </p>
          <button
            type="button"
            className="deal_summary_btn_secondary"
            style={{ marginTop: "1rem" }}
            onClick={() => navigate("/deals")}
          >
            Back to deals
          </button>
        </div>
      )}
    </div>
  )
}
