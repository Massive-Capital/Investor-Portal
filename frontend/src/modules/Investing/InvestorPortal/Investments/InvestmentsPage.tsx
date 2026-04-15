import { Archive, Briefcase, Download, Search, TrendingUp } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { TabsScrollStrip } from "../../../../common/components/tabs-scroll-strip/TabsScrollStrip"
import {
  DataTable,
  type DataTableColumn,
} from "../../../../common/components/data-table/DataTable"
import "../../../usermanagement/user_management.css"
import "../../../Syndication/InvestorPortal/Deals/deal-members/add-investment/add_deal_modal.css"
import "../../../Syndication/InvestorPortal/Deals/deal-investors-tab.css"
import "../../../Syndication/InvestorPortal/Deals/deals-list.css"
import { ExportInvestmentsModal } from "./ExportInvestmentsModal"
import { getInvestmentListRows } from "./investmentsMockData"
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

export default function InvestmentsPage() {
  const [query, setQuery] = useState("")
  const [activeTab, setActiveTab] = useState<InvestmentsTab>("investments")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [rows] = useState<InvestmentListRow[]>(() => getInvestmentListRows())
  const loading = false

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
        header: "Investment name",
        tdClassName: "um_td_user",
        sortValue: (r) => (r.investmentName ?? "").toLowerCase(),
        cell: (r) => (
          <Link
            className="deals_table_name_link"
            to={`/investing/investments/${encodeURIComponent(r.id)}`}
          >
            {r.investmentName || "—"}
          </Link>
        ),
      },
      {
        id: "offeringName",
        header: "Offering name",
        sortValue: (r) => (r.offeringName ?? "").toLowerCase(),
        cell: (r) => r.offeringName || "—",
      },
      {
        id: "investmentProfile",
        header: "Investment profile",
        sortValue: (r) => (r.investmentProfile ?? "").toLowerCase(),
        cell: (r) => r.investmentProfile || "—",
      },
      {
        id: "investedAmount",
        header: (
          <span className="inv_header_stack">
            <span>Invested amount</span>
            <span className="inv_header_sub">
              Total: {formatUsd(totals.invested)}
            </span>
          </span>
        ),
        align: "right",
        thClassName: "deals_th_align_right",
        tdClassName: "um_td_numeric",
        sortValue: (r) => r.investedAmount,
        cell: (r) => formatUsd(r.investedAmount),
      },
      {
        id: "distributedAmount",
        header: (
          <span className="inv_header_stack">
            <span>Distributed amount</span>
            <span className="inv_header_sub">
              Total: {formatUsd(totals.distributed)}
            </span>
          </span>
        ),
        align: "right",
        thClassName: "deals_th_align_right",
        tdClassName: "um_td_numeric",
        sortValue: (r) => r.distributedAmount,
        cell: (r) => formatUsd(r.distributedAmount),
      },
      {
        id: "currentValuation",
        header: "Current valuation",
        sortValue: (r) => (r.currentValuation ?? "").toLowerCase(),
        cell: (r) => r.currentValuation || "—",
      },
      {
        id: "dealCloseDate",
        header: "Deal close date",
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
        header: "Action required",
        sortValue: (r) => (r.actionRequired ?? "").toLowerCase(),
        cell: (r) => r.actionRequired || "—",
      },
    ],
    [totals.invested, totals.distributed],
  )

  const emptyMessage =
    activeTab === "archives"
      ? "No archived investments."
      : "No investment to display."

  return (
    <section className="um_page deals_list_page investments_page">
      <div className="um_members_header_block">
        <div className="um_header_row">
          <h2 className="um_title um_title_with_icon">
            <Briefcase
              className="um_title_icon"
              size={26}
              strokeWidth={1.75}
              aria-hidden
            />
            Investments
          </h2>
        </div>
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
          <div className="um_toolbar deal_inv_table_um_toolbar">
            <div className="um_search_wrap">
              <Search className="um_search_icon" size={18} aria-hidden />
              <input
                type="search"
                className="um_search_input"
                placeholder="Search investments…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search investments"
              />
            </div>
            <div className="um_toolbar_actions deal_inv_table_toolbar_actions deals_list_toolbar_actions">
              <button
                type="button"
                className="um_toolbar_export_btn"
                onClick={() => setExportModalOpen(true)}
              >
                <Download size={18} strokeWidth={2} aria-hidden />
                <span>Export all investments</span>
              </button>
            </div>
          </div>
          <DataTable<InvestmentListRow>
            visualVariant="members"
            membersTableClassName="um_table_members deal_inv_table"
            columns={columns}
            rows={filtered}
            getRowKey={(r, i) => r.id || `inv-row-${i}`}
            emptyLabel={
              loading && rows.length === 0
                ? "Loading investments…"
                : query.trim()
                  ? "No investments match your search."
                  : emptyMessage
            }
            initialSort={{ columnId: "actionRequired", direction: "asc" }}
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
