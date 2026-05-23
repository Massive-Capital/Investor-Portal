import { Archive, Briefcase, CircleDot, Download, Search, TrendingUp } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { TabsScrollStrip } from "@/common/components/tabs-scroll-strip/TabsScrollStrip"
import {
  DataTable,
  type DataTableColumn,
} from "@/common/components/data-table/DataTable"
import { DealsListPage } from "@/modules/Syndication/Deals/DealsListPage"
import { dealStageLabel } from "@/modules/Syndication/dealsDashboardUtils"
import { dealStageChipCompactClassName } from "@/modules/Syndication/Deals/utils/dealStageChip"
import "@/modules/Syndication/usermanagement/user_management.css"
import "@/modules/Syndication/Deals/deal-investors-tab.css"
import "@/modules/Syndication/Deals/deals-list.css"
import { DEALS_LIST_REFETCH_EVENT } from "@/modules/Syndication/Deals/createDealFormDraftStorage"
import { ExportInvestmentsModal } from "./ExportInvestmentsModal"
import { getMergedInvestmentListRows } from "./investmentsRuntimeData"
import type { InvestmentListRow } from "./investments.types"
import "./investments-page.css"

export type { InvestmentListRow } from "./investments.types"

const INVESTMENTS_TAB_PARAM = "tab"
const ARCHIVES_SUB_TAB_PARAM = "archive"

type InvestmentsPageTab = "deals" | "investments" | "archives"
type ArchivesSubTab = "deals" | "investments"

const TAB_IDS: Record<InvestmentsPageTab, string> = {
  deals: "investments-tab-deals",
  investments: "investments-tab-active",
  archives: "investments-tab-archives",
}

const ARCHIVES_TAB_IDS: Record<ArchivesSubTab, string> = {
  deals: "investments-archives-tab-deals",
  investments: "investments-archives-tab-investments",
}

function parseInvestmentsTab(value: string | null): InvestmentsPageTab {
  if (value === "deals" || value === "investments" || value === "archives") {
    return value
  }
  return "investments"
}

function parseArchivesSubTab(value: string | null): ArchivesSubTab {
  if (value === "deals") return "deals"
  return "investments"
}

function formatUsd(n: number): string {
  const abs = Math.abs(n)
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(abs)
  return n < 0 ? `(${formatted})` : formatted
}

type InvestmentsTablePanelProps = {
  loading: boolean
  totalRows: number
  query: string
  onQueryChange: (value: string) => void
  onExport: () => void
  searchAriaLabel: string
  columns: DataTableColumn<InvestmentListRow>[]
  filtered: InvestmentListRow[]
  emptyMessage: string
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    onPageChange: (nextPage: number) => void
    onPageSizeChange: (nextSize: number) => void
    ariaLabel: string
  }
}

/** Same table shell as {@link DealsListPage} investing list (`deal_inv_table_panel`). */
function InvestmentsTablePanel({
  loading,
  totalRows,
  query,
  onQueryChange,
  onExport,
  searchAriaLabel,
  columns,
  filtered,
  emptyMessage,
  pagination,
}: InvestmentsTablePanelProps) {
  return (
    <div
      className={`um_panel um_members_tab_panel deals_list_table_panel deals_list_card_surface deal_inv_table_panel${loading && totalRows === 0 ? " deals_list_table_panel_loading" : ""}`}
      aria-busy={loading}
    >
      <div className="um_toolbar deal_inv_table_um_toolbar um_toolbar_export_then_search">
        <div className="um_toolbar_actions deal_inv_table_toolbar_actions deals_list_toolbar_actions">
          <button
            type="button"
            className="um_toolbar_export_btn"
            onClick={onExport}
          >
            <Download size={18} strokeWidth={2} aria-hidden />
            <span>Export All</span>
          </button>
        </div>
        <div className="um_search_wrap">
          <Search className="um_search_icon" size={18} aria-hidden />
          <input
            type="search"
            className="um_search_input"
            placeholder="Search investments…"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            aria-label={searchAriaLabel}
          />
        </div>
      </div>
      <DataTable<InvestmentListRow>
        visualVariant="members"
        membersTableClassName="um_table_members deal_inv_table"
        columns={columns}
        rows={filtered}
        getRowKey={(r, i) =>
          (r.dealId && r.dealId.trim()) || r.id || `inv-row-${i}`
        }
        emptyLabel={
          loading && totalRows === 0
            ? "Loading…"
            : query.trim()
              ? "No investments match your search."
              : emptyMessage
        }
        initialSort={{ columnId: "investmentName", direction: "asc" }}
        pagination={filtered.length > 0 ? pagination : undefined}
      />
    </div>
  )
}

function useMergedInvestmentRows() {
  const [rows, setRows] = useState<InvestmentListRow[]>([])
  const [loading, setLoading] = useState(true)
  const reload = useCallback(() => {
    void (async () => {
      setLoading(true)
      try {
        setRows(await getMergedInvestmentListRows())
      } finally {
        setLoading(false)
      }
    })()
  }, [])
  useEffect(() => {
    reload()
  }, [reload])
  useEffect(() => {
    function onRefetch() {
      void (async () => {
        setRows(await getMergedInvestmentListRows())
      })()
    }
    window.addEventListener(DEALS_LIST_REFETCH_EVENT, onRefetch)
    return () =>
      window.removeEventListener(DEALS_LIST_REFETCH_EVENT, onRefetch)
  }, [])
  return { rows, setRows, loading, reload }
}

export default function InvestmentsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = parseInvestmentsTab(searchParams.get(INVESTMENTS_TAB_PARAM))
  const archivesSubTab = parseArchivesSubTab(
    searchParams.get(ARCHIVES_SUB_TAB_PARAM),
  )
  const { rows, loading } = useMergedInvestmentRows()
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [exportModalOpen, setExportModalOpen] = useState(false)

  const setActiveTab = useCallback(
    (tab: InvestmentsPageTab) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (tab === "investments") {
            next.delete(INVESTMENTS_TAB_PARAM)
            next.delete(ARCHIVES_SUB_TAB_PARAM)
          } else {
            next.set(INVESTMENTS_TAB_PARAM, tab)
            if (tab !== "archives") {
              next.delete(ARCHIVES_SUB_TAB_PARAM)
            }
          }
          return next
        },
        { replace: true },
      )
      setQuery("")
    },
    [setSearchParams],
  )

  const setArchivesSubTab = useCallback(
    (subTab: ArchivesSubTab) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set(INVESTMENTS_TAB_PARAM, "archives")
          if (subTab === "investments") {
            next.delete(ARCHIVES_SUB_TAB_PARAM)
          } else {
            next.set(ARCHIVES_SUB_TAB_PARAM, subTab)
          }
          return next
        },
        { replace: true },
      )
      setQuery("")
    },
    [setSearchParams],
  )

  const { activeCount, archivedCount } = useMemo(() => {
    let active = 0
    let archived = 0
    for (const r of rows) {
      if (r.archived) archived++
      else active++
    }
    return { activeCount: active, archivedCount: archived }
  }, [rows])

  const rowsForTab = useMemo(
    () =>
      rows.filter((r) =>
        activeTab === "archives" ? Boolean(r.archived) : !r.archived,
      ),
    [rows, activeTab],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return [...rowsForTab]
    return rowsForTab.filter(
      (r) =>
        (r.investmentName ?? "").toLowerCase().includes(q) ||
        (r.offeringName ?? "").toLowerCase().includes(q) ||
        (r.investmentProfile ?? "").toLowerCase().includes(q),
    )
  }, [query, rowsForTab])

  useEffect(() => {
    setPage(1)
  }, [activeTab, archivesSubTab, query])

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
    if (page > totalPages) setPage(totalPages)
  }, [filtered.length, pageSize, page])

  const pagination = useMemo(
    () => ({
      page,
      pageSize,
      totalItems: filtered.length,
      onPageChange: setPage,
      onPageSizeChange: (n: number) => {
        setPageSize(n)
        setPage(1)
      },
      ariaLabel: "Investments table pagination",
    }),
    [page, pageSize, filtered.length],
  )

  const columns: DataTableColumn<InvestmentListRow>[] = useMemo(
    () => [
      {
        id: "investmentName",
        header: "Investment",
        tdClassName: "um_td_user",
        sortValue: (r) => (r.investmentName ?? "").toLowerCase(),
        cell: (r) => (
          <Link
            className="deals_table_name_link"
            to={`/investing/investments/${encodeURIComponent(r.dealId || r.id)}`}
          >
            {r.investmentName || "—"}
          </Link>
        ),
      },
      {
        id: "offeringName",
        header: "Offering",
        sortValue: (r) => (r.offeringName ?? "").toLowerCase(),
        cell: (r) => r.offeringName || "—",
      },
      {
        id: "investedAmount",
        header: "Invested",
        align: "right",
        thClassName: "deals_th_align_right",
        tdClassName: "um_td_numeric",
        sortValue: (r) => r.investedAmount,
        cell: (r) => formatUsd(r.investedAmount),
      },
      {
        id: "distributedAmount",
        header: "Distributed",
        align: "right",
        thClassName: "deals_th_align_right",
        tdClassName: "um_td_numeric",
        sortValue: (r) => r.distributedAmount,
        cell: (r) => formatUsd(r.distributedAmount),
      },
      {
        id: "currentValuation",
        header: "Valuation",
        sortValue: (r) => (r.currentValuation ?? "").toLowerCase(),
        cell: (r) => r.currentValuation || "—",
      },
      {
        id: "dealCloseDate",
        header: "Close date",
        sortValue: (r) => (r.dealCloseDate ?? "").toLowerCase(),
        cell: (r) => r.dealCloseDate || "—",
      },
      {
        id: "status",
        header: "Status",
        sortValue: (r) => dealStageLabel(r.status ?? "").toLowerCase(),
        cell: (r) => {
          const label = dealStageLabel(r.status ?? "").trim() || "—"
          if (label === "—") {
            return <span className="um_status_muted">—</span>
          }
          return (
            <span
              className={dealStageChipCompactClassName(r.status)}
              title={`Status: ${label}`}
            >
              <span className="deals_list_stage_badge_icon" aria-hidden>
                <CircleDot size={12} strokeWidth={2} />
              </span>
              <span>{label}</span>
            </span>
          )
        },
      },
      {
        id: "actionRequired",
        header: "Action",
        sortValue: (r) => (r.actionRequired ?? "").toLowerCase(),
        cell: (r) => r.actionRequired || "—",
      },
    ],
    [],
  )

  const investmentsEmptyMessage =
    activeTab === "archives"
      ? "No archived investments here yet."
      : "No committed investments to show."

  const investmentsTablePanelProps = {
    loading,
    totalRows: rows.length,
    query,
    onQueryChange: setQuery,
    onExport: () => setExportModalOpen(true),
    columns,
    filtered,
    emptyMessage: investmentsEmptyMessage,
    pagination,
  } as const

  // const pageLead =
  //   activeTab === "deals"
  //     ? "Deals in your investing scope — organization deals and deals where you are on the roster."
  //     : activeTab === "archives"
  //       ? "Archived investments and deals."
  //       : "Your commitments by deal. Select a row to see property details, cash flow, and debt information."
  const pageLead = ""

  return (
    <section
      className="um_page deals_list_page investments_page"
      aria-labelledby="investments-page-title"
    >
      <div className="um_members_header_block investments_page_header">
        <div className="um_header_row">
          <h2 className="um_title um_title_with_icon" id="investments-page-title">
            <Briefcase
              className="um_title_icon"
              size={26}
              strokeWidth={1.75}
              aria-hidden
            />
            Investments
          </h2>
        </div>
        {pageLead ? (
          <p className="investments_page_lead">{pageLead}</p>
        ) : null}
      </div>

      <div className="um_members_tabs_outer deals_tabs_outer um_segmented_tabs_outer">
        <TabsScrollStrip scrollClassName="deals_tabs_scroll um_segmented_tabs_scroll">
          <div
            className="um_members_tabs_row deals_tabs_row um_segmented_tabs_row"
            role="tablist"
            aria-label="Investment views"
          >
            <button
              type="button"
              id={TAB_IDS.deals}
              role="tab"
              aria-selected={activeTab === "deals"}
              aria-controls="investments-list-tabpanel"
              className={`um_members_tab deals_tabs_tab um_segmented_tab${activeTab === "deals" ? " um_members_tab_active" : ""}`}
              onClick={() => setActiveTab("deals")}
            >
              <Briefcase
                className="deals_tabs_icon um_segmented_tab_icon"
                size={16}
                strokeWidth={2}
                aria-hidden
              />
              <span className="deals_tabs_label um_segmented_tab_label">Deals</span>
            </button>
            <button
              type="button"
              id={TAB_IDS.investments}
              role="tab"
              aria-selected={activeTab === "investments"}
              aria-controls="investments-list-tabpanel"
              className={`um_members_tab deals_tabs_tab um_segmented_tab${activeTab === "investments" ? " um_members_tab_active" : ""}`}
              onClick={() => setActiveTab("investments")}
            >
              <TrendingUp
                className="deals_tabs_icon um_segmented_tab_icon"
                size={16}
                strokeWidth={2}
                aria-hidden
              />
              <span className="deals_tabs_label um_segmented_tab_label">
                Investments
              </span>
              <span className="deals_tabs_count">({activeCount})</span>
            </button>
            <button
              type="button"
              id={TAB_IDS.archives}
              role="tab"
              aria-selected={activeTab === "archives"}
              aria-controls="investments-list-tabpanel"
              className={`um_members_tab deals_tabs_tab um_segmented_tab${activeTab === "archives" ? " um_members_tab_active" : ""}`}
              onClick={() => setActiveTab("archives")}
            >
              <Archive
                className="deals_tabs_icon um_segmented_tab_icon"
                size={16}
                strokeWidth={2}
                aria-hidden
              />
              <span className="deals_tabs_label um_segmented_tab_label">
                Archives
              </span>
              <span className="deals_tabs_count">({archivedCount})</span>
            </button>
          </div>
        </TabsScrollStrip>
      </div>

      <div className="um_members_tab_content">
        <div
          id="investments-list-tabpanel"
          role="tabpanel"
          aria-labelledby={TAB_IDS[activeTab]}
        >
          {activeTab === "deals" ? (
            <DealsListPage dealsListContext="investing" embedded />
          ) : activeTab === "archives" ? (
            <>
              <div className="um_members_tabs_outer deals_tabs_outer um_segmented_tabs_outer investments_archives_subtabs">
                <TabsScrollStrip scrollClassName="deals_tabs_scroll um_segmented_tabs_scroll">
                  <div
                    className="um_members_tabs_row deals_tabs_row um_segmented_tabs_row"
                    role="tablist"
                    aria-label="Archive views"
                  >
                    <button
                      type="button"
                      id={ARCHIVES_TAB_IDS.deals}
                      role="tab"
                      aria-selected={archivesSubTab === "deals"}
                      aria-controls="investments-archives-tabpanel"
                      className={`um_members_tab deals_tabs_tab um_segmented_tab${archivesSubTab === "deals" ? " um_members_tab_active" : ""}`}
                      onClick={() => setArchivesSubTab("deals")}
                    >
                      <Briefcase
                        className="deals_tabs_icon um_segmented_tab_icon"
                        size={16}
                        strokeWidth={2}
                        aria-hidden
                      />
                      <span className="deals_tabs_label um_segmented_tab_label">
                        Deals
                      </span>
                    </button>
                    <button
                      type="button"
                      id={ARCHIVES_TAB_IDS.investments}
                      role="tab"
                      aria-selected={archivesSubTab === "investments"}
                      aria-controls="investments-archives-tabpanel"
                      className={`um_members_tab deals_tabs_tab um_segmented_tab${archivesSubTab === "investments" ? " um_members_tab_active" : ""}`}
                      onClick={() => setArchivesSubTab("investments")}
                    >
                      <TrendingUp
                        className="deals_tabs_icon um_segmented_tab_icon"
                        size={16}
                        strokeWidth={2}
                        aria-hidden
                      />
                      <span className="deals_tabs_label um_segmented_tab_label">
                        Investments
                      </span>
                      <span className="deals_tabs_count">({archivedCount})</span>
                    </button>
                  </div>
                </TabsScrollStrip>
              </div>
              <div
                id="investments-archives-tabpanel"
                role="tabpanel"
                aria-labelledby={ARCHIVES_TAB_IDS[archivesSubTab]}
                className="investments_archives_tabpanel"
              >
                {archivesSubTab === "deals" ? (
                  <DealsListPage
                    dealsListContext="investing"
                    embedded
                    investingArchiveView="archived"
                  />
                ) : (
                  <InvestmentsTablePanel
                    {...investmentsTablePanelProps}
                    searchAriaLabel="Search archived investments"
                  />
                )}
              </div>
            </>
          ) : (
            <InvestmentsTablePanel
              {...investmentsTablePanelProps}
              searchAriaLabel="Search investments"
            />
          )}
        </div>
      </div>

      {activeTab !== "deals" ? (
        <ExportInvestmentsModal
          open={exportModalOpen}
          onClose={() => setExportModalOpen(false)}
          investments={rowsForTab}
        />
      ) : null}
    </section>
  )
}
