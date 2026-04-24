import { Archive, Briefcase, Download, Search, TrendingUp } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { TabsScrollStrip } from "@/common/components/tabs-scroll-strip/TabsScrollStrip"
import {
  DataTable,
  type DataTableColumn,
} from "@/common/components/data-table/DataTable"
import "@/modules/usermanagement/user_management.css"
import "@/modules/Syndication/InvestorPortal/Deals/deal-investors-tab.css"
import "@/modules/Syndication/InvestorPortal/Deals/deals-list.css"
import { DEALS_LIST_REFETCH_EVENT } from "@/modules/Syndication/InvestorPortal/Deals/createDealFormDraftStorage"
import { ExportInvestmentsModal } from "./ExportInvestmentsModal"
import { getMergedInvestmentListRows } from "./investmentsRuntimeData"
import type { InvestmentListRow } from "./investments.types"
import "./investments-page.css"

export type { InvestmentListRow } from "./investments.types"

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

type InvestmentsTab = "investments" | "archives"

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
  const { rows, loading } = useMergedInvestmentRows()
  const [query, setQuery] = useState("")
  const [activeTab, setActiveTab] = useState<InvestmentsTab>("investments")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [exportModalOpen, setExportModalOpen] = useState(false)

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
  }, [activeTab, query])

  const totals = useMemo(() => {
    let invested = 0
    let distributed = 0
    for (const r of filtered) {
      invested += Number.isFinite(r.investedAmount) ? r.investedAmount : 0
      distributed += Number.isFinite(r.distributedAmount)
        ? r.distributedAmount
        : 0
    }
    return { invested, distributed }
  }, [filtered])

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
      /* "Invested as" hidden: one row per deal in the list; per-profile lines live on the investment detail view. */
      // {
      //   id: "investmentProfile",
      //   header: "Invested as",
      //   sortValue: (r) => (r.investmentProfile ?? "").toLowerCase(),
      //   cell: (r) => r.investmentProfile || "—",
      // },
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
        sortValue: (r) => (r.status ?? "").toLowerCase(),
        cell: (r) => r.status || "—",
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

  const emptyMessage =
    activeTab === "archives"
      ? "No archived investments here yet."
      : "No committed investments to show."

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
        <p className="investments_page_lead">
          Your commitments by deal. Select a row to see property details, cash flow, and
          debt information.
        </p>
      </div>

      <div className="um_members_tabs_outer deals_tabs_outer">
        <TabsScrollStrip scrollClassName="deals_tabs_scroll">
          <div
            className="um_members_tabs_row deals_tabs_row"
            role="tablist"
            aria-label="Investment views"
          >
            <button
              type="button"
              id="investments-tab-active"
              role="tab"
              aria-selected={activeTab === "investments"}
              aria-controls="investments-list-tabpanel"
              className={`um_members_tab deals_tabs_tab${activeTab === "investments" ? " um_members_tab_active" : ""}`}
              onClick={() => setActiveTab("investments")}
            >
              <TrendingUp
                className="deals_tabs_icon"
                size={18}
                strokeWidth={1.75}
                aria-hidden
              />
              <span className="deals_tabs_label">Investments</span>
              <span className="deals_tabs_count">({activeCount})</span>
            </button>
            <button
              type="button"
              id="investments-tab-archives"
              role="tab"
              aria-selected={activeTab === "archives"}
              aria-controls="investments-list-tabpanel"
              className={`um_members_tab deals_tabs_tab${activeTab === "archives" ? " um_members_tab_active" : ""}`}
              onClick={() => setActiveTab("archives")}
            >
              <Archive
                className="deals_tabs_icon"
                size={18}
                strokeWidth={1.75}
                aria-hidden
              />
              <span className="deals_tabs_label">Archives</span>
              <span className="deals_tabs_count">({archivedCount})</span>
            </button>
          </div>
        </TabsScrollStrip>
      </div>

      <div className="um_members_tab_content">
        <div
          id="investments-list-tabpanel"
          role="tabpanel"
          aria-labelledby={
            activeTab === "investments"
              ? "investments-tab-active"
              : "investments-tab-archives"
          }
          className={`um_panel um_members_tab_panel deals_list_table_panel deals_list_card_surface deal_inv_table_panel${loading ? " deals_list_table_panel_loading" : ""}`}
          aria-busy={loading}
        >
          <div
            className="um_toolbar deal_inv_table_um_toolbar investments_page_table_toolbar"
            aria-label="Table tools"
          >
            <div className="um_search_wrap">
              <Search className="um_search_icon" size={18} aria-hidden />
              <input
                type="search"
                className="um_search_input"
                placeholder="Search by name, offering, or profile…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Filter investments"
              />
            </div>
            <div className="investments_page_toolbar_end">
              {filtered.length > 0 ? (
                <p className="investments_page_totals" aria-live="polite">
                  <span className="investments_page_totals_count">
                    {filtered.length}
                    {filtered.length === 1
                      ? " result"
                      : " results"}
                  </span>
                  <span className="investments_page_totals_sep" aria-hidden>
                    ·
                  </span>
                  <span>Invested {formatUsd(totals.invested)}</span>
                  <span className="investments_page_totals_sep" aria-hidden>
                    ·
                  </span>
                  <span>Distributed {formatUsd(totals.distributed)}</span>
                </p>
              ) : null}
              <div className="um_toolbar_actions deal_inv_table_toolbar_actions deals_list_toolbar_actions">
                <button
                  type="button"
                  className="um_toolbar_export_btn"
                  onClick={() => setExportModalOpen(true)}
                  title="Download all investments in this list as a CSV file"
                >
                  <Download size={18} strokeWidth={2} aria-hidden />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>
          </div>
          <DataTable<InvestmentListRow>
            visualVariant="members"
            membersShell="plain"
            membersTableClassName="um_table_members deal_inv_table"
            columns={columns}
            rows={filtered}
            isLoading={loading && rows.length === 0}
            getRowKey={(r, i) =>
              (r.dealId && r.dealId.trim()) || r.id || `inv-row-${i}`
            }
            emptyLabel={
              loading && rows.length === 0
                ? "Loading…"
                : query.trim()
                  ? "No investments match this filter. Try a different search."
                  : emptyMessage
            }
            initialSort={{ columnId: "investmentName", direction: "asc" }}
            pagination={filtered.length > 0 ? pagination : undefined}
          />
        </div>
      </div>

      <ExportInvestmentsModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        investments={rows}
      />
    </section>
  )
}
