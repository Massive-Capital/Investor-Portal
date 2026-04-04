import { RefreshCw } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom"
import {
  DataTable,
  type DataTableColumn,
} from "../../common/components/data-table/DataTable"
import { fetchDealsListForOrganization } from "../Syndication/InvestorPortal/Deals/api/dealsApi"
import { dealStageLabel } from "../Syndication/InvestorPortal/deals-mock-data"
import {
  dateSortValue,
  dealTypeDisplayLabel,
  formatDealListDateDisplay,
} from "../Syndication/InvestorPortal/Deals/dealsListDisplay"
import type { DealListRow } from "../Syndication/InvestorPortal/Deals/types/deals.types"
import type { CustomerCompanyOutletContext } from "./CustomerCompanyLayout"
import "../usermanagement/user_management.css"
import "./company_page.css"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default function CompanyDealsPage() {
  const { companyId = "" } = useParams<{ companyId: string }>()
  const navigate = useNavigate()
  const { companyDisplayName } = useOutletContext<CustomerCompanyOutletContext>()

  const [deals, setDeals] = useState<DealListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const load = useCallback(async () => {
    const id = companyId.trim()
    if (!UUID_RE.test(id)) {
      setDeals([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError("")
    setDeals([])
    try {
      const { deals: rows, error: apiErr } =
        await fetchDealsListForOrganization(id)
      if (apiErr) {
        setError(apiErr)
        setDeals([])
        return
      }
      setDeals(rows)
    } catch {
      setError("Unable to load deals.")
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    if (!UUID_RE.test(companyId.trim())) {
      navigate("/customers", { replace: true })
      return
    }
    void load()
  }, [companyId, navigate, load])

  const titleCompany = companyDisplayName?.trim() || "Company"

  const pagination = useMemo(
    () => ({
      page,
      pageSize,
      totalItems: deals.length,
      onPageChange: setPage,
      onPageSizeChange: setPageSize,
      ariaLabel: `Deals for ${titleCompany} table pagination`,
    }),
    [page, pageSize, deals.length, titleCompany],
  )

  const columns: DataTableColumn<DealListRow>[] = useMemo(
    () => [
      {
        id: "name",
        header: "Deal",
        sortValue: (row) => (row.dealName ?? "").toLowerCase(),
        tdClassName: "cp_company_deal_name_td",
        cell: (row) => (
          <Link
            to={`/deals/${encodeURIComponent(row.id)}`}
            className="um_user_meta_username cp_company_deal_name_link"
          >
            {row.dealName?.trim() || "—"}
          </Link>
        ),
      },
      {
        id: "type",
        header: "Type",
        sortValue: (row) => dealTypeDisplayLabel(row.dealType).toLowerCase(),
        tdClassName: "cp_company_deal_meta_td",
        cell: (row) => (
          <span className="cp_company_cell_muted">
            {dealTypeDisplayLabel(row.dealType)}
          </span>
        ),
      },
      {
        id: "stage",
        header: "Stage",
        sortValue: (row) =>
          dealStageLabel(row.dealStage).toLowerCase(),
        tdClassName: "cp_company_deal_meta_td",
        cell: (row) => (
          <span className="cp_company_cell_muted">
            {dealStageLabel(row.dealStage)}
          </span>
        ),
      },
      {
        id: "start",
        header: "Start",
        align: "center",
        thClassName: "cp_company_deal_date_th",
        tdClassName: "cp_company_deal_date_td",
        sortValue: (row) =>
          dateSortValue(row.startDateDisplay ?? row.createdDateDisplay),
        cell: (row) =>
          formatDealListDateDisplay(
            row.startDateDisplay ?? row.createdDateDisplay,
          ),
      },
      {
        id: "close",
        header: "Close",
        align: "center",
        thClassName: "cp_company_deal_date_th",
        tdClassName: "cp_company_deal_date_td",
        sortValue: (row) => dateSortValue(row.closeDateDisplay),
        cell: (row) => formatDealListDateDisplay(row.closeDateDisplay),
      },
      {
        id: "location",
        header: "Location",
        sortValue: (row) => (row.locationDisplay ?? "").toLowerCase(),
        tdClassName: "cp_company_deal_meta_td",
        cell: (row) => (
          <span className="cp_company_cell_muted" title={row.locationDisplay}>
            {row.locationDisplay?.trim() || "—"}
          </span>
        ),
      },
      {
        id: "investors",
        header: "Investors",
        align: "center",
        thClassName: "cp_company_deal_num_th",
        tdClassName: "cp_company_deal_num_td",
        sortValue: (row) =>
          Number.parseInt(String(row.investors ?? "").replace(/\D/g, ""), 10) ||
          0,
        cell: (row) => row.investors?.trim() || "—",
      },
    ],
    [],
  )

  useEffect(() => {
    setPage(1)
  }, [deals.length, companyId])

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(deals.length / pageSize))
    if (page > totalPages) setPage(totalPages)
  }, [deals.length, page, pageSize])

  return (
    <div
      className="um_panel um_members_tab_panel"
      id="cp-company-panel-deals"
      role="tabpanel"
      aria-labelledby="cp-company-tab-deals"
    >
      <div className="cp_company_tab_panel_inner">
        <div className="um_toolbar cp_company_tab_toolbar">
          <p className="cp_company_tab_toolbar_hint">
            Deals created for{" "}
            <strong className="cp_company_tab_toolbar_strong">
              {titleCompany}
            </strong>
            . Open a deal for full details.
          </p>
          <button
            type="button"
            className="um_btn_toolbar"
            disabled={loading}
            onClick={() => void load()}
          >
            <RefreshCw size={18} strokeWidth={2} aria-hidden />
            Refresh
          </button>
        </div>

        {error ? (
          <p className="um_msg_error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="cp_company_tab_table_wrap">
          <DataTable
            visualVariant="members"
            membersTableClassName="um_table_members cp_company_deals_table"
            columns={columns}
            rows={loading ? [] : deals}
            getRowKey={(row, i) => row.id || `deal-${i}`}
            emptyLabel={
              loading
                ? "Loading deals…"
                : deals.length === 0
                  ? "No deals for this company yet."
                  : "No rows."
            }
            emptyStateRole={loading ? "status" : undefined}
            pagination={
              !loading && deals.length > 0 ? pagination : undefined
            }
          />
        </div>
      </div>
    </div>
  )
}
