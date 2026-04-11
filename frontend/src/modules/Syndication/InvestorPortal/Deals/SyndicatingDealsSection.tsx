import { ArrowUpDown, LayoutGrid, LayoutList, Search } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  DataTable,
  type DataTableColumn,
} from "../../../../common/components/data-table/DataTable"
import { DealCard } from "../../../../common/components/deal-card/DealCard"
import {
  dealListRowToDealRecord,
  mergeDealRecordWithInvestorsAndClasses,
  type DealRecord,
} from "../deals-mock-data"
import {
  fetchDealInvestorClasses,
  fetchDealInvestors,
  fetchDealsList,
} from "./api/dealsApi"
import { DEALS_LIST_REFETCH_EVENT } from "./createDealFormDraftStorage"
import {
  dateSortValue,
  formatDealListDateDisplay,
} from "./dealsListDisplay"
import { parseMoneyDigits } from "./utils/offeringMoneyFormat"
import "../Dashboard/sponsor-dashboard.css"

export type DealsSortKey = "createdAt" | "title" | "target"

export function dealToCardMetrics(deal: DealRecord) {
  return [
    { label: "Target amount", value: deal.targetAmount },
    { label: "Total accepted", value: deal.totalAccepted },
    { label: "Total funded", value: deal.totalFunded },
    { label: "Total distributions", value: deal.totalDistributions },
    { label: "# of investors", value: deal.investorCount },
    {
      label: "Close date",
      value: formatDealListDateDisplay(deal.closeDate),
    },
  ]
}

interface SyndicatingDealsSectionProps {
  /** `aria-labelledby` on the section when `hideDealsHeading` is true */
  ariaLabelledBy?: string
  /** Hide the in-section “Deals” h2 (e.g. when the page already has an h1) */
  hideDealsHeading?: boolean
  /** id for the visible “Deals” h2 when `hideDealsHeading` is false */
  dealsHeadingId?: string
}

export function SyndicatingDealsSection({
  ariaLabelledBy,
  hideDealsHeading = false,
  dealsHeadingId = "sponsor-deals-heading",
}: SyndicatingDealsSectionProps) {
  const [query, setQuery] = useState("")
  const [view, setView] = useState<"grid" | "list">("grid")
  const [sortKey, setSortKey] = useState<DealsSortKey>("createdAt")
  const [deals, setDeals] = useState<DealRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      const list = await fetchDealsList()
      if (cancelled) return
      if (list.length === 0) {
        setDeals([])
        setLoading(false)
        return
      }
      const bundles = await Promise.all(
        list.map(async (row) => {
          const [payload, classes] = await Promise.all([
            fetchDealInvestors(row.id),
            fetchDealInvestorClasses(row.id),
          ])
          return { row, payload, classes }
        }),
      )
      if (cancelled) return
      setDeals(
        bundles.map(({ row, payload, classes }) =>
          mergeDealRecordWithInvestorsAndClasses(
            row,
            dealListRowToDealRecord(row),
            payload,
            classes,
          ),
        ),
      )
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    function onDealsListRefetch() {
      void (async () => {
        setLoading(true)
        const list = await fetchDealsList()
        if (list.length === 0) {
          setDeals([])
          setLoading(false)
          return
        }
        const bundles = await Promise.all(
          list.map(async (row) => {
            const [payload, classes] = await Promise.all([
              fetchDealInvestors(row.id),
              fetchDealInvestorClasses(row.id),
            ])
            return { row, payload, classes }
          }),
        )
        setDeals(
          bundles.map(({ row, payload, classes }) =>
            mergeDealRecordWithInvestorsAndClasses(
              row,
              dealListRowToDealRecord(row),
              payload,
              classes,
            ),
          ),
        )
        setLoading(false)
      })()
    }
    window.addEventListener(DEALS_LIST_REFETCH_EVENT, onDealsListRefetch)
    return () =>
      window.removeEventListener(DEALS_LIST_REFETCH_EVENT, onDealsListRefetch)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return [...deals]
    return deals.filter(
      (d) =>
        (d.title ?? "").toLowerCase().includes(q) ||
        (d.location && d.location.toLowerCase().includes(q)),
    )
  }, [query, deals])

  const gridSorted = useMemo(() => {
    const rows = [...filtered]
    if (sortKey === "title")
      rows.sort((a, b) => a.title.localeCompare(b.title))
    if (sortKey === "target")
      rows.sort((a, b) => {
        const na = parseMoneyDigits(a.targetAmount)
        const nb = parseMoneyDigits(b.targetAmount)
        const da = Number.isFinite(na) ? na : 0
        const db = Number.isFinite(nb) ? nb : 0
        return db - da
      })
    if (sortKey === "createdAt")
      rows.sort((a, b) =>
        (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
      )
    return rows
  }, [filtered, sortKey])

  const columns: DataTableColumn<DealRecord>[] = useMemo(
    () => [
      {
        id: "deal",
        header: "Deal",
        sortValue: (row) => (row.title ?? "").toLowerCase(),
        cell: (row) => (
          <Link
            className="sponsor_dash_table_link"
            to={`/deals/${encodeURIComponent(row.id)}`}
          >
            {row.title || "—"}
          </Link>
        ),
      },
      {
        id: "location",
        header: "Location",
        sortValue: (row) => row.location ?? "",
        cell: (row) => (
          <span className="sponsor_dash_table_muted">
            {row.location ?? "—"}
          </span>
        ),
      },
      {
        id: "target",
        header: "Target amount",
        align: "right",
        sortValue: (row) => {
          const n = parseMoneyDigits(row.targetAmount)
          return Number.isFinite(n) ? n : 0
        },
        cell: (row) => row.targetAmount,
      },
      {
        id: "funded",
        header: "Total funded",
        align: "right",
        sortValue: (row) => {
          const n = parseMoneyDigits(row.totalFunded)
          return Number.isFinite(n) ? n : 0
        },
        cell: (row) => row.totalFunded,
      },
      {
        id: "investors",
        header: "# investors",
        align: "right",
        sortValue: (row) => {
          const n = parseInt(String(row.investorCount).replace(/\D/g, ""), 10)
          return Number.isFinite(n) ? n : row.investorCount
        },
        cell: (row) => row.investorCount,
      },
      {
        id: "close",
        header: "Close date",
        align: "right",
        sortValue: (row) => dateSortValue(row.closeDate),
        cell: (row) => formatDealListDateDisplay(row.closeDate),
      },
      {
        id: "status",
        header: "Status",
        sortValue: (row) => row.statusLabel,
        cell: (row) => row.statusLabel,
      },
    ],
    [],
  )

  return (
    <section
      aria-labelledby={
        hideDealsHeading ? ariaLabelledBy : dealsHeadingId
      }
    >
      <div
        className={`sponsor_dash_deals_controls${hideDealsHeading ? " sponsor_dash_deals_controls_no_title" : ""}`}
      >
        {hideDealsHeading ? null : (
          <h2 id={dealsHeadingId} className="sponsor_dash_section_title">
            Deals dashboard
          </h2>
        )}
        <div className="sponsor_dash_deals_controls_right">
          <span className="sponsor_dash_view_type_label">View type:</span>
          <div
            className="sponsor_dash_view_toggle"
            role="group"
            aria-label="View layout"
          >
            <button
              type="button"
              className={`sponsor_dash_view_btn${view === "list" ? " sponsor_dash_view_btn_active" : ""}`}
              onClick={() => setView("list")}
              aria-pressed={view === "list"}
              aria-label="List view"
            >
              <LayoutList size={18} strokeWidth={2} />
            </button>
            <button
              type="button"
              className={`sponsor_dash_view_btn${view === "grid" ? " sponsor_dash_view_btn_active" : ""}`}
              onClick={() => setView("grid")}
              aria-pressed={view === "grid"}
              aria-label="Grid view"
            >
              <LayoutGrid size={18} strokeWidth={2} />
            </button>
          </div>
          {view === "grid" ? (
            <div className="sponsor_dash_sort_wrap">
              <ArrowUpDown
                size={16}
                strokeWidth={2}
                className="sponsor_dash_sort_icon"
                aria-hidden
              />
              <select
                className="sponsor_dash_sort_select"
                value={sortKey}
                onChange={(e) =>
                  setSortKey(e.target.value as DealsSortKey)
                }
                aria-label="Sort deals by"
              >
                <option value="createdAt">Created at</option>
                <option value="title">Title</option>
                <option value="target">Target amount</option>
              </select>
            </div>
          ) : null}
        </div>
      </div>

      <div className="sponsor_dash_search_row">
        <div className="sponsor_dash_search_wrap sponsor_dash_search_wrap_full">
          <input
            type="search"
            className="sponsor_dash_search_input"
            placeholder="Search deals"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search deals"
          />
          <button
            type="button"
            className="sponsor_dash_search_btn"
            aria-label="Search"
          >
            <Search size={18} strokeWidth={2} />
          </button>
        </div>
      </div>

      {view === "grid" ? (
        loading && deals.length === 0 ? (
          <p className="sponsor_dash_empty" role="status">
            Loading deals…
          </p>
        ) : gridSorted.length === 0 ? (
          <p className="sponsor_dash_empty">
            {query.trim()
              ? "No deals match your search."
              : "No deal to display."}
          </p>
        ) : (
          <div className="sponsor_dash_deals_grid">
            {gridSorted.map((deal) => (
              <Link
                key={deal.id}
                className="deal_card_link"
                to={`/deals/${encodeURIComponent(deal.id)}`}
              >
                <DealCard
                  title={deal.title}
                  location={deal.location}
                  statusLabel={deal.statusLabel}
                  metrics={dealToCardMetrics(deal)}
                  coverImageUrl={deal.coverImageUrl}
                />
              </Link>
            ))}
          </div>
        )
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          getRowKey={(row, rowIndex) => row.id || `sponsor-deal-${rowIndex}`}
          emptyLabel={
            loading && deals.length === 0
              ? "Loading deals…"
              : query.trim()
                ? "No deals match your search."
                : "No deal to display."
          }
        />
      )}
    </section>
  )
}
