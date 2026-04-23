import { ArrowUpDown, CircleDot, LayoutGrid, LayoutList, Search } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  DataTable,
  type DataTableColumn,
} from "../../../../common/components/data-table/DataTable"
import { DealCard } from "../../../../common/components/deal-card/DealCard"
import {
  dealListRowToDealRecord,
  dealRecordToCardMetrics,
  dealRecordToInvestingCardMetrics,
  dealStageLabel,
  mergeDealRecordWithInvestorsAndClasses,
  type DealRecord,
} from "../dealsDashboardUtils"
import {
  fetchDealInvestorClasses,
  fetchDealInvestors,
  fetchDealReviewSummary,
  fetchDealsList,
} from "./api/dealsApi"
import { DEALS_LIST_REFETCH_EVENT } from "./createDealFormDraftStorage"
import {
  dateSortValue,
  formatDealListDateDisplay,
} from "./dealsListDisplay"
import { filterDealListToViewerInvested } from "@/modules/Investing/utils/investingViewerDealScope"
import { parseMoneyDigits } from "./utils/offeringMoneyFormat"
import { dealStageChipCompactClassName } from "./utils/dealStageChip"
import "./deals-list.css"
import "../Dashboard/sponsor-dashboard.css"

export type DealsSortKey = "createdAt" | "title" | "target"

interface SyndicatingDealsSectionProps {
  /** `aria-labelledby` on the section when `hideDealsHeading` is true */
  ariaLabelledBy?: string
  /** Hide the in-section “Deals” h2 (e.g. when the page already has an h1) */
  hideDealsHeading?: boolean
  /** id for the visible “Deals” h2 when `hideDealsHeading` is false */
  dealsHeadingId?: string
  /**
   * When true, uses `GET /deals?includeParticipantDeals=1` — same list as the investing
   * “Deals” page (org deals plus roster-linked participant deals).
   */
  includeParticipantDeals?: boolean
  /**
   * When true (e.g. investor home), the list is limited to deals where the signed-in
   * user has a positive committed amount, matching `/investing/deals` scope.
   */
  onlyDealsWithViewerCommitment?: boolean
  /** Visible section title for the deals block (default: “Deals dashboard”). */
  dealsSectionTitle?: string
}

export function SyndicatingDealsSection({
  ariaLabelledBy,
  hideDealsHeading = false,
  dealsHeadingId = "sponsor-deals-heading",
  includeParticipantDeals = false,
  onlyDealsWithViewerCommitment = false,
  dealsSectionTitle = "Deals dashboard",
}: SyndicatingDealsSectionProps) {
  const [query, setQuery] = useState("")
  const [view, setView] = useState<"grid" | "list">("grid")
  const [sortKey, setSortKey] = useState<DealsSortKey>("createdAt")
  const [deals, setDeals] = useState<DealRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewByDealId, setReviewByDealId] = useState<
    Record<string, { reviewRating: number, reviewCount: number }>
  >({})
  const [reviewsLoading, setReviewsLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      let list = await fetchDealsList(
        includeParticipantDeals ? { includeParticipantDeals: true } : undefined,
      )
      if (onlyDealsWithViewerCommitment && list.length > 0)
        list = await filterDealListToViewerInvested(list)
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
  }, [includeParticipantDeals, onlyDealsWithViewerCommitment])

  useEffect(() => {
    function onDealsListRefetch() {
      void (async () => {
        setLoading(true)
        let list = await fetchDealsList(
          includeParticipantDeals ? { includeParticipantDeals: true } : undefined,
        )
        if (onlyDealsWithViewerCommitment && list.length > 0)
          list = await filterDealListToViewerInvested(list)
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
  }, [includeParticipantDeals, onlyDealsWithViewerCommitment])

  useEffect(() => {
    if (deals.length === 0) {
      setReviewByDealId({})
      setReviewsLoading(false)
      return
    }
    let cancelled = false
    setReviewsLoading(true)
    void (async () => {
      const out: Record<string, { reviewRating: number, reviewCount: number }> =
        {}
      const results = await Promise.all(
        deals.map((d) =>
          fetchDealReviewSummary(d.id).then(
            (s) => [d.id, s] as const,
          ),
        ),
      )
      if (cancelled) return
      for (const [id, s] of results) {
        if (s) {
          out[id] = {
            reviewRating: s.reviewRating,
            reviewCount: s.reviewCount,
          }
        }
      }
      setReviewByDealId(out)
      setReviewsLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [deals])

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
        sortValue: (row) =>
          dealStageLabel(row.dealStage ?? "").toLowerCase(),
        cell: (row) => {
          const label = (row.statusLabel ?? "").trim() || "—"
          return (
            <span
              className={dealStageChipCompactClassName(row.dealStage)}
              title={`Stage: ${label}`}
            >
              <span className="deals_list_stage_badge_icon" aria-hidden>
                <CircleDot size={12} strokeWidth={2} />
              </span>
              <span>{label}</span>
            </span>
          )
        },
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
        className="sponsor_dash_deals_controls"
      >
        {hideDealsHeading ? null : (
          <h2 id={dealsHeadingId} className="sponsor_dash_section_title">
            {dealsSectionTitle}
          </h2>
        )}
        <div className="sponsor_dash_deals_toolbar">
         
          <div className="sponsor_dash_search_row">
            <div className="sponsor_dash_search_wrap sponsor_dash_search_wrap_full">
              <Search
                className="sponsor_dash_search_icon"
                size={18}
                strokeWidth={2}
                aria-hidden
              />
              <input
                type="search"
                className="sponsor_dash_search_input"
                placeholder="Search deals"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search deals"
              />
            </div>
          </div>
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
      </div>

      {view === "grid" ? (
        loading && deals.length === 0 ? (
          <div
            className="sponsor_dash_deals_state"
            role="status"
            aria-label="Loading deals"
          >
            <div className="sponsor_dash_deals_state_inner">
              <div className="sponsor_dash_loader_spinner" aria-hidden />
              <p className="sponsor_dash_deals_state_text">Loading deals…</p>
            </div>
          </div>
        ) : gridSorted.length === 0 ? (
          <div className="sponsor_dash_deals_state" role="status">
            <div className="sponsor_dash_deals_state_inner">
              <p className="sponsor_dash_deals_state_text">
                {query.trim()
                  ? "No deals match your search."
                  : "No deal to display."}
              </p>
            </div>
          </div>
        ) : (
          <div className="sponsor_dash_deals_grid">
            {gridSorted.map((deal) => {
              const mergedReviewRating =
                reviewByDealId[deal.id]?.reviewRating ?? deal.reviewRating
              const mergedReviewCount =
                reviewByDealId[deal.id]?.reviewCount ?? deal.reviewCount
              const hasSeededReview =
                (typeof mergedReviewRating === "number" &&
                  Number.isFinite(mergedReviewRating)) ||
                (typeof mergedReviewCount === "number" && mergedReviewCount > 0)
              return (
                <Link
                  key={deal.id}
                  className="deal_card_link"
                  to={`/deals/${encodeURIComponent(deal.id)}`}
                >
                  <DealCard
                    title={deal.title}
                    reviewPlaceholderSeed={deal.id}
                    location={deal.location}
                    statusLabel={deal.statusLabel}
                    dealStage={deal.dealStage}
                    metrics={
                      includeParticipantDeals
                        ? dealRecordToInvestingCardMetrics(deal)
                        : dealRecordToCardMetrics(deal)
                    }
                    coverImageUrl={deal.coverImageUrl}
                    reviewRating={mergedReviewRating}
                    reviewCount={mergedReviewCount}
                    reviewLoading={reviewsLoading && !hasSeededReview}
                  />
                </Link>
              )
            })}
          </div>
        )
      ) : loading && deals.length === 0 ? (
        <div
          className="sponsor_dash_deals_state"
          role="status"
          aria-label="Loading deals"
        >
          <div className="sponsor_dash_deals_state_inner">
            <div className="sponsor_dash_loader_spinner" aria-hidden />
            <p className="sponsor_dash_deals_state_text">Loading deals…</p>
          </div>
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          getRowKey={(row, rowIndex) => row.id || `sponsor-deal-${rowIndex}`}
          emptyLabel={
            query.trim() ? "No deals match your search." : "No deal to display."
          }
        />
      )}
    </section>
  )
}
