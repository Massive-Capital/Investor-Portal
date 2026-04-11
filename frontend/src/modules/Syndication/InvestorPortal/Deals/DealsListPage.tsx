import {
  Archive,
  Ban,
  Briefcase,
  CircleDot,
  Download,
  FilePenLine,
  Plus,
  Search,
  X,
} from "lucide-react"
import { useEffect, useId, useMemo, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import {
  DataTable,
  type DataTableColumn,
} from "../../../../common/components/data-table/DataTable"
import { TabsScrollStrip } from "../../../../common/components/tabs-scroll-strip/TabsScrollStrip"
import { toast } from "../../../../common/components/Toast"
import {
  deleteDeal,
  fetchDealInvestorClasses,
  fetchDealInvestors,
  fetchDealsList,
  isDealListRowIncomplete,
} from "./api/dealsApi"
import {
  clearCreateDealDraft,
  CREATE_DEAL_DRAFT_UPDATED_EVENT,
  DEALS_LIST_REFETCH_EVENT,
  notifyDealsListRefetch,
} from "./createDealFormDraftStorage"
import {
  CREATE_DEAL_DRAFT_ROW_ID,
  buildCreateDealDraftListRow,
} from "./createDealDraftListRow"
import {
  DEAL_STAGE_CHOICES,
  type DealListRow,
} from "./types/deals.types"
import { DealPreviewModal } from "./components/DealPreviewModal"
import { DealRowActions } from "./components/DealRowActions"
import { ExportDealsModal } from "./components/ExportDealsModal"
import {
  FormTooltip,
  type FormTooltipPanelAlign,
} from "../../../../common/components/form-tooltip/FormTooltip"
import {
  committedSortValue,
  dateSortValue,
  formatCommittedCurrency,
  formatDealListDateDisplay,
} from "./dealsListDisplay"
import { dealStageChipCompactClassName } from "./utils/dealStageChip"
import "../../../usermanagement/user_management.css"
import "./deal-members/add-investment/add_deal_modal.css"
import "./deal-investors-tab.css"
import "./deals-list.css"

type DealsListTab = "deals" | "archives"

function DealTableColumnHeader({
  label,
  hint,
  headerAlign = "left",
  tooltipPlacement = "bottom",
  tooltipPanelAlign,
  hintOpenOnHover = true,
}: {
  label: string
  hint: string
  headerAlign?: "left" | "center" | "right"
  tooltipPlacement?: "top" | "bottom"
  /** When set, overrides alignment derived from headerAlign (helps narrow columns). */
  tooltipPanelAlign?: FormTooltipPanelAlign
  /** When false, the (i) hint opens on click only, not on hover. */
  hintOpenOnHover?: boolean
}) {
  const headerAlignClass =
    headerAlign === "right"
      ? " deals_table_col_header_end"
      : headerAlign === "center"
        ? " deals_table_col_header_center"
        : ""
  const panelAlign: FormTooltipPanelAlign =
    tooltipPanelAlign ??
    (headerAlign === "right"
      ? "end"
      : headerAlign === "center"
        ? "center"
        : "start")
  return (
    <span className={`deals_table_col_header${headerAlignClass}`}>
      <span>{label}</span>
      <span
        className="deals_table_header_tooltip_anchor"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <FormTooltip
          label={`More information: ${label}`}
          content={<p className="deals_table_header_tooltip_p">{hint}</p>}
          placement={tooltipPlacement}
          panelAlign={panelAlign}
          openOnHover={hintOpenOnHover}
          nativeButtonTrigger={false}
        />
      </span>
    </span>
  )
}

function dealStageDisplayLabel(raw: string): string {
  const source = String(raw ?? "").trim()
  const key =
    source === "raising_capital"
      ? "capital_raising"
      : source === "asset_managing"
        ? "managing_asset"
        : source.toLowerCase() === "draft"
          ? "Draft"
          : source
  if (!key) return "—"
  const found = DEAL_STAGE_CHOICES.find((c) => c.value === key)
  return found?.label ?? key
}

function DealListNameCell({ row }: { row: DealListRow }) {
  const stageLabel = dealStageDisplayLabel(String(row.dealStage ?? ""))
  const isSessionDraft = row.id === CREATE_DEAL_DRAFT_ROW_ID
  const isIncomplete = isDealListRowIncomplete(row)
  const showDraftMarker = isSessionDraft || isIncomplete

  const nameLink = isSessionDraft ? (
    <Link className="deals_table_name_link" to="/deals/create?resume=1">
      {row.dealName || "—"}
    </Link>
  ) : (
    <Link className="deals_table_name_link" to={`/deals/${row.id}`}>
      {row.dealName || "—"}
    </Link>
  )

  return (
    <div className="deals_list_name_cell">
      <div className="deals_list_name_primary">{nameLink}</div>
      <div className="deals_list_name_subrow">
        <span
          className={dealStageChipCompactClassName(row.dealStage)}
          title={`Stage: ${stageLabel}`}
        >
          <span className="deals_list_stage_badge_icon" aria-hidden>
            <CircleDot size={12} strokeWidth={2} />
          </span>
          <span>{stageLabel}</span>
        </span>
        {showDraftMarker ? (
          <span
            className="deals_list_draft_icon deals_list_draft_icon--draft"
            title={`Incomplete · ${stageLabel}`}
          >
            <FilePenLine size={14} strokeWidth={2} aria-hidden />
            <span className="deals_list_sr_only">Draft</span>
          </span>
        ) : null}
      </div>
    </div>
  )
}

function DealsSuspendAllConfirmModal({
  open,
  dealCount,
  onCancel,
  onConfirm,
}: {
  open: boolean
  dealCount: number
  onCancel: () => void
  onConfirm: () => void
}) {
  const titleId = useId()
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onCancel])

  if (!open) return null

  const n = dealCount
  return (
    <div
      className="um_modal_overlay deals_add_inv_modal_overlay portal_modal_z_boost"
      role="presentation"
    >
      <div
        className="um_modal um_modal_view deals_add_inv_modal_panel deals_suspend_all_modal_panel"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="um_modal_head">
          <h3 id={titleId} className="um_modal_title">
            Suspend all deals?
          </h3>
          <button
            type="button"
            className="um_modal_close"
            onClick={onCancel}
            aria-label="Close"
          >
            <X size={20} strokeWidth={2} aria-hidden />
          </button>
        </div>
        <div className="deals_suspend_all_modal_body">
          <p className="deals_suspend_all_modal_message">
            Move {n} deal{n === 1 ? "" : "s"} to Archives? You can restore them
            from the Archives tab.
          </p>
        </div>
        <div className="um_modal_actions">
          <button
            type="button"
            className="um_btn_secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="um_btn_primary"
            onClick={onConfirm}
          >
            Move to Archives
          </button>
        </div>
      </div>
    </div>
  )
}

export function DealsListPage() {
  const location = useLocation()
  const hideCreateDraftRow = location.pathname === "/deals/create"
  const [query, setQuery] = useState("")
  const [activeTab, setActiveTab] = useState<DealsListTab>("deals")
  const [dealsPage, setDealsPage] = useState(1)
  const [dealsPageSize, setDealsPageSize] = useState(10)
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [previewDealId, setPreviewDealId] = useState<string | null>(null)
  const [suspendAllOpen, setSuspendAllOpen] = useState(false)
  const [suspendAllIds, setSuspendAllIds] = useState<string[]>([])
  const [rows, setRows] = useState<DealListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [createDealDraftTick, setCreateDealDraftTick] = useState(0)
  /**
   * Same sources as deal detail: investors KPI + rows, and investor-classes
   * (Offering Information) for the Investor Class column.
   */
  const [investorMetricsByDealId, setInvestorMetricsByDealId] = useState<
    Record<
      string,
      {
        committedRaw: string
        fundedRaw: string
        remainingRaw: string
        investorCount: number
        investorClassesLine: string
      }
    >
  >({})

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      const list = await fetchDealsList()
      if (!cancelled) {
        setRows(list)
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    function onDraftUpdated() {
      setCreateDealDraftTick((t) => t + 1)
    }
    window.addEventListener(CREATE_DEAL_DRAFT_UPDATED_EVENT, onDraftUpdated)
    return () =>
      window.removeEventListener(
        CREATE_DEAL_DRAFT_UPDATED_EVENT,
        onDraftUpdated,
      )
  }, [])

  useEffect(() => {
    function onDealsRefetch() {
      void (async () => {
        const list = await fetchDealsList()
        setRows(list)
      })()
    }
    window.addEventListener(DEALS_LIST_REFETCH_EVENT, onDealsRefetch)
    return () =>
      window.removeEventListener(DEALS_LIST_REFETCH_EVENT, onDealsRefetch)
  }, [])

  const sessionCreateDealDraftRow = useMemo((): DealListRow | null => {
    void createDealDraftTick
    return buildCreateDealDraftListRow()
  }, [createDealDraftTick])

  const { activeDealsCount, archivedDealsCount } = useMemo(() => {
    let active = 0
    let archived = 0
    for (const r of rows) {
      if (r.archived) archived++
      else active++
    }
    return { activeDealsCount: active, archivedDealsCount: archived }
  }, [rows])

  const rowsForTab = useMemo(() => {
    return rows.filter((r) =>
      activeTab === "archives" ? Boolean(r.archived) : !r.archived,
    )
  }, [rows, activeTab])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return [...rowsForTab]
    return rowsForTab.filter((r) =>
      (r.dealName ?? "").toLowerCase().includes(q),
    )
  }, [query, rowsForTab])

  useEffect(() => {
    setDealsPage(1)
  }, [activeTab, query])

  useEffect(() => {
    const ids = filtered.map((r) => r.id)
    if (ids.length === 0) {
      setInvestorMetricsByDealId({})
      return
    }
    let cancelled = false
    void (async () => {
      const entries = await Promise.all(
        ids.map(async (id) => {
          try {
            const [{ kpis, investors }, classes] = await Promise.all([
              fetchDealInvestors(id),
              fetchDealInvestorClasses(id),
            ])
            const investorClassesLine = classes
              .map((c) => String(c.name ?? "").trim())
              .filter(Boolean)
              .join(", ")
            return [
              id,
              {
                committedRaw: kpis.committed,
                fundedRaw: kpis.totalFunded,
                remainingRaw: kpis.remaining,
                investorCount: investors.length,
                investorClassesLine,
              },
            ] as const
          } catch {
            return [
              id,
              {
                committedRaw: "—",
                fundedRaw: "—",
                remainingRaw: "—",
                investorCount: 0,
                investorClassesLine: "",
              },
            ] as const
          }
        }),
      )
      if (!cancelled)
        setInvestorMetricsByDealId(Object.fromEntries(entries))
    })()
    return () => {
      cancelled = true
    }
  }, [filtered])

  useEffect(() => {
    const id =
      activeTab === "deals" ? "deals-tab-deals" : "deals-tab-archives"
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({
      behavior: "smooth",
      inline: "nearest",
      block: "nearest",
    })
  }, [activeTab])

  const displayRows = useMemo(() => {
    if (loading && rows.length === 0) return []
    const base = filtered
    if (activeTab !== "deals" || hideCreateDraftRow || !sessionCreateDealDraftRow)
      return base
    const q = query.trim().toLowerCase()
    if (
      q &&
      !(sessionCreateDealDraftRow.dealName ?? "").toLowerCase().includes(q)
    )
      return base
    return [...base, sessionCreateDealDraftRow]
  }, [
    loading,
    rows.length,
    filtered,
    activeTab,
    hideCreateDraftRow,
    sessionCreateDealDraftRow,
    query,
  ])

  useEffect(() => {
    const totalPages = Math.max(
      1,
      Math.ceil(displayRows.length / dealsPageSize),
    )
    if (dealsPage > totalPages) setDealsPage(totalPages)
  }, [displayRows.length, dealsPageSize, dealsPage])

  const dealsPagination = useMemo(
    () => ({
      page: dealsPage,
      pageSize: dealsPageSize,
      totalItems: displayRows.length,
      onPageChange: setDealsPage,
      onPageSizeChange: setDealsPageSize,
      ariaLabel: "Deals table pagination",
    }),
    [dealsPage, dealsPageSize, displayRows.length],
  )

  function handleSuspendAllClick() {
    if (activeTab !== "deals") return
    const ids = filtered.map((r) => r.id)
    if (ids.length === 0) return
    setSuspendAllIds(ids)
    setSuspendAllOpen(true)
  }

  function handleSuspendAllCancel() {
    setSuspendAllOpen(false)
    setSuspendAllIds([])
  }

  function handleSuspendAllConfirm() {
    setRows((prev) =>
      prev.map((r) =>
        suspendAllIds.includes(r.id) ? { ...r, archived: true } : r,
      ),
    )
    handleSuspendAllCancel()
  }

  const columns: DataTableColumn<DealListRow>[] = useMemo(() => {
    const dataCols: DataTableColumn<DealListRow>[] = [
      {
        id: "name",
        header: (
          <DealTableColumnHeader
            label="Deal Name"
            hint="Legal or marketing name of the offering."
          />
        ),
        tdClassName: "um_td_user",
        sortValue: (row) => (row.dealName ?? "").toLowerCase(),
        cell: (row) => <DealListNameCell row={row} />,
      },
      {
        id: "start",
        header: (
          <DealTableColumnHeader
            label="Start Date"
            hint="Date the deal opened or went live."
            headerAlign="center"
          />
        ),
        align: "center",
        thClassName: "deals_th_align_center",
        sortValue: (row) =>
          dateSortValue(row.startDateDisplay ?? row.createdDateDisplay),
        cell: (row) =>
          formatDealListDateDisplay(
            row.startDateDisplay ?? row.createdDateDisplay,
          ),
      },
      {
        id: "close",
        header: (
          <DealTableColumnHeader
            label="Close Date"
            hint="Target or actual close date for the deal."
            headerAlign="center"
          />
        ),
        align: "center",
        thClassName: "deals_th_align_center",
        sortValue: (row) => dateSortValue(row.closeDateDisplay),
        cell: (row) => formatDealListDateDisplay(row.closeDateDisplay),
      },
      // {
      //   id: "dealStage",
      //   header: (
      //     <DealTableColumnHeader
      //       label="Deal Stage"
      //       hint="Current lifecycle stage for this deal."
      //       headerAlign="center"
      //     />
      //   ),
      //   align: "center",
      //   thClassName: "deals_th_align_center",
      //   sortValue: (row) => dealStageDisplayLabel(row.dealStage).toLowerCase(),
      //   cell: (row) => (
      //     <span className={dealStageChipClassName(row.dealStage)}>
      //       {dealStageDisplayLabel(row.dealStage)}
      //     </span>
      //   ),
      // },
      {
        id: "targetRaised",
        header: (
          <DealTableColumnHeader
            label="Target Raised"
            hint="Total raise target configured for this deal."
            headerAlign="right"
          />
        ),
        align: "right",
        thClassName: "deals_th_align_right",
        tdClassName: "um_td_numeric",
        sortValue: (row) => committedSortValue(row.raiseTarget),
        cell: (row) => formatCommittedCurrency(row.raiseTarget),
      },
      {
        id: "softCommitted",
        header: (
          <DealTableColumnHeader
            label="Soft Committed"
            hint="In-progress committed amount for the deal."
            headerAlign="right"
          />
        ),
        align: "right",
        thClassName: "deals_th_align_right",
        tdClassName: "um_td_numeric",
        sortValue: (row) => committedSortValue(row.totalInProgress),
        cell: (row) => formatCommittedCurrency(row.totalInProgress),
      },
      {
        id: "funded",
        header: (
          <DealTableColumnHeader
            label="Funded"
            hint="Funded amount from the Investors KPI for this deal."
            headerAlign="right"
          />
        ),
        align: "right",
        thClassName: "deals_th_align_right",
        tdClassName: "um_td_numeric",
        sortValue: (row) => {
          const m = investorMetricsByDealId[row.id]
          return committedSortValue(m?.fundedRaw ?? row.totalAccepted)
        },
        cell: (row) => {
          const m = investorMetricsByDealId[row.id]
          return formatCommittedCurrency(m?.fundedRaw ?? row.totalAccepted)
        },
      },
      {
        id: "gap",
        header: (
          <DealTableColumnHeader
            label="Gap"
            hint="Remaining amount to reach target raise."
            headerAlign="right"
          />
        ),
        align: "right",
        thClassName: "deals_th_align_right",
        tdClassName: "um_td_numeric",
        sortValue: (row) => {
          const m = investorMetricsByDealId[row.id]
          return committedSortValue(m?.remainingRaw ?? "0")
        },
        cell: (row) => {
          const m = investorMetricsByDealId[row.id]
          return formatCommittedCurrency(m?.remainingRaw ?? "0")
        },
      },
      {
        id: "committed",
        header: (
          <DealTableColumnHeader
            label="Committed"
            hint="Committed amount from the deal Investors tab (same KPI as when you open the deal)."
            headerAlign="right"
          />
        ),
        align: "right",
        thClassName: "deals_th_align_right",
        tdClassName: "um_td_numeric",
        sortValue: (row) => {
          const m = investorMetricsByDealId[row.id]
          return committedSortValue(m?.committedRaw ?? row.totalAccepted)
        },
        cell: (row) => {
          const m = investorMetricsByDealId[row.id]
          const raw = m?.committedRaw ?? row.totalAccepted
          return formatCommittedCurrency(raw)
        },
      },
      // {
      //   id: "investment",
      //   header: (
      //     <DealTableColumnHeader
      //       label="Investment"
      //       hint="Number of rows in the deal Investors table (same list as when you open the deal)."
      //       headerAlign="center"
      //     />
      //   ),
      //   align: "center",
      //   thClassName: "deals_th_align_center",
      //   sortValue: (row) => {
      //     const m = investorMetricsByDealId[row.id]
      //     if (m != null) return m.investorCount
      //     return parseInvestorCountFromCell(row.investors)
      //   },
      //   cell: (row) => {
      //     const m = investorMetricsByDealId[row.id]
      //     if (m != null) return String(m.investorCount)
      //     return "—"
      //   },
      // },
      // {
      //   id: "investorClass",
      //   header: (
      //     <DealTableColumnHeader
      //       label="Investor Class"
      //       hint="Classes configured for this deal (same as the Classes section / investor classes inside the deal)."
      //       headerAlign="center"
      //       tooltipPlacement="top"
      //       tooltipPanelAlign="end"
      //       hintOpenOnHover={false}
      //     />
      //   ),
      //   align: "center",
      //   thClassName: "deals_th_align_center",
      //   sortValue: (row) => {
      //     const m = investorMetricsByDealId[row.id]
      //     const fromDeal = m?.investorClassesLine?.trim() ?? ""
      //     if (fromDeal) return fromDeal.toLowerCase()
      //     return (row.investorClass ?? "").toLowerCase()
      //   },
      //   tdClassName: "deals_td_investor_class_cell",
      //   cell: (row) => {
      //     const m = investorMetricsByDealId[row.id]
      //     const fromDeal = m?.investorClassesLine?.trim() ?? ""
      //     const raw = row.investorClass ?? "—"
      //     const fromList =
      //       raw === "—"
      //         ? ""
      //         : raw
      //             .split(/[;,]/)
      //             .map((s) => s.trim())
      //             .filter(Boolean)
      //             .join(", ")
      //     const display = fromDeal || fromList || "—"
      //     return (
      //       <div className="deals_td_investor_class_pills_wrap">
      //         <InvestorClassPillsDisplay
      //           pillSource={display}
      //           titleForTooltip={`Investor classes: ${display}`}
      //         />
      //       </div>
      //     )
      //   },
      // },
      {
        id: "actions",
        header: "Actions",
        align: "center",
        thClassName: "um_th_actions deals_th_actions_head",
        tdClassName: "um_td_actions deal_inv_td_actions",
        cell: (row) => (
          <div className="deal_members_actions_cell">
            <DealRowActions
              draftRow={row.id === CREATE_DEAL_DRAFT_ROW_ID}
              dealId={row.id}
              dealName={row.dealName}
              dealStage={row.dealStage}
              archived={Boolean(row.archived)}
              onPreviewDeal={
                row.id === CREATE_DEAL_DRAFT_ROW_ID
                  ? undefined
                  : () => setPreviewDealId(row.id)
              }
              onArchived={() =>
                setRows((prev) =>
                  prev.map((r) =>
                    r.id === row.id ? { ...r, archived: true } : r,
                  ),
                )
              }
              onRestored={() =>
                setRows((prev) =>
                  prev.map((r) =>
                    r.id === row.id ? { ...r, archived: false } : r,
                  ),
                )
              }
              onDeleted={async () => {
                if (row.id === CREATE_DEAL_DRAFT_ROW_ID) {
                  clearCreateDealDraft()
                  return
                }
                const result = await deleteDeal(row.id)
                if (!result.ok) {
                  toast.error("Could not delete deal", result.message)
                  return
                }
                setRows((prev) => prev.filter((r) => r.id !== row.id))
                notifyDealsListRefetch()
                toast.success("Deal deleted")
              }}
            />
          </div>
        ),
      },
    ]

    return dataCols
  }, [investorMetricsByDealId])

  function handleOpenExportModal() {
    setExportModalOpen(true)
  }

  const emptyMessage =
    activeTab === "archives" ? "No archived deals." : "No deal to display."

  return (
    <section className="um_page deals_list_page">
      <div className="um_members_header_block">
        <div className="um_header_row">
          <h2 className="um_title um_title_with_icon">
            <Briefcase
              className="um_title_icon"
              size={26}
              strokeWidth={1.75}
              aria-hidden
            />
            My deals
          </h2>
          <Link className="um_btn_primary deals_list_add_link" to="/deals/create">
            <Plus size={18} aria-hidden />
            Add deal
          </Link>
        </div>
      </div>

      <div className="um_members_tabs_outer deals_tabs_outer">
        <TabsScrollStrip scrollClassName="deals_tabs_scroll">
          <div
            className="um_members_tabs_row deals_tabs_row"
            role="tablist"
            aria-label="Deals views"
          >
            <button
              type="button"
              id="deals-tab-deals"
              role="tab"
              aria-selected={activeTab === "deals"}
              aria-controls="deals-list-tabpanel"
              className={`um_members_tab deals_tabs_tab${activeTab === "deals" ? " um_members_tab_active" : ""}`}
              onClick={() => setActiveTab("deals")}
            >
              <Briefcase
                className="deals_tabs_icon"
                size={18}
                strokeWidth={1.75}
                aria-hidden
              />
              <span className="deals_tabs_label">Deals</span>
              <span className="deals_tabs_count">({activeDealsCount})</span>
            </button>
            <button
              type="button"
              id="deals-tab-archives"
              role="tab"
              aria-selected={activeTab === "archives"}
              aria-controls="deals-list-tabpanel"
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
              <span className="deals_tabs_count">({archivedDealsCount})</span>
            </button>
          </div>
        </TabsScrollStrip>
      </div>

      <div className="um_members_tab_content">
        <div
          id="deals-list-tabpanel"
          role="tabpanel"
          aria-labelledby={
            activeTab === "deals" ? "deals-tab-deals" : "deals-tab-archives"
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
                placeholder="Search deals…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search deals"
              />
            </div>
            <div className="um_toolbar_actions deal_inv_table_toolbar_actions deals_list_toolbar_actions">
              {activeTab === "deals" ? (
                <button
                  type="button"
                  className="deals_suspend_all_btn"
                  onClick={handleSuspendAllClick}
                >
                  <Ban size={18} strokeWidth={2} aria-hidden />
                  <span>Suspend All</span>
                </button>
              ) : null}
              <button
                type="button"
                className="um_toolbar_export_btn"
                onClick={handleOpenExportModal}
              >
                <Download size={18} strokeWidth={2} aria-hidden />
                <span>Export all deals</span>
              </button>
            </div>
          </div>
          <DataTable
            visualVariant="members"
            membersTableClassName="um_table_members deal_inv_table"
            columns={columns}
            rows={displayRows}
            getRowKey={(row, rowIndex) => row.id || `deal-row-${rowIndex}`}
            getRowClassName={(row) =>
              row.id === CREATE_DEAL_DRAFT_ROW_ID ||
              isDealListRowIncomplete(row)
                ? "deals_list_row_draft"
                : undefined
            }
            emptyLabel={
              loading && rows.length === 0
                ? "Loading deals…"
                : query.trim()
                  ? "No deals match your search."
                  : emptyMessage
            }
            pagination={
              displayRows.length > 0 ? dealsPagination : undefined
            }
          />
        </div>
      </div>

      <ExportDealsModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        deals={rows}
      />

      <DealPreviewModal
        dealId={previewDealId}
        onClose={() => setPreviewDealId(null)}
      />

      <DealsSuspendAllConfirmModal
        open={suspendAllOpen}
        dealCount={suspendAllIds.length}
        onCancel={handleSuspendAllCancel}
        onConfirm={handleSuspendAllConfirm}
      />
    </section>
  )
}
