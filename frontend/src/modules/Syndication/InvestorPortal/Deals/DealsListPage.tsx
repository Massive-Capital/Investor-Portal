import {
  ChevronRight,
  Download,
  HelpCircle,
  Home,
  Plus,
  Search,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  DataTable,
  type DataTableColumn,
} from "../../../../common/components/data-table/DataTable"
import { dealStageLabel } from "../deals-mock-data"
import { fetchDealsList } from "./api/dealsApi"
import {
  DEAL_FORM_TYPE_OPTIONS,
  DEAL_TYPE_LABELS,
  type DealListRow,
  type DealTypeOption,
} from "./types/deals.types"
import { DealRowActions } from "./components/DealRowActions"
import { ExportDealsModal } from "./components/ExportDealsModal"
import "../../../usermanagement/user_management.css"
import "./deals-list.css"

function dealTypeLabel(code: string): string {
  if (code === "—" || !code) return "—"
  const fromForm = DEAL_FORM_TYPE_OPTIONS.find((o) => o.value === code)
  if (fromForm) return fromForm.label
  const k = code as DealTypeOption
  return DEAL_TYPE_LABELS[k] ?? code
}

function HeaderWithHint({
  line1,
  line2,
  hint,
}: {
  line1: string
  line2: string
  hint: string
}) {
  return (
    <span className="deals_table_th_header_hint">
      <span className="deals_table_th_lines">
        <span className="deals_table_th_line">{line1}</span>
        <span className="deals_table_th_line">{line2}</span>
      </span>
      <HelpCircle
        className="deals_table_th_hint"
        size={14}
        strokeWidth={2}
        aria-label={hint}
        title={hint}
      />
    </span>
  )
}

export function DealsListPage() {
  const [query, setQuery] = useState("")
  const [dealsPage, setDealsPage] = useState(1)
  const [dealsPageSize, setDealsPageSize] = useState(10)
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [rows, setRows] = useState<DealListRow[]>([])
  const [loading, setLoading] = useState(true)

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return [...rows]
    return rows.filter((r) =>
      (r.dealName ?? "").toLowerCase().includes(q),
    )
  }, [query, rows])

  useEffect(() => {
    setDealsPage(1)
  }, [query])

  useEffect(() => {
    const totalPages = Math.max(
      1,
      Math.ceil(filtered.length / dealsPageSize),
    )
    if (dealsPage > totalPages) setDealsPage(totalPages)
  }, [filtered.length, dealsPageSize, dealsPage])

  const tableRows =
    loading && rows.length === 0 ? [] : filtered

  const dealsPagination = useMemo(
    () => ({
      page: dealsPage,
      pageSize: dealsPageSize,
      totalItems: filtered.length,
      onPageChange: setDealsPage,
      onPageSizeChange: setDealsPageSize,
      ariaLabel: "Deals table pagination",
    }),
    [dealsPage, dealsPageSize, filtered.length],
  )

  const columns: DataTableColumn<DealListRow>[] = useMemo(
    () => [
      {
        id: "name",
        header: "Deal name",
        tdClassName: "um_td_user",
        sortValue: (row) => (row.dealName ?? "").toLowerCase(),
        cell: (row) => (
          <Link
            className="deals_table_name_link"
            to={`/deals/${row.id}`}
          >
            {row.dealName || "—"}
          </Link>
        ),
      },
      {
        id: "type",
        header: "Deal type",
        sortValue: (row) => dealTypeLabel(row.dealType),
        cell: (row) => dealTypeLabel(row.dealType),
      },
      {
        id: "stage",
        header: "Deal stage",
        sortValue: (row) => dealStageLabel(row.dealStage),
        cell: (row) => dealStageLabel(row.dealStage),
      },
      {
        id: "created",
        header: "Created date",
        sortValue: (row) => row.createdAt ?? row.createdDateDisplay,
        cell: (row) => row.createdDateDisplay,
      },
      {
        id: "inProgress",
        header: (
          <HeaderWithHint
            line1="Total in"
            line2="progress"
            hint="Capital currently being raised or documented for this deal."
          />
        ),
        align: "right",
        sortValue: (row) => row.totalInProgress,
        cell: (row) => row.totalInProgress,
      },
      {
        id: "accepted",
        header: (
          <HeaderWithHint
            line1="Total"
            line2="accepted"
            hint="Commitments accepted toward the raise."
          />
        ),
        align: "right",
        sortValue: (row) => row.totalAccepted,
        cell: (row) => row.totalAccepted,
      },
      {
        id: "raise",
        header: "Raise target",
        align: "right",
        sortValue: (row) => row.raiseTarget,
        cell: (row) => row.raiseTarget,
      },
      {
        id: "dist",
        header: "Distributions",
        align: "right",
        sortValue: (row) => row.distributions,
        cell: (row) => row.distributions,
      },
      {
        id: "inv",
        header: "Investors",
        align: "right",
        sortValue: (row) => {
          const n = parseInt(String(row.investors).replace(/\D/g, ""), 10)
          return Number.isFinite(n) ? n : row.investors
        },
        cell: (row) => row.investors,
      },
      {
        id: "close",
        header: "Close date",
        align: "right",
        sortValue: (row) => row.closeDateDisplay,
        cell: (row) => row.closeDateDisplay,
      },
      {
        id: "actions",
        header: "Actions",
        align: "right",
        thClassName: "um_th_actions",
        tdClassName: "um_td_actions",
        cell: (row) => (
          <DealRowActions
            dealId={row.id}
            dealName={row.dealName}
            onArchived={() =>
              setRows((prev) => prev.filter((r) => r.id !== row.id))
            }
            onDeleted={() =>
              setRows((prev) => prev.filter((r) => r.id !== row.id))
            }
          />
        ),
      },
    ],
    [],
  )

  function handleOpenExportModal() {
    setExportModalOpen(true)
  }

  return (
    <div className="deals_list_page">
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
        <span aria-current="page">Deals</span>
      </nav>

      <header className="deals_list_head">
        <h1 className="deals_list_title">My deals</h1>
        <Link className="deals_list_add_btn" to="/deals/create">
          <Plus size={18} strokeWidth={2} aria-hidden />
          <span>Add deal</span>
        </Link>
      </header>

      <div
        className={`um_panel deals_list_table_panel${loading ? " deals_list_table_panel_loading" : ""}`}
        aria-busy={loading}
      >
        <div className="um_toolbar">
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
          <div className="um_toolbar_actions">
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
          membersTableClassName="um_table_members"
          columns={columns}
          rows={tableRows}
          getRowKey={(row, rowIndex) => row.id || `deal-row-${rowIndex}`}
          emptyLabel={
            loading && rows.length === 0
              ? "Loading deals…"
              : query.trim()
                ? "No deals match your search."
                : "No deal to display."
          }
          pagination={
            tableRows.length > 0 ? dealsPagination : undefined
          }
        />
      </div>

      <ExportDealsModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        deals={rows}
      />
    </div>
  )
}
