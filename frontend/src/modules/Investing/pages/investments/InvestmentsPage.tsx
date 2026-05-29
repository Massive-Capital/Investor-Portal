import {
  Archive,
  Briefcase,
  Clock,
  Download,
  Search,
  TrendingUp,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { usePortalMode } from "@/modules/Investing/context/PortalModeContext"
import { dealInvestNowPath } from "@/modules/Syndication/Deals/utils/dealInvestNowPath"
import { dealWorkspacePath } from "@/modules/Syndication/Deals/utils/dealWorkspacePath"
import { TabsScrollStrip } from "@/common/components/tabs-scroll-strip/TabsScrollStrip"
import {
  DataTable,
  type DataTableColumn,
} from "@/common/components/data-table/DataTable"
// import { DealsListPage } from "@/modules/Syndication/Deals/DealsListPage"
import { DealRowActions } from "@/modules/Syndication/Deals/components/DealRowActions"
import {
  dateSortValue,
  dealTypeDisplayLabel,
  formatDealListDateDisplay,
  secTypeDisplayLabel,
} from "@/modules/Syndication/Deals/dealsListDisplay"
import { dealStageLabel } from "@/modules/Syndication/dealsDashboardUtils"
import "@/modules/Syndication/usermanagement/user_management.css"
import "@/modules/Syndication/Deals/deal-investors-tab.css"
import "@/modules/Syndication/Deals/deals-list.css"
import { DEALS_LIST_REFETCH_EVENT } from "@/modules/Syndication/Deals/createDealFormDraftStorage"
import { ExportInvestmentsModal } from "./ExportInvestmentsModal"
import { resolveInvestmentOnboardingBucket } from "./investmentOnboardingBucket"
import { getMergedInvestmentListRows } from "./investmentsRuntimeData"
import type { InvestmentListRow } from "./investments.types"
import "@/common/components/data-table/data-table.css"
import "./investments-page.css"

export type { InvestmentListRow } from "./investments.types"

const INVESTMENTS_TAB_PARAM = "tab"

type InvestmentsPageTab = "in_progress" | "pending" | "archives"

const TAB_IDS: Record<InvestmentsPageTab, string> = {
  in_progress: "investments-tab-in-progress",
  pending: "investments-tab-pending",
  archives: "investments-tab-archives",
}

function parseInvestmentsTab(value: string | null): InvestmentsPageTab {
  if (value === "archives") return "archives"
  if (value === "pending") return "pending"
  // Legacy `?tab=investments` / `deals` — default to In progress.
  return "in_progress"
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

/** Deal name cell — same avatar + link layout as {@link DealsListPage} `DealListNameCell`. */
function InvestmentDealNameCell({
  row,
  pendingOnboarding,
}: {
  row: InvestmentListRow
  pendingOnboarding?: boolean
}) {
  const { switchToInvesting } = usePortalMode()
  const dealId = (row.dealId ?? row.id ?? "").trim()
  const name = row.investmentName?.trim() || "—"
  const nameLink = dealId ? (
    <Link
      className="deals_table_name_link"
      to={
        pendingOnboarding
          ? dealWorkspacePath(dealId)
          : `/investing/investments/${encodeURIComponent(dealId)}`
      }
      onClick={() => switchToInvesting()}
      state={
        pendingOnboarding
          ? { returnTo: "/investing/investments?tab=pending" }
          : undefined
      }
    >
      {name}
    </Link>
  ) : (
    <span className="deals_table_name_link">{name}</span>
  )

  return (
    <div className="deals_list_name_cell">
      <div className="deals_list_deal_avatar" aria-hidden>
        <Briefcase size={18} strokeWidth={1.75} />
      </div>
      <div className="deals_list_name_text">
        <div className="deals_list_name_primary">{nameLink}</div>
      </div>
    </div>
  )
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
  const isInitialLoad = loading && totalRows === 0

  return (
    <div
      className={`um_panel um_members_tab_panel deals_list_table_panel deals_list_card_surface deal_inv_table_panel${
        isInitialLoad ? " investments_page_loading_panel" : ""
      }${loading ? " deals_list_table_panel_loading" : ""}`}
      aria-busy={loading}
    >
      {isInitialLoad ? (
        <div
          className="investments_page_loading"
          role="status"
          aria-live="polite"
          aria-label="Loading investments"
        >
          <div className="data_table_loader_spinner" aria-hidden />
          <span className="investments_page_loading_text">Loading investments…</span>
        </div>
      ) : (
        <>
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
            isLoading={loading}
            getRowKey={(r, i) =>
              (r.dealId && r.dealId.trim()) || r.id || `inv-row-${i}`
            }
            emptyLabel={
              query.trim()
                ? "No investments match your search."
                : emptyMessage
            }
            initialSort={{ columnId: "dealName", direction: "asc" }}
            pagination={filtered.length > 0 ? pagination : undefined}
          />
        </>
      )}
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
  const navigate = useNavigate()
  const { switchToInvesting } = usePortalMode()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = parseInvestmentsTab(searchParams.get(INVESTMENTS_TAB_PARAM))
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
          if (tab === "in_progress") {
            next.delete(INVESTMENTS_TAB_PARAM)
          } else {
            next.set(INVESTMENTS_TAB_PARAM, tab)
          }
          return next
        },
        { replace: true },
      )
      setQuery("")
    },
    [setSearchParams],
  )

  const { inProgressCount, pendingCount, archivedCount } = useMemo(() => {
    let inProgress = 0
    let pending = 0
    let archived = 0
    for (const r of rows) {
      if (r.archived) {
        archived++
        continue
      }
      if (resolveInvestmentOnboardingBucket(r) === "pending") pending++
      else inProgress++
    }
    return {
      inProgressCount: inProgress,
      pendingCount: pending,
      archivedCount: archived,
    }
  }, [rows])

  const rowsForTab = useMemo(() => {
    if (activeTab === "archives") {
      return rows.filter((r) => Boolean(r.archived))
    }
    return rows.filter((r) => {
      if (r.archived) return false
      const bucket = resolveInvestmentOnboardingBucket(r)
      return activeTab === "pending"
        ? bucket === "pending"
        : bucket === "in_progress"
    })
  }, [rows, activeTab])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return [...rowsForTab]
    return rowsForTab.filter((r) => {
      const haystack = [
        r.investmentName,
        r.offeringName,
        r.investmentProfile,
        r.viewerRolesLabel,
        r.dealType,
        r.secType,
        r.propertyName,
        r.owningEntityName,
        dealStageLabel(r.status ?? ""),
      ]
        .map((s) => String(s ?? "").toLowerCase())
        .join(" ")
      return haystack.includes(q)
    })
  }, [query, rowsForTab])

  useEffect(() => {
    setPage(1)
  }, [activeTab, query])

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

  const openDealPreview = useCallback(
    (dealId: string, returnTab?: InvestmentsPageTab) => {
      const id = dealId.trim()
      if (!id) return
      switchToInvesting()
      const returnTo =
        returnTab === "pending"
          ? "/investing/investments?tab=pending"
          : "/investing/investments"
      navigate(dealWorkspacePath(id), { state: { returnTo } })
    },
    [navigate, switchToInvesting],
  )

  const openInvestNow = useCallback(
    (dealId: string) => {
      const id = dealId.trim()
      if (!id) return
      switchToInvesting()
      navigate(dealInvestNowPath(id), {
        state: { returnTo: "/investing/investments" },
      })
    },
    [navigate, switchToInvesting],
  )

  const columns: DataTableColumn<InvestmentListRow>[] = useMemo(
    () => [
      {
        id: "dealName",
        header: "Deal name",
        tdClassName: "um_td_user",
        sortValue: (r) => (r.investmentName ?? "").toLowerCase(),
        cell: (r) => (
          <InvestmentDealNameCell
            row={r}
            pendingOnboarding={
              activeTab === "pending" ||
              resolveInvestmentOnboardingBucket(r) === "pending"
            }
          />
        ),
      },
      // {
      //   id: "dealStage",
      //   header: "Deal stage",
      //   sortValue: (r) => dealStageLabel(r.status ?? "").toLowerCase(),
      //   cell: (r) => {
      //     const label = dealStageLabel(r.status ?? "").trim() || "—"
      //     if (label === "—") {
      //       return <span className="um_status_muted">—</span>
      //     }
      //     return (
      //       <span
      //         className={dealStageChipCompactClassName(r.status)}
      //         title={`Stage: ${label}`}
      //       >
      //         <span className="deals_list_stage_badge_icon" aria-hidden>
      //           <CircleDot size={12} strokeWidth={2} />
      //         </span>
      //         <span>{label}</span>
      //       </span>
      //     )
      //   },
      // },
      // {
      //   id: "yourRole",
      //   header: "Your role",
      //   sortValue: (r) => (r.viewerRolesLabel ?? "").toLowerCase(),
      //   cell: (r) => {
      //     const label = (r.viewerRolesLabel ?? "").trim() || "—"
      //     if (label === "—") {
      //       return <span className="um_status_muted">—</span>
      //     }
      //     return <span className="deals_list_viewer_role_label">{label}</span>
      //   },
      // },
      {
        id: "dealType",
        header: "Deal type",
        sortValue: (r) => (r.dealType ?? "").toLowerCase(),
        cell: (r) => dealTypeDisplayLabel(r.dealType ?? ""),
      },
      {
        id: "secType",
        header: "SEC type",
        sortValue: (r) => secTypeDisplayLabel(r.secType ?? "").toLowerCase(),
        cell: (r) => secTypeDisplayLabel(r.secType ?? ""),
      },
      {
        id: "propertyName",
        header: "Property name",
        sortValue: (r) => (r.propertyName ?? "").toLowerCase(),
        cell: (r) => {
          const t = String(r.propertyName ?? "").trim()
          return t || "—"
        },
      },
      {
        id: "owningEntity",
        header: "Owning entity",
        sortValue: (r) => (r.owningEntityName ?? "").toLowerCase(),
        cell: (r) => {
          const t = String(r.owningEntityName ?? "").trim()
          return t || "—"
        },
      },
      {
        id: "start",
        header: "Start date",
        align: "center",
        thClassName: "deals_th_align_center investments_col_start_date",
        tdClassName: "investments_col_start_date",
        sortValue: (r) => dateSortValue(r.startDateDisplay),
        cell: (r) => formatDealListDateDisplay(r.startDateDisplay),
      },
      {
        id: "close",
        header: "Close date",
        align: "center",
        thClassName: "deals_th_align_center",
        sortValue: (r) => dateSortValue(r.dealCloseDate),
        cell: (r) => formatDealListDateDisplay(r.dealCloseDate),
      },
      {
        id: "investmentProfile",
        header: "Invested as",
        thClassName: "investments_col_invested_as",
        tdClassName: "investments_col_invested_as",
        sortValue: (r) => (r.investmentProfile ?? "").toLowerCase(),
        cell: (r) => {
          const text = r.investmentProfile?.trim() || "—"
          return (
            <span
              className="investments_invested_as_cell"
              title={text !== "—" ? text : undefined}
            >
              {text}
            </span>
          )
        },
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
      // {
      //   id: "actionRequired",
      //   header: "Action",
      //   sortValue: (r) => (r.actionRequired ?? "").toLowerCase(),
      //   cell: (r) => r.actionRequired || "—",
      // },
      {
        id: "actions",
        header: "Actions",
        align: "center",
        thClassName: "um_th_actions deals_th_actions_head",
        tdClassName: "um_td_actions deal_inv_td_actions",
        cell: (r) => {
          const dealId = (r.dealId ?? r.id ?? "").trim()
          if (!dealId) return null
          const isPending =
            activeTab === "pending" ||
            resolveInvestmentOnboardingBucket(r) === "pending"
          return (
            <div className="deal_members_actions_cell">
              <DealRowActions
                readOnlyActions
                dealId={dealId}
                dealName={r.investmentName}
                dealStage={r.status}
                archived={Boolean(r.archived)}
                onPreviewDeal={
                  r.archived || !isPending
                    ? undefined
                    : () => openDealPreview(dealId, "pending")
                }
                onInvestNow={
                  r.archived ? undefined : () => openInvestNow(dealId)
                }
              />
            </div>
          )
        },
      },
    ],
    [activeTab, openDealPreview, openInvestNow],
  )

  const investmentsEmptyMessage =
    activeTab === "archives"
      ? "No archived deals or investments here yet."
      : activeTab === "pending"
        ? "No deals awaiting investor onboarding."
        : "No active investments in your portfolio yet."

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
            {/* Deals tab merged into Investments — same columns, single table. */}
            {/* <button
              type="button"
              id="investments-tab-deals"
              role="tab"
              aria-selected={false}
              aria-controls="investments-list-tabpanel"
              className="um_members_tab deals_tabs_tab um_segmented_tab"
              onClick={() => setActiveTab("deals")}
            >
              <Briefcase
                className="deals_tabs_icon um_segmented_tab_icon"
                size={16}
                strokeWidth={2}
                aria-hidden
              />
              <span className="deals_tabs_label um_segmented_tab_label">Deals</span>
            </button> */}
            <button
              type="button"
              id={TAB_IDS.in_progress}
              role="tab"
              aria-selected={activeTab === "in_progress"}
              aria-controls="investments-list-tabpanel"
              className={`um_members_tab deals_tabs_tab um_segmented_tab${activeTab === "in_progress" ? " um_members_tab_active" : ""}`}
              onClick={() => setActiveTab("in_progress")}
            >
              <TrendingUp
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
            <button
              type="button"
              id={TAB_IDS.pending}
              role="tab"
              aria-selected={activeTab === "pending"}
              aria-controls="investments-list-tabpanel"
              className={`um_members_tab deals_tabs_tab um_segmented_tab${activeTab === "pending" ? " um_members_tab_active" : ""}`}
              onClick={() => setActiveTab("pending")}
            >
              <Clock
                className="deals_tabs_icon um_segmented_tab_icon"
                size={16}
                strokeWidth={2}
                aria-hidden
              />
              <span className="deals_tabs_label um_segmented_tab_label">
                Pending
              </span>
              <span className="deals_tabs_count">({pendingCount})</span>
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
          {/* Former Deals tab — embedded list commented out; deal columns live on Investments. */}
          {/* <div hidden aria-hidden>
            <DealsListPage
              dealsListContext="investing"
              embedded
            />
          </div> */}
          <InvestmentsTablePanel
            {...investmentsTablePanelProps}
            searchAriaLabel={
              activeTab === "archives"
                ? "Search archived investments"
                : activeTab === "pending"
                  ? "Search pending investments"
                  : "Search in-progress investments"
            }
          />
        </div>
      </div>

      <ExportInvestmentsModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        investments={rowsForTab}
      />
    </section>
  )
}
