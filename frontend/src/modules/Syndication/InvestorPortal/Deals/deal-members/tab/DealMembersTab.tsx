import { Download, Plus, Search } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "../../../../../../common/components/Toast"
import { FormTooltip } from "../../../../../../common/components/form-tooltip/FormTooltip"
import {
  DataTable,
  type DataTableColumn,
} from "../../../../../../common/components/data-table/DataTable"
import {
  ADD_MEMBER_DRAFT_UPDATED_EVENT,
  clearAddMemberDraft,
  isAddMemberSessionDraftRedundantWithApiRows,
} from "../add-investment/addMemberFormDraftStorage"
import {
  ADD_MEMBER_DRAFT_ROW_ID,
  buildAddMemberDraftInvestorRow,
  investorRowShowsDraftBadge,
} from "../add-investment/addMemberDraftInvestorRow"
import { fetchDealInvestorClasses, fetchDealMembers } from "../../api/dealsApi"
import { notifyDealMembersExportAudit } from "../../api/dealMembersExportNotifyApi"
import { DealMemberUserCell } from "../../components/DealMemberUserCell"
import { ExportDealInvestorRowsModal } from "../../components/ExportDealInvestorRowsModal"
import {
  investorRoleLabel,
  isDealMembersTabRole,
} from "../../constants/investor-profile"
import type { DealInvestorClass } from "../../types/deal-investor-class.types"
import type { DealInvestorRow } from "../../types/deal-investors.types"
import {
  buildDealMembersTableExportCsv,
  downloadDealExportCsv,
  exportAuditLinesForDealInvestorRows,
} from "../../utils/dealInvestorExportCsv"
import { dealInvestorStatusDisplayLabel } from "../../utils/dealInvestorTableDisplay"
import {
  displayAddedInvestorsCommittedAmount,
  displayInvestorCommittedAmount,
  formatCommittedZeroUsd,
  parseMoneyDigits,
} from "../../utils/offeringMoneyFormat"
import { DealInvestorRoleCell } from "../../components/DealInvestorRoleBadge"
import { InvestorClassPillsDisplay } from "../../components/InvestorClassPillsDisplay"
import { DealMemberRowActions } from "../components/DealMemberRowActions"
import "../../deal-investors-tab.css"
import "../../deals-list.css"
import "../../../../../usermanagement/user_management.css"
import "./deal-members.css"

function includeInDealMembersTable(r: DealInvestorRow): boolean {
  if (r.id === ADD_MEMBER_DRAFT_ROW_ID) {
    const role = String(r.investorRole ?? "").trim()
    if (!role || role === "—") return true
    return isDealMembersTabRole(role)
  }
  return isDealMembersTabRole(r.investorRole)
}

interface DealMembersTabProps {
  dealId: string
  /**
   * When true, “Copy offering link” is enabled (Offering Details → visibility “Only visible with link”).
   */
  offeringLinkAvailable: boolean
  /** When false, session add-member draft (if any) is merged into the table below. */
  addInvestmentOpen: boolean
  /** From DealInvestorsTab: true while Add or Edit modal is open — suppresses duplicate session draft row. */
  sharedInvestmentModalOpen?: boolean
  onAddMember: () => void
  onEditMember: (row: DealInvestorRow) => void
  onCopyMemberOfferingLink: (row: DealInvestorRow) => void
  onSendMemberInvitationMail: (row: DealInvestorRow) => void
  onDeleteMember: (row: DealInvestorRow) => void
  /** Opens read-only details (e.g. after refetching roster). */
  onViewMember: (row: DealInvestorRow) => void
  /** Increment to refetch rows after add/edit from the shared investor modal. */
  investorsRefreshKey?: number
}

export function DealMembersTab({
  dealId,
  offeringLinkAvailable,
  addInvestmentOpen,
  sharedInvestmentModalOpen = false,
  onAddMember,
  onEditMember,
  onCopyMemberOfferingLink,
  onSendMemberInvitationMail,
  onDeleteMember,
  onViewMember,
  investorsRefreshKey = 0,
}: DealMembersTabProps) {
  const [rows, setRows] = useState<DealInvestorRow[]>([])
  const rowsRef = useRef<DealInvestorRow[]>([])
  useEffect(() => {
    rowsRef.current = rows
  }, [rows])
  const [investorClasses, setInvestorClasses] = useState<DealInvestorClass[]>(
    [],
  )
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [addMemberDraftTick, setAddMemberDraftTick] = useState(0)
  const [query, setQuery] = useState("")
  const [exportModalOpen, setExportModalOpen] = useState(false)

  const load = useCallback(async () => {
    const showFullPageLoading = rowsRef.current.length === 0
    if (showFullPageLoading) setLoading(true)
    try {
      const members = await fetchDealMembers(dealId)
      setRows(members)
    } finally {
      setLoading(false)
    }
  }, [dealId])

  const handleViewMember = useCallback(
    async (row: DealInvestorRow) => {
      if (row.id === ADD_MEMBER_DRAFT_ROW_ID) {
        onViewMember(row)
        return
      }
      try {
        const list = await fetchDealMembers(dealId)
        const fresh = list.find((r) => r.id === row.id)
        onViewMember(fresh ?? row)
      } catch {
        toast.error("Could not load member details.")
      }
    },
    [dealId, onViewMember],
  )

  useEffect(() => {
    void load()
  }, [load, investorsRefreshKey])

  /** Drop stale add-member session draft when API already lists that contact (avoids duplicate row + stuck storage). */
  useEffect(() => {
    if (addInvestmentOpen || sharedInvestmentModalOpen) return
    if (rows.length === 0) return
    if (!isAddMemberSessionDraftRedundantWithApiRows(dealId, rows)) return
    clearAddMemberDraft(dealId)
  }, [
    dealId,
    rows,
    addInvestmentOpen,
    sharedInvestmentModalOpen,
    investorsRefreshKey,
  ])

  useEffect(() => {
    let cancelled = false
    void fetchDealInvestorClasses(dealId).then((list) => {
      if (!cancelled) setInvestorClasses(list)
    })
    return () => {
      cancelled = true
    }
  }, [dealId])

  useEffect(() => {
    function onDraftUpdated() {
      setAddMemberDraftTick((t) => t + 1)
    }
    window.addEventListener(ADD_MEMBER_DRAFT_UPDATED_EVENT, onDraftUpdated)
    return () =>
      window.removeEventListener(ADD_MEMBER_DRAFT_UPDATED_EVENT, onDraftUpdated)
  }, [])

  const sessionDraftRow = useMemo((): DealInvestorRow | null => {
    void addMemberDraftTick
    return buildAddMemberDraftInvestorRow(dealId, investorClasses)
  }, [dealId, investorClasses, addMemberDraftTick])

  const displayRows = useMemo(() => {
    const filtered = rows.filter(includeInDealMembersTable)
    const draft =
      sessionDraftRow && includeInDealMembersTable(sessionDraftRow)
        ? sessionDraftRow
        : null
    const hideSessionDraftRow =
      addInvestmentOpen || sharedInvestmentModalOpen
    /** Autosave row is already in `filtered` — do not duplicate with session draft. */
    const draftRedundantWithApi = isAddMemberSessionDraftRedundantWithApiRows(
      dealId,
      filtered,
    )
    if (draft && !hideSessionDraftRow && !draftRedundantWithApi)
      return [...filtered, draft]
    return filtered
  }, [
    rows,
    sessionDraftRow,
    addInvestmentOpen,
    sharedInvestmentModalOpen,
    dealId,
    addMemberDraftTick,
  ])

  const dealAllClassNamesLine = useMemo(
    () =>
      investorClasses
        .map((c) => String(c.name ?? "").trim())
        .filter(Boolean)
        .join(", "),
    [investorClasses],
  )

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return displayRows
    return displayRows.filter((r) => {
      const hay = [
        r.displayName,
        r.userDisplayName,
        r.userEmail,
        r.investorRole,
        r.investorClass,
        r.status,
        r.addedByDisplayName,
        investorRoleLabel(r.investorRole ?? ""),
        displayInvestorCommittedAmount(r),
        displayAddedInvestorsCommittedAmount(r),
      ]
        .map((x) => String(x ?? "").toLowerCase())
        .join(" ")
      return hay.includes(q)
    })
  }, [displayRows, query])

  useEffect(() => {
    setPage(1)
  }, [query])

  const exportModalRows = useMemo(
    () => displayRows.filter((r) => r.id !== ADD_MEMBER_DRAFT_ROW_ID),
    [displayRows],
  )

  const columns = useMemo((): DataTableColumn<DealInvestorRow>[] => {
    return [
      {
        id: "user",
        header: "User",
        sortValue: (r) =>
          `${String(r.displayName ?? "")} ${String(r.userDisplayName ?? "")} ${String(r.userEmail ?? "")}`.toLowerCase(),
        tdClassName: "um_td_user deal_inv_td_user_cell",
        cell: (r) => (
          <DealMemberUserCell row={r} isDraft={investorRowShowsDraftBadge(r)} />
        ),
      },
      {
        id: "role",
        header: "Deal role",
        sortValue: (r) =>
          String(investorRoleLabel(r.investorRole ?? "")).toLowerCase(),
        tdClassName: "deal_inv_td_role deal_inv_td_role_badge_cell",
        cell: (r) => <DealInvestorRoleCell row={r} />,
      },
      {
        id: "class",
        align: "center",
        header: (
          <span className="deal_inv_th_investor_class_head">
            <span>Class</span>
            {investorClasses.length === 0 ? (
              <FormTooltip
                label="Please complete the Offering Details section to assign an investor class."
                content={
                  <p className="deal_inv_class_tooltip_p">
                    Please complete the Offering Details section to assign an
                    investor class.
                  </p>
                }
                placement="bottom"
                panelAlign="start"
                openOnHover={false}
                nativeButtonTrigger={false}
              />
            ) : null}
          </span>
        ),
        thClassName: "deals_th_align_center",
        sortValue: (r) => {
          const a = (r.investorClass ?? "").trim()
          if (a) return a.toLowerCase()
          return dealAllClassNamesLine.toLowerCase()
        },
        tdClassName:
          "deal_inv_td_investor_class deal_inv_td_investor_class_cell deal_inv_td_investor_class_center",
        cell: (r) => {
          const assignedRaw = (r.investorClass ?? "").trim()
          const dealLine = dealAllClassNamesLine.trim()
          const pillSource = assignedRaw || dealLine
          if (!pillSource.trim())
            return <span className="deal_inv_class_pill_muted">—</span>
          const titleForTooltip =
            assignedRaw && dealLine && assignedRaw !== dealLine
              ? `${assignedRaw} · Deal: ${dealLine}`
              : pillSource
          return (
            <InvestorClassPillsDisplay
              pillSource={pillSource}
              titleForTooltip={titleForTooltip}
            />
          )
        },
      },
      {
        id: "commitment",
        align: "right",
        header: (
          <span className="deal_inv_th_investor_class_head deal_inv_th_commitment_head">
            <span>Commitment</span>
            <FormTooltip
              label="What this amount means"
              content={
                <p className="deal_inv_class_tooltip_p">
                  Total amount this member has committed on this deal: the
                  subscription commitment plus any additional contribution lines
                  from their investment record. Displayed in USD. If none is
                  recorded, this shows $0.
                </p>
              }
              placement="bottom"
              panelAlign="end"
              openOnHover
              nativeButtonTrigger={false}
            />
          </span>
        ),
        thClassName: "deals_th_align_right",
        sortValue: (r) =>
          parseMoneyDigits(displayInvestorCommittedAmount(r)),
        tdClassName:
          "deal_inv_td_ellipsis deal_inv_td_committed um_td_numeric",
        cell: (r) => {
          const text = displayInvestorCommittedAmount(r)
          const display = String(text ?? "").trim() || formatCommittedZeroUsd()
          return (
            <span
              className="deal_inv_ellipsis_text deal_inv_ellipsis_text_end"
              title={display}
            >
              {display}
            </span>
          )
        },
      },
      {
        id: "added_investors_commitment",
        align: "right",
        header: (
          <span className="deal_inv_th_investor_class_head deal_inv_th_commitment_head">
            <span>Investors added</span>
            <FormTooltip
              label="Commitment from investors they added"
              content={
                <p className="deal_inv_class_tooltip_p">
                  Total subscription commitment (plus additional contribution lines)
                  recorded on this deal for other roster contacts this member added
                  to the deal. Your own commitment is not included. Shown in USD.
                </p>
              }
              placement="bottom"
              panelAlign="end"
              openOnHover
              nativeButtonTrigger={false}
            />
          </span>
        ),
        thClassName: "deals_th_align_right",
        sortValue: (r) =>
          parseMoneyDigits(displayAddedInvestorsCommittedAmount(r)),
        tdClassName:
          "deal_inv_td_ellipsis deal_inv_td_committed um_td_numeric",
        cell: (r) => {
          if (r.id === ADD_MEMBER_DRAFT_ROW_ID) return "—"
          const text = displayAddedInvestorsCommittedAmount(r)
          const display = String(text ?? "").trim() || "—"
          return (
            <span
              className="deal_inv_ellipsis_text deal_inv_ellipsis_text_end"
              title={display}
            >
              {display}
            </span>
          )
        },
      },
      {
        id: "status",
        header: "Status",
        sortValue: (r) =>
          dealInvestorStatusDisplayLabel(r).toLowerCase(),
        tdClassName: "deal_inv_td_ellipsis",
        cell: (r) => dealInvestorStatusDisplayLabel(r),
      },
      {
        id: "added_by",
        header: "Added by",
        sortValue: (r) =>
          String(r.addedByDisplayName ?? "").toLowerCase(),
        tdClassName: "deal_inv_td_ellipsis",
        cell: (r) => {
          if (r.id === ADD_MEMBER_DRAFT_ROW_ID) return "—"
          const s = String(r.addedByDisplayName ?? "").trim()
          return s && s !== "—" ? s : "—"
        },
      },
      {
        id: "actions",
        header: "Actions",
        align: "center",
        thClassName: "um_th_actions",
        tdClassName: "um_td_actions deal_inv_td_actions",
        cell: (r) => (
          <div className="deal_members_actions_cell">
            <DealMemberRowActions
              row={r}
              draftRow={r.id === ADD_MEMBER_DRAFT_ROW_ID}
              invitationMailSent={r.invitationMailSent === true}
              offeringLinkAvailable={offeringLinkAvailable}
              onView={handleViewMember}
              onEdit={onEditMember}
              onCopyLink={onCopyMemberOfferingLink}
              onSendInvite={onSendMemberInvitationMail}
              onDelete={onDeleteMember}
            />
          </div>
        ),
      },
    ]
  }, [
    dealAllClassNamesLine,
    investorClasses.length,
    onEditMember,
    offeringLinkAvailable,
    onCopyMemberOfferingLink,
    onSendMemberInvitationMail,
    onDeleteMember,
    handleViewMember,
  ])

  function handleExportDealMembers(selected: DealInvestorRow[]) {
    const csv = buildDealMembersTableExportCsv(selected)
    const stamp = new Date().toISOString().slice(0, 10)
    const safeDeal = dealId.replace(/[^\w-]+/g, "_").slice(0, 36)
    downloadDealExportCsv(csv, `deal-members-${safeDeal}-${stamp}.csv`)
    void notifyDealMembersExportAudit(dealId, {
      rowCount: selected.length,
      exportedLines: exportAuditLinesForDealInvestorRows(selected),
    })
  }

  return (
    <div className="deal_members_tab">
      <div className="um_header_row deal_members_header_row">
        <button
          type="button"
          className="deals_list_add_btn"
          onClick={onAddMember}
        >
          <Plus size={18} strokeWidth={2} aria-hidden />
          Add Member
        </button>
      </div>

      <ExportDealInvestorRowsModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        title="Export deal members"
        hint="Search and select members, then export to Excel (CSV format)."
        searchPlaceholder="Search deal members…"
        searchAriaLabel="Search deal members in export list"
        listAriaLabel="Deal members to export"
        rows={exportModalRows}
        onExportExcel={handleExportDealMembers}
      />

      <div className="um_panel um_members_tab_panel deal_inv_table_panel">
        {loading ? (
          <p className="deals_list_not_found" role="status">
            Loading deal members…
          </p>
        ) : (
          <>
            <div className="um_toolbar deal_inv_table_um_toolbar">
              <div className="um_search_wrap">
                <Search className="um_search_icon" size={18} aria-hidden />
                <input
                  type="search"
                  className="um_search_input"
                  placeholder="Search deal members…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Search deal members"
                />
              </div>
              <div className="um_toolbar_actions deal_inv_table_toolbar_actions">
                <button
                  type="button"
                  className="um_toolbar_export_btn"
                  onClick={() => setExportModalOpen(true)}
                >
                  <Download size={18} strokeWidth={2} aria-hidden />
                  <span>Export all deal members</span>
                </button>
              </div>
            </div>

            <DataTable<DealInvestorRow>
              visualVariant="members"
              membersTableClassName="um_table_members deal_inv_table"
              columns={columns}
              rows={filteredRows}
              getRowKey={(r, i) => r.id || `dm-${dealId}-${i}`}
              getRowClassName={(r) =>
                investorRowShowsDraftBadge(r) ? "deal_inv_row_draft" : undefined
              }
              onBodyRowClick={(r) => {
                if (r.id !== ADD_MEMBER_DRAFT_ROW_ID) return
                onEditMember(r)
              }}
              emptyLabel="No deal members yet. Add a member or record an investment on the Investors tab."
              pagination={{
                page,
                pageSize,
                totalItems: filteredRows.length,
                onPageChange: setPage,
                onPageSizeChange: (n) => {
                  setPageSize(n)
                  setPage(1)
                },
                ariaLabel: "Deal members pagination",
              }}
            />
          </>
        )}
      </div>
    </div>
  )
}
