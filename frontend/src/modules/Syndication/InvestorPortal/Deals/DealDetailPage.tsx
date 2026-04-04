import type { LucideIcon } from "lucide-react"
import {
  ArrowLeft,
  BarChart3,
  Bookmark,
  FileSignature,
  FileText,
  Megaphone,
  PhoneForwarded,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react"
import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { dealDetailApiToRecord, type DealRecord } from "../deals-mock-data"
import { setAppDocumentTitle } from "../../../../common/utils/appDocumentTitle"
import { fetchDealById, type DealDetailApi } from "./api/dealsApi"
import { DealInvestorsTab } from "./components/DealInvestorsTab"
import { DealOfferingDetailsTab } from "./components/DealOfferingDetailsTab"
import { TabsScrollStrip } from "../../../../common/components/tabs-scroll-strip/TabsScrollStrip"
import "../../../usermanagement/user_management.css"
import "./deals-list.css"

interface DealDetailTabDef {
  id: string
  label: string
  icon: LucideIcon
}

const DEAL_DETAIL_TABS: DealDetailTabDef[] = [
  { id: "investors", label: "Investors", icon: Users },
  { id: "reservations", label: "Reservations", icon: Bookmark },
  { id: "offering_details", label: "Offering Details", icon: FileText },
  { id: "insights", label: "Insights", icon: BarChart3 },
  { id: "esign_templates", label: "eSign Templates", icon: FileSignature },
  { id: "subscriptions", label: "Subscriptions", icon: RefreshCw },
  { id: "accreditations", label: "Accreditations", icon: ShieldCheck },
  { id: "capital_calls", label: "Capital Calls", icon: PhoneForwarded },
  // Distributions tab deferred — add back with e.g. Wallet icon when wired up.
  { id: "investor_deck", label: "Investor deck", icon: Sparkles },
  { id: "updates", label: "Updates", icon: Megaphone },
]

export function DealDetailPage() {
  const { dealId } = useParams()
  const [activeTab, setActiveTab] = useState<string>("investors")
  const [addInvestmentOpen, setAddInvestmentOpen] = useState(false)
  const [deal, setDeal] = useState<DealRecord | null | undefined>(undefined)
  const [dealDetailApi, setDealDetailApi] = useState<DealDetailApi | null>(null)

  useEffect(() => {
    if (!dealId) {
      setDeal(undefined)
      return
    }
    let cancelled = false
    setDeal(undefined)
    setDealDetailApi(null)
    void (async () => {
      try {
        const d = await fetchDealById(dealId)
        if (!cancelled) {
          setDealDetailApi(d)
          setDeal(dealDetailApiToRecord(d))
        }
      } catch {
        if (!cancelled) {
          setDeal(null)
          setDealDetailApi(null)
        }
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

  useEffect(() => {
    const el = document.getElementById(`deal-tab-${activeTab}`)
    if (!el) return
    el.scrollIntoView({
      behavior: "smooth",
      inline: "nearest",
      block: "nearest",
    })
  }, [activeTab])

  if (!dealId)
    return (
      <div className="deals_list_page deals_detail_page">
        <p className="deals_list_not_found">Missing deal.</p>
      </div>
    )

  if (deal === undefined)
    return (
      <div className="deals_list_page deals_detail_page">
        <p className="deals_list_not_found">Loading deal…</p>
      </div>
    )

  if (!deal)
    return (
      <div className="deals_list_page deals_detail_page">
        <p className="deals_list_not_found">
          Deal not found.{" "}
          <Link to="/deals" className="deals_list_inline_back">
            <ArrowLeft size={18} strokeWidth={2} aria-hidden />
            Back to deals
          </Link>
        </p>
      </div>
    )

  const displayName = deal.title

  return (
    <div className="deals_list_page deals_detail_page">
      {/* Breadcrumb: Home › Deals › {deal name}
      <nav className="deals_list_breadcrumb" aria-label="Breadcrumb">
        <Link to="/">
          <Home size={16} strokeWidth={2} aria-hidden />
          <span className="visually_hidden">Home</span>
        </Link>
        <ChevronRight
          size={14}
          className="deals_list_breadcrumb_sep"
          aria-hidden
        />
        <Link to="/deals">Deals</Link>
        <ChevronRight
          size={14}
          className="deals_list_breadcrumb_sep"
          aria-hidden
        />
        <span aria-current="page">{displayName}</span>
      </nav>
      */}

      <header className="deals_list_head">
        <div className="deals_list_title_row">
          <Link
            className="deals_list_back_circle"
            to="/deals"
            aria-label="Back to deals"
          >
            <ArrowLeft size={20} strokeWidth={2} aria-hidden />
          </Link>
          <h1 className="deals_list_title">{displayName}</h1>
        </div>
        <button
          type="button"
          className="deals_list_add_btn"
          onClick={() => {
            setActiveTab("investors")
            setAddInvestmentOpen(true)
          }}
        >
          <Plus size={18} strokeWidth={2} aria-hidden />
          Add Investment
        </button>
      </header>

      <div className="um_members_tabs_outer deals_tabs_outer">
        <TabsScrollStrip scrollClassName="deals_tabs_scroll">
          <div
            className="um_members_tabs_row deals_tabs_row"
            role="tablist"
            aria-label="Deal sections"
          >
            {DEAL_DETAIL_TABS.map((tab) => {
              const isActive = activeTab === tab.id
              const TabIcon = tab.icon
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls="deal-detail-tabpanel"
                  id={`deal-tab-${tab.id}`}
                  className={`um_members_tab deals_tabs_tab${isActive ? " um_members_tab_active" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <TabIcon
                    className="deals_tabs_icon"
                    size={18}
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  <span className="deals_tabs_label">{tab.label}</span>
                </button>
              )
            })}
          </div>
        </TabsScrollStrip>
      </div>

      <div className="um_members_tab_content">
        <div
          id="deal-detail-tabpanel"
          className="deal_detail_tab_panel"
          role="tabpanel"
          aria-labelledby={`deal-tab-${activeTab}`}
        >
        {activeTab === "investors" ? (
          <DealInvestorsTab
            dealId={dealId}
            dealName={displayName}
            dealDetail={dealDetailApi}
            addInvestmentOpen={addInvestmentOpen}
            onAddInvestmentClose={() => setAddInvestmentOpen(false)}
            onOpenAddInvestment={() => {
              setActiveTab("investors")
              setAddInvestmentOpen(true)
            }}
          />
        ) : activeTab === "offering_details" && dealDetailApi ? (
          <DealOfferingDetailsTab detail={dealDetailApi} />
        ) : (
          <div className="deal_detail_wip_wrap" role="status">
            <p className="deal_detail_wip_title">Working in progress</p>
            <p className="deal_detail_wip_hint">
              There is no content here yet. Check back soon or complete the
              related details in your workflow.
            </p>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}
