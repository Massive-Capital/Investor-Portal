import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowRight } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import {
  DataTable,
  type DataTableColumn,
} from "../../../../../common/components/data-table/DataTable"
import { TableCompactAmountCell } from "../../../../../common/components/card-compact-amount/CardCompactAmount"
import { fetchDistributionSetup } from "../../distribution-setup/api/distributionSetupApi"
import type { PriorDistributionRecord } from "../../distribution-setup/types/distribution-setup.types"
import { parseMoneyDigits } from "../../utils/offeringMoneyFormat"
import "../../../usermanagement/user_management.css"
import "../../deals-list.css"
import "./distributions-tab.css"

type DistributionsTabProps = {
  dealId: string
}

type CompletedDistributionRow = PriorDistributionRecord & {
  status: "Completed"
}

function formatDistributionDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function sourceLabel(source: string | undefined): string {
  const s = (source ?? "").trim().toLowerCase()
  if (s === "capital" || s === "capital_event") return "Capital event"
  if (s === "operating") return "Operating"
  return "—"
}

/**
 * Deal Detail → Distributions: completed distribution history + setup entry.
 */
export function DistributionsTab({ dealId }: DistributionsTabProps) {
  const id = dealId.trim()
  const navigate = useNavigate()
  const classSetupHref = `/deals/${encodeURIComponent(id)}/class-setup`
  const distributionSetupHref = `/deals/${encodeURIComponent(id)}/distribution-setup`
  const returnState = { returnTab: "distributions" as const }

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [priorDistributions, setPriorDistributions] = useState<
    PriorDistributionRecord[]
  >([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const openDetails = useCallback(
    (row: PriorDistributionRecord) => {
      navigate(
        `/deals/${encodeURIComponent(id)}/distributions/${encodeURIComponent(row.id)}`,
      )
    },
    [id, navigate],
  )

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setLoadError(null)
    try {
      const bundle = await fetchDistributionSetup(id)
      setPriorDistributions(bundle.priorDistributions ?? [])
    } catch (err) {
      setPriorDistributions([])
      setLoadError(
        err instanceof Error ? err.message : "Could not load distributions.",
      )
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const rows: CompletedDistributionRow[] = useMemo(
    () =>
      [...priorDistributions]
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((p) => ({
          ...p,
          status: "Completed" as const,
        })),
    [priorDistributions],
  )

  useEffect(() => {
    setPage(1)
  }, [rows.length])

  const pagination = useMemo(
    () => ({
      page,
      pageSize,
      totalItems: rows.length,
      onPageChange: setPage,
      onPageSizeChange: (n: number) => {
        setPageSize(n)
        setPage(1)
      },
      ariaLabel: "Distributions table pagination",
    }),
    [page, pageSize, rows.length],
  )

  const totalDistributed = useMemo(
    () =>
      rows.reduce((sum, r) => {
        const n = parseMoneyDigits(r.amount)
        return sum + (Number.isFinite(n) ? n : 0)
      }, 0),
    [rows],
  )

  const columns: DataTableColumn<CompletedDistributionRow>[] = useMemo(
    () => [
      {
        id: "date",
        header: "Date",
        colWidth: "9.5rem",
        thClassName: "deal_dist_th_date",
        tdClassName: "deal_dist_td_date",
        sortValue: (row) => row.date,
        cell: (row) => (
          <button
            type="button"
            className="deals_table_name_link deal_dist_row_link"
            onClick={(e) => {
              e.stopPropagation()
              openDetails(row)
            }}
          >
            {formatDistributionDate(row.date)}
          </button>
        ),
      },
      {
        id: "amount",
        header: "Amount",
        align: "right",
        colWidth: "9.5rem",
        thClassName: "deals_th_align_right deal_dist_th_amount",
        tdClassName: "um_td_numeric deals_td_align_right deal_dist_td_amount",
        sortValue: (row) => {
          const n = parseMoneyDigits(row.amount)
          return Number.isFinite(n) ? n : 0
        },
        cell: (row) => <TableCompactAmountCell amount={row.amount} />,
      },
      {
        id: "source",
        header: "Waterfall",
        colWidth: "9rem",
        thClassName: "deal_dist_th_source",
        tdClassName: "deal_dist_td_source",
        sortValue: (row) => sourceLabel(row.source),
        cell: (row) => (
          <span className="deal_dist_wf_badge">{sourceLabel(row.source)}</span>
        ),
      },
      {
        id: "status",
        header: "Status",
        colWidth: "8rem",
        thClassName: "deal_dist_th_status",
        tdClassName: "deal_dist_td_status",
        sortValue: () => "Completed",
        cell: () => (
          <span className="deal_dist_status is-completed">Completed</span>
        ),
      },
    ],
    [openDetails],
  )

  const emptyLabel = loading
    ? "Loading distributions…"
    : loadError
      ? loadError
      : "No completed distributions yet. Complete a run in Distribution Setup to see it here."

  return (
    <div
      className="deal_dist_tab"
      role="region"
      aria-label="Classes and distributions"
    >
      <div className="um_panel um_members_tab_panel deals_list_table_panel deals_list_card_surface deal_inv_table_panel deal_dist_panel">
        <div
          className="um_toolbar um_toolbar_export_then_search deal_dist_toolbar"
          role="toolbar"
          aria-label="Distribution setup"
        >
          <div className="deal_dist_toolbar_copy">
            <h2 className="deal_dist_heading">Distributions</h2>
            <p className="deal_dist_lead">
              Completed runs for this deal. Open a row for investor payments.
            </p>
          </div>
          <div className="um_toolbar_actions deal_dist_toolbar_actions">
            <Link
              to={classSetupHref}
              state={returnState}
              className="um_toolbar_export_btn"
            >
              Class Setup
            </Link>
            <Link
              to={distributionSetupHref}
              state={returnState}
              className="um_btn_primary deals_list_add_link"
            >
              Distribution Setup
              <ArrowRight size={16} strokeWidth={2} aria-hidden />
            </Link>
          </div>
        </div>

        <div className="deal_dist_summary" aria-live="polite">
          <div className="deal_dist_summary_item">
            <span className="deal_dist_summary_label">Runs</span>
            <span className="deal_dist_summary_value">
              {loading ? "—" : rows.length}
            </span>
          </div>
          <div className="deal_dist_summary_item">
            <span className="deal_dist_summary_label">Total distributed</span>
            <span className="deal_dist_summary_value deal_dist_summary_value_money">
              {loading ? (
                "—"
              ) : (
                <TableCompactAmountCell amount={String(totalDistributed)} />
              )}
            </span>
          </div>
        </div>

        <DataTable
          visualVariant="members"
          membersTableClassName="um_table_members deal_inv_table deal_dist_table"
          columns={columns}
          rows={loading ? [] : rows}
          getRowKey={(row) => row.id}
          emptyLabel={emptyLabel}
          initialSort={{ columnId: "date", direction: "desc" }}
          onBodyRowClick={(row) => openDetails(row)}
          getRowClassName={() => "deal_dist_table_row"}
          pagination={pagination}
        />
      </div>
    </div>
  )
}
