import {
  ArrowUpDown,
  CircleDot,
  LayoutGrid,
  LayoutList,
  Search,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import {
  applyDealsSearchToParams,
  readDealsSearchQuery,
} from "@/common/deals/dealsSearchQuery"
import {
  DataTable,
  type DataTableColumn,
} from "../../../common/components/data-table/DataTable"
import { AvatarInitialsRing } from "../../../common/components/entity-avatar/EntityAvatarNameCell"
import { DealCard } from "../../../common/components/deal-card/DealCard"
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
import {
  getDealStatusRules,
  getInvestorDealCardPresentation,
} from "./constants/deal-lifecycle"
import { parseMoneyDigits } from "./utils/offeringMoneyFormat"
import { dealStageChipCompactClassName } from "./utils/dealStageChip"
import "./deals-list.css"
import "./deal-investors-tab.css"
import "../Dashboard/sponsor-dashboard.css"

export type DealsSortKey = "createdAt" | "title" | "target"

type DealsViewMode = "grid" | "list"

export function DealsViewSortControls({
  view,
  onViewChange,
  sortKey,
  onSortKeyChange,
  className,
}: {
  view: DealsViewMode
  onViewChange: (view: DealsViewMode) => void
  sortKey: DealsSortKey
  onSortKeyChange: (sortKey: DealsSortKey) => void
  className?: string
}) {
  return (
    <div
      className={`sponsor_dash_deals_controls_right${className ? ` ${className}` : ""}`}
    >
      <div
        className="sponsor_dash_view_toggle"
        role="group"
        aria-label="View layout"
      >
        <button
          type="button"
          className={`sponsor_dash_view_btn${view === "list" ? " sponsor_dash_view_btn_active" : ""}`}
          onClick={() => onViewChange("list")}
          aria-pressed={view === "list"}
          aria-label="List view"
        >
          <LayoutList size={18} strokeWidth={2} />
        </button>
        <button
          type="button"
          className={`sponsor_dash_view_btn${view === "grid" ? " sponsor_dash_view_btn_active" : ""}`}
          onClick={() => onViewChange("grid")}
          aria-pressed={view === "grid"}
          aria-label="Grid view"
        >
          <LayoutGrid size={18} strokeWidth={2} />
        </button>
      </div>
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
          onChange={(e) => onSortKeyChange(e.target.value as DealsSortKey)}
          aria-label="Sort deals by"
        >
          <option value="createdAt">Created at</option>
          <option value="title">Title</option>
          <option value="target">Target amount</option>
        </select>
      </div>
    </div>
  )
}

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
  /**
   * When true, hides deals whose offering status disallows dashboard visibility
   * (e.g. draft hidden, closed, past) — for investor opportunity browsing.
   */
  filterOfferingDashboardVisibility?: boolean
  /** When set, skips internal fetch and renders this list (investor dashboard tabs). */
  controlledDeals?: DealRecord[]
  controlledLoading?: boolean
  searchPlaceholder?: string
  emptyStateMessage?: string
  /** Local search state (e.g. investing dashboard) — skips URL query sync. */
  controlledQuery?: string
  onControlledQueryChange?: (value: string) => void
  /** Hide in-section search when the parent renders export/search toolbar. */
  hideToolbarSearch?: boolean
  /** Hide view/sort controls when the parent renders them in a shared toolbar. */
  hideToolbarControls?: boolean
  controlledView?: DealsViewMode
  onControlledViewChange?: (view: DealsViewMode) => void
  controlledSortKey?: DealsSortKey
  onControlledSortKeyChange?: (sortKey: DealsSortKey) => void
}

export function SyndicatingDealsSection({
  ariaLabelledBy,
  hideDealsHeading = false,
  dealsHeadingId = "sponsor-deals-heading",
  includeParticipantDeals = false,
  onlyDealsWithViewerCommitment = false,
  dealsSectionTitle = "Deals dashboard",
  filterOfferingDashboardVisibility = false,
  controlledDeals,
  controlledLoading = false,
  searchPlaceholder = "Search deals…",
  emptyStateMessage,
  controlledQuery,
  onControlledQueryChange,
  hideToolbarSearch = false,
  hideToolbarControls = false,
  controlledView,
  onControlledViewChange,
  controlledSortKey,
  onControlledSortKeyChange,
}: SyndicatingDealsSectionProps) {
  const isControlled = controlledDeals !== undefined
  const usesLocalQuery =
    controlledQuery !== undefined && onControlledQueryChange !== undefined
  const [searchParams, setSearchParams] = useSearchParams()
  const urlDealsQuery = readDealsSearchQuery(searchParams)
  const [urlSyncedQuery, setUrlSyncedQuery] = useState(urlDealsQuery)
  const query = usesLocalQuery ? controlledQuery : urlSyncedQuery

  useEffect(() => {
    if (usesLocalQuery) return
    setUrlSyncedQuery(urlDealsQuery)
  }, [urlDealsQuery, usesLocalQuery])

  function handleDealsQueryChange(value: string) {
    if (usesLocalQuery) {
      onControlledQueryChange?.(value)
      return
    }
    setUrlSyncedQuery(value)
    setSearchParams(applyDealsSearchToParams(searchParams, value), {
      replace: true,
    })
  }
  const usesControlledView =
    controlledView !== undefined && onControlledViewChange !== undefined
  const usesControlledSort =
    controlledSortKey !== undefined && onControlledSortKeyChange !== undefined
  const [internalView, setInternalView] = useState<DealsViewMode>("grid")
  const [internalSortKey, setInternalSortKey] = useState<DealsSortKey>("createdAt")
  const view = usesControlledView ? controlledView : internalView
  const setView = usesControlledView ? onControlledViewChange : setInternalView
  const sortKey = usesControlledSort ? controlledSortKey : internalSortKey
  const setSortKey = usesControlledSort
    ? onControlledSortKeyChange
    : setInternalSortKey
  const [deals, setDeals] = useState<DealRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewByDealId, setReviewByDealId] = useState<
    Record<string, { reviewRating: number, reviewCount: number }>
  >({})
  const [reviewsLoading, setReviewsLoading] = useState(false)

  useEffect(() => {
    if (isControlled) {
      setDeals(controlledDeals)
      setLoading(controlledLoading)
      return
    }
    let cancelled = false
    void (async () => {
      setLoading(true)
      let list = await fetchDealsList(
        includeParticipantDeals ? { includeParticipantDeals: true } : undefined,
      )
      if (onlyDealsWithViewerCommitment && list.length > 0)
        list = await filterDealListToViewerInvested(list)
      if (filterOfferingDashboardVisibility) {
        list = list.filter((row) => {
          const rules = getDealStatusRules(row.offeringStatus)
          if (includeParticipantDeals) {
            return rules.status !== "closed" && rules.status !== "past"
          }
          return rules.allowDashboardVisibility
        })
      }
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
  }, [
    isControlled,
    controlledDeals,
    controlledLoading,
    includeParticipantDeals,
    onlyDealsWithViewerCommitment,
    filterOfferingDashboardVisibility,
  ])

  useEffect(() => {
    if (isControlled) return
    function onDealsListRefetch() {
      void (async () => {
        setLoading(true)
        let list = await fetchDealsList(
          includeParticipantDeals ? { includeParticipantDeals: true } : undefined,
        )
        if (onlyDealsWithViewerCommitment && list.length > 0)
          list = await filterDealListToViewerInvested(list)
        if (filterOfferingDashboardVisibility) {
          list = list.filter((row) => {
            const rules = getDealStatusRules(row.offeringStatus)
            if (includeParticipantDeals) {
              return rules.status !== "closed" && rules.status !== "past"
            }
            return rules.allowDashboardVisibility
          })
        }
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
  }, [
    isControlled,
    includeParticipantDeals,
    onlyDealsWithViewerCommitment,
    filterOfferingDashboardVisibility,
  ])

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

  const sortedDeals = useMemo(() => {
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
          <div className="deals_list_name_cell deals_list_name_cell--sponsor_dash">
            <AvatarInitialsRing name={row.title?.trim() || "Deal"} />
            <div className="deals_list_name_text">
              <Link
                className="sponsor_dash_table_link"
                to={`/deals/${encodeURIComponent(row.id)}`}
              >
                {row.title || "—"}
              </Link>
            </div>
          </div>
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
          const presentation = filterOfferingDashboardVisibility
            ? getInvestorDealCardPresentation(
                row.offeringStatus,
                row.dealStage,
                (row.statusLabel ?? "").trim() || "—",
              )
            : null
          const label =
            presentation?.statusLabel ??
            ((row.statusLabel ?? "").trim() || "—")
          const badgeClass =
            presentation?.statusBadgeClassName ??
            dealStageChipCompactClassName(row.dealStage)
          return (
            <span
              className={badgeClass}
              title={
                presentation?.previewNotice?.tooltip ??
                `Stage: ${label}`
              }
            >
              {!presentation?.hideStatusIcon ? (
                <span className="deals_list_stage_badge_icon" aria-hidden>
                  <CircleDot size={12} strokeWidth={2} />
                </span>
              ) : null}
              <span>{label}</span>
            </span>
          )
        },
      },
    ],
    [filterOfferingDashboardVisibility],
  )

  return (
    <section
      className="sponsor_dash_deals_section"
      aria-labelledby={
        hideDealsHeading ? ariaLabelledBy : dealsHeadingId
      }
    >
      {!hideToolbarSearch || !hideToolbarControls || !hideDealsHeading ? (
        <div className="sponsor_dash_deals_controls">
          <div className="sponsor_dash_deals_header_row">
            {hideDealsHeading ? null : (
              <h2 id={dealsHeadingId} className="sponsor_dash_section_title">
                {dealsSectionTitle}
              </h2>
            )}
            {!hideToolbarSearch || !hideToolbarControls ? (
              <div className="sponsor_dash_deals_tools sponsor_dash_deals_toolbar">
                {!hideToolbarSearch ? (
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
                        placeholder={searchPlaceholder}
                        value={query}
                        onChange={(e) => handleDealsQueryChange(e.target.value)}
                        aria-label="Search deals"
                      />
                    </div>
                  </div>
                ) : null}
                {!hideToolbarControls ? (
                  <DealsViewSortControls
                    view={view}
                    onViewChange={setView}
                    sortKey={sortKey}
                    onSortKeyChange={setSortKey}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

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
        ) : sortedDeals.length === 0 ? (
          <div className="sponsor_dash_deals_state" role="status">
            <div className="sponsor_dash_deals_state_inner">
              <p className="sponsor_dash_deals_state_text">
                {query.trim()
                  ? "No deals match your search."
                  : (emptyStateMessage ?? "No deal to display.")}
              </p>
            </div>
          </div>
        ) : (
          <div className="sponsor_dash_deals_grid">
            {sortedDeals.map((deal) => {
              const mergedReviewRating =
                reviewByDealId[deal.id]?.reviewRating ?? deal.reviewRating
              const mergedReviewCount =
                reviewByDealId[deal.id]?.reviewCount ?? deal.reviewCount
              const hasSeededReview =
                (typeof mergedReviewRating === "number" &&
                  Number.isFinite(mergedReviewRating)) ||
                (typeof mergedReviewCount === "number" && mergedReviewCount > 0)
              const cardPresentation = filterOfferingDashboardVisibility
                ? getInvestorDealCardPresentation(
                    deal.offeringStatus,
                    deal.dealStage,
                    deal.statusLabel,
                  )
                : null
              return (
                <Link
                  key={deal.id}
                  className="deal_card_link"
                  to={`/deals/${encodeURIComponent(deal.id)}`}
                  state={
                    includeParticipantDeals
                      ? { returnTo: "/dashboard" }
                      : undefined
                  }
                >
                  <DealCard
                    prestigeLayout
                    dealId={deal.id}
                    investNowReturnTo={
                      includeParticipantDeals ? "/dashboard" : undefined
                    }
                    title={deal.title}
                    reviewPlaceholderSeed={deal.id}
                    location={deal.location}
                    statusLabel={
                      cardPresentation?.statusLabel ?? deal.statusLabel
                    }
                    dealStage={deal.dealStage}
                    statusBadgeClassName={cardPresentation?.statusBadgeClassName}
                    hideStatusIcon={cardPresentation?.hideStatusIcon}
                    previewNotice={cardPresentation?.previewNotice}
                    metrics={
                      includeParticipantDeals
                        ? dealRecordToInvestingCardMetrics(deal)
                        : dealRecordToCardMetrics(deal)
                    }
                    coverImageUrl={deal.coverImageUrl}
                    reviewRating={mergedReviewRating}
                    reviewCount={mergedReviewCount}
                    reviewLoading={reviewsLoading && !hasSeededReview}
                    investNowDraftProgress={deal.investNowDraftProgress}
                    investNowResumeScope={deal.investNowResumeScope}
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
        <div className="um_panel um_members_tab_panel deal_inv_table_panel sponsor_dash_deals_list_table_wrap">
          <DataTable
            visualVariant="members"
            columns={columns}
            rows={sortedDeals}
            getRowKey={(row, rowIndex) => row.id || `sponsor-deal-${rowIndex}`}
            emptyLabel={
              query.trim()
                ? "No deals match your search."
                : (emptyStateMessage ?? "No deal to display.")
            }
          />
        </div>
      )}
    </section>
  )
}
