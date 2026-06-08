import { Activity, Briefcase, Clock, Download, LayoutGrid, Search, Sparkles } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { getSessionUserEmail } from "@/common/auth/sessionUserEmail"
import { TabsScrollStrip } from "@/common/components/tabs-scroll-strip/TabsScrollStrip"
import {
  dealListRowToDealRecord,
  mergeDealRecordWithInvestorsAndClasses,
  type DealRecord,
} from "@/modules/Syndication/dealsDashboardUtils"
import {
  fetchDealInvestorClasses,
  fetchDealInvestors,
  fetchDealsList,
} from "@/modules/Syndication/Deals/api/dealsApi"
import { ExportDealsModal } from "@/modules/Syndication/Deals/components/ExportDealsModal"
import { DEALS_LIST_REFETCH_EVENT } from "@/modules/Syndication/Deals/createDealFormDraftStorage"
import { getDealStatusRules } from "@/modules/Syndication/Deals/constants/deal-lifecycle"
import type { DealListRow } from "@/modules/Syndication/Deals/types/deals.types"
import { SyndicatingDealsSection, DealsViewSortControls, type DealsSortKey } from "@/modules/Syndication/Deals/SyndicatingDealsSection"
import {
  dealHasInvestNowDraftForViewer,
  firstInvestNowDraftRowForViewer,
} from "@/modules/Investing/pages/invest/investNowDraftUtils"
import { investNowDraftProgressFromInvestorRow } from "@/modules/Investing/pages/invest/investNowDraftProgress"
import {
  classifyInvestingDashboardDealBucket,
  INVESTING_DASHBOARD_DEAL_TAB_ORDER,
  type InvestingDashboardClassifiedDealBucket,
  type InvestingDashboardDealBucket,
} from "./investingDashboardDealBucket"

type DealsTab = InvestingDashboardDealBucket

const TAB_IDS: Record<DealsTab, string> = {
  all: "investing-dash-deals-all",
  active: "investing-dash-deals-active",
  in_progress: "investing-dash-deals-in-progress",
  coming_soon: "investing-dash-deals-coming-soon",
}

type DealsByBucket = Record<InvestingDashboardClassifiedDealBucket, DealRecord[]>

const EMPTY_BY_BUCKET: DealsByBucket = {
  active: [],
  in_progress: [],
  coming_soon: [],
}

async function loadDealsByBucket(viewerEmailNorm: string): Promise<DealsByBucket> {
  if (!viewerEmailNorm) return { ...EMPTY_BY_BUCKET }

  let list = await fetchDealsList({ includeParticipantDeals: true })
  list = list.filter((row) => {
    const rules = getDealStatusRules(row.offeringStatus)
    return rules.status !== "closed" && rules.status !== "past"
  })
  if (list.length === 0) return { ...EMPTY_BY_BUCKET }

  const out: DealsByBucket = { active: [], in_progress: [], coming_soon: [] }

  const bundles = await Promise.all(
    list.map(async (row) => {
      const [payload, classes] = await Promise.all([
        fetchDealInvestors(row.id),
        fetchDealInvestorClasses(row.id),
      ])
      return { row, payload, classes }
    }),
  )

  for (const { row, payload, classes } of bundles) {
    const bucket = classifyInvestingDashboardDealBucket(
      row,
      payload,
      viewerEmailNorm,
    )
    if (!bucket) continue
    const record = mergeDealRecordWithInvestorsAndClasses(
      row,
      dealListRowToDealRecord(row),
      payload,
      classes,
    )
    if (dealHasInvestNowDraftForViewer(payload.investors, viewerEmailNorm)) {
      const draftRow = firstInvestNowDraftRowForViewer(
        payload.investors,
        viewerEmailNorm,
      )
      if (draftRow) {
        record.investNowDraftProgress =
          investNowDraftProgressFromInvestorRow(draftRow)
        record.investNowResumeScope = {
          investmentId: String(draftRow.id ?? "").trim() || undefined,
          userInvestorProfileId:
            String(draftRow.userInvestorProfileId ?? "").trim() || undefined,
          profileId: String(draftRow.profileId ?? "").trim() || undefined,
        }
      }
    }
    out[bucket].push(record)
  }

  return out
}

function dealRecordToDealListRow(record: DealRecord): DealListRow {
  return {
    id: record.id,
    dealName: record.title,
    dealType: record.dealType ?? "",
    dealStage: record.dealStage,
    totalInProgress: record.totalInProgress ?? "—",
    totalAccepted: record.totalAccepted,
    raiseTarget: record.targetAmount,
    distributions: record.totalDistributions,
    investors: record.investorCount,
    closeDateDisplay: record.closeDateDisplay ?? record.closeDate,
    createdDateDisplay: record.createdDateDisplay ?? "—",
    createdAt: record.createdAt,
    locationDisplay: record.location,
    offeringStatus: record.offeringStatus,
  }
}

function tabMeta(tab: DealsTab): {
  sectionTitle: string
  searchPlaceholder: string
  emptyLabel: string
} {
  if (tab === "all") {
    return {
      sectionTitle: "All deals",
      searchPlaceholder: "Search deals…",
      emptyLabel: "No deals in your investing scope yet.",
    }
  }
  if (tab === "active") {
    return {
      sectionTitle: "Active deals",
      searchPlaceholder: "Search active deals…",
      emptyLabel: "No active deals in your portfolio yet.",
    }
  }
  if (tab === "in_progress") {
    return {
      sectionTitle: "In progress deals",
      searchPlaceholder: "Search in progress deals…",
      emptyLabel: "No in-progress deals right now.",
    }
  }
  return {
    sectionTitle: "Coming soon",
    searchPlaceholder: "Search coming soon deals…",
    emptyLabel: "No coming soon deals right now.",
  }
}

export function InvestingDashboardDealsSection() {
  const [activeTab, setActiveTab] = useState<DealsTab>("all")
  const [dealsByBucket, setDealsByBucket] = useState<DealsByBucket>(EMPTY_BY_BUCKET)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [dealsView, setDealsView] = useState<"grid" | "list">("grid")
  const [dealsSortKey, setDealsSortKey] = useState<DealsSortKey>("createdAt")

  useEffect(() => {
    let cancelled = false

    void (async () => {
      setLoading(true)
      const viewerEmailNorm = getSessionUserEmail().trim().toLowerCase()
      const next = await loadDealsByBucket(viewerEmailNorm)
      if (!cancelled) {
        setDealsByBucket(next)
        setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    function onRefetch() {
      void (async () => {
        setLoading(true)
        const viewerEmailNorm = getSessionUserEmail().trim().toLowerCase()
        const next = await loadDealsByBucket(viewerEmailNorm)
        setDealsByBucket(next)
        setLoading(false)
      })()
    }
    window.addEventListener(DEALS_LIST_REFETCH_EVENT, onRefetch)
    return () =>
      window.removeEventListener(DEALS_LIST_REFETCH_EVENT, onRefetch)
  }, [])

  const visibleTabs = useMemo(() => {
    return INVESTING_DASHBOARD_DEAL_TAB_ORDER.filter((tab) => {
      if (tab === "coming_soon") return dealsByBucket.coming_soon.length > 0
      return true
    })
  }, [dealsByBucket.coming_soon.length])

  useEffect(() => {
    if (!visibleTabs.includes(activeTab)) {
      setActiveTab(visibleTabs[0] ?? "all")
    }
  }, [activeTab, visibleTabs])

  useEffect(() => {
    setQuery("")
  }, [activeTab])

  const activeCount = dealsByBucket.active.length
  const inProgressCount = dealsByBucket.in_progress.length
  const comingSoonCount = dealsByBucket.coming_soon.length
  const allCount =
    activeCount + inProgressCount + comingSoonCount
  const dealsForTab = useMemo(() => {
    if (activeTab === "all") {
      return [
        ...dealsByBucket.active,
        ...dealsByBucket.in_progress,
        ...dealsByBucket.coming_soon,
      ]
    }
    return dealsByBucket[activeTab]
  }, [activeTab, dealsByBucket])
  const { sectionTitle, searchPlaceholder, emptyLabel } = tabMeta(activeTab)
  const exportDeals = useMemo(
    () => dealsForTab.map(dealRecordToDealListRow),
    [dealsForTab],
  )

  return (
    <section
      className="investing_dash_deals_section"
      aria-labelledby="investing-dash-deals-title"
    >
      <header className="investing_dash_deals_header">
        <h2
          id="investing-dash-deals-title"
          className="sponsor_dash_section_title investing_dash_deals_title"
        >
          <Briefcase
            className="investing_dash_deals_title_icon"
            size={22}
            strokeWidth={1.75}
            aria-hidden
          />
          All deals
        </h2>
      </header>

      <div className="investing_dash_deals_block um_panel deals_list_card_surface deal_inv_table_panel">
      <div className="um_members_tabs_outer deals_tabs_outer um_segmented_tabs_outer investing_dash_deals_tabs">
        <TabsScrollStrip scrollClassName="deals_tabs_scroll um_segmented_tabs_scroll">
          <div
            className="um_members_tabs_row deals_tabs_row um_segmented_tabs_row"
            role="tablist"
            aria-label="All deals by status"
          >
            <button
              type="button"
              id={TAB_IDS.all}
              role="tab"
              aria-selected={activeTab === "all"}
              aria-controls="investing-dash-deals-panel"
              className={`um_members_tab deals_tabs_tab um_segmented_tab${
                activeTab === "all" ? " um_members_tab_active" : ""
              }`}
              onClick={() => setActiveTab("all")}
            >
              <LayoutGrid
                className="deals_tabs_icon um_segmented_tab_icon"
                size={16}
                strokeWidth={2}
                aria-hidden
              />
              <span className="deals_tabs_label um_segmented_tab_label">
                All
              </span>
              <span className="deals_tabs_count">({allCount})</span>
            </button>
            <button
              type="button"
              id={TAB_IDS.active}
              role="tab"
              aria-selected={activeTab === "active"}
              aria-controls="investing-dash-deals-panel"
              className={`um_members_tab deals_tabs_tab um_segmented_tab${
                activeTab === "active" ? " um_members_tab_active" : ""
              }`}
              onClick={() => setActiveTab("active")}
            >
              <Activity
                className="deals_tabs_icon um_segmented_tab_icon"
                size={16}
                strokeWidth={2}
                aria-hidden
              />
              <span className="deals_tabs_label um_segmented_tab_label">
                Active
              </span>
              <span className="deals_tabs_count">({activeCount})</span>
            </button>
            <button
              type="button"
              id={TAB_IDS.in_progress}
              role="tab"
              aria-selected={activeTab === "in_progress"}
              aria-controls="investing-dash-deals-panel"
              className={`um_members_tab deals_tabs_tab um_segmented_tab${
                activeTab === "in_progress" ? " um_members_tab_active" : ""
              }`}
              onClick={() => setActiveTab("in_progress")}
            >
              <Clock
                className="deals_tabs_icon um_segmented_tab_icon"
                size={16}
                strokeWidth={2}
                aria-hidden
              />
              <span className="deals_tabs_label um_segmented_tab_label">
                In progress
              </span>
              <span className="deals_tabs_count">({inProgressCount})</span>
            </button>
            {comingSoonCount > 0 ? (
              <button
                type="button"
                id={TAB_IDS.coming_soon}
                role="tab"
                aria-selected={activeTab === "coming_soon"}
                aria-controls="investing-dash-deals-panel"
                className={`um_members_tab deals_tabs_tab um_segmented_tab${
                  activeTab === "coming_soon" ? " um_members_tab_active" : ""
                }`}
                onClick={() => setActiveTab("coming_soon")}
              >
                <Sparkles
                  className="deals_tabs_icon um_segmented_tab_icon"
                  size={16}
                  strokeWidth={2}
                  aria-hidden
                />
                <span className="deals_tabs_label um_segmented_tab_label">
                  Coming soon
                </span>
                <span className="deals_tabs_count">({comingSoonCount})</span>
              </button>
            ) : null}
          </div>
        </TabsScrollStrip>
      </div>

      <div className="investing_dash_deals_toolbar_row">
        <div className="um_toolbar deal_inv_table_um_toolbar investing_dash_deals_toolbar investing_dash_deals_unified_toolbar">
          <div className="um_search_wrap investing_dash_deals_search_wrap">
            <Search className="um_search_icon" size={18} aria-hidden />
            <input
              type="search"
              className="um_search_input"
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={loading}
              aria-label={searchPlaceholder}
            />
          </div>
          <div className="um_toolbar_actions deal_inv_table_toolbar_actions deals_list_toolbar_actions investing_dash_deals_export_actions">
            <button
              type="button"
              className="um_toolbar_export_btn"
              onClick={() => setExportModalOpen(true)}
              disabled={loading || exportDeals.length === 0}
            >
              <Download size={18} strokeWidth={2} aria-hidden />
              <span>Export All</span>
            </button>
          </div>
          <DealsViewSortControls
            className="investing_dash_deals_view_sort sponsor_dash_deals_toolbar"
            view={dealsView}
            onViewChange={setDealsView}
            sortKey={dealsSortKey}
            onSortKeyChange={setDealsSortKey}
          />
        </div>
      </div>

      <div
        id="investing-dash-deals-panel"
        role="tabpanel"
        aria-labelledby={TAB_IDS[activeTab]}
        className="investing_dash_deals_panel"
      >
        <SyndicatingDealsSection
          key={activeTab}
          controlledDeals={dealsForTab}
          controlledLoading={loading}
          controlledQuery={query}
          onControlledQueryChange={setQuery}
          hideToolbarSearch
          hideToolbarControls
          controlledView={dealsView}
          onControlledViewChange={setDealsView}
          controlledSortKey={dealsSortKey}
          onControlledSortKeyChange={setDealsSortKey}
          dealsHeadingId="investing-deals-heading"
          hideDealsHeading
          dealsSectionTitle={sectionTitle}
          includeParticipantDeals
          filterOfferingDashboardVisibility
          searchPlaceholder={searchPlaceholder}
          emptyStateMessage={emptyLabel}
        />
      </div>
      </div>

      <ExportDealsModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        deals={exportDeals}
      />
    </section>
  )
}
