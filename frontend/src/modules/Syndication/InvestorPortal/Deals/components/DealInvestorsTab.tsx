import {
  Activity,
  BadgeCheck,
  CircleDollarSign,
  DollarSign,
  Download,
  FileCheck,
  Landmark,
  PiggyBank,
  Plus,
  Search,
  Tag,
  UserRound,
} from "lucide-react"
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useState,
} from "react"
import { AddInvestmentModal } from "../deal-members"
import {
  addInvestmentFormToRow,
  ADD_MEMBER_DRAFT_ROW_ID,
  buildAddMemberDraftInvestorRow,
  investorRowShowsDraftBadge,
} from "../deal-members/add-investment/addMemberDraftInvestorRow"
import {
  ADD_MEMBER_DRAFT_UPDATED_EVENT,
  clearAddMemberDraft,
  isAddMemberSessionDraftRedundantWithApiRows,
  loadAddMemberDraft,
} from "../deal-members/add-investment/addMemberFormDraftStorage"
import { notifyDealInvestorsExportAudit } from "../api/dealInvestorsExportNotifyApi"
import { InviteMailStatusBadge } from "./InviteMailStatusBadge"
import { DealMemberUserCell } from "./DealMemberUserCell"
import { DealInvestorCommittedAmountCell } from "./DealInvestorCommittedAmountCell"
import { DealInvestorRoleCell } from "./DealInvestorRoleBadge"
import { ExportDealInvestorRowsModal } from "./ExportDealInvestorRowsModal"
import { InvestorClassPillsDisplay } from "./InvestorClassPillsDisplay"
import { DealMemberRowActions } from "../deal-members/components/DealMemberRowActions"
import { AddLpInvestorModal } from "./AddLpInvestorModal"
import { DealInvestorViewModal } from "./DealInvestorViewModal"
import type { AddInvestmentFormValues } from "../deal-members"
import {
  displayInvestorCommittedAmount,
  fundedAmountForTotalFundedKpi,
  formatMoneyFieldDisplay,
  investorRowCommittedAmountIsZero,
  parseMoneyDigits,
} from "../utils/offeringMoneyFormat"
import {
  DataTable,
  type DataTableColumn,
} from "../../../../../common/components/data-table/DataTable"
import { FormTooltip } from "../../../../../common/components/form-tooltip/FormTooltip"
import { toast } from "../../../../../common/components/Toast"
import { ToolStyleCard } from "../../../../../common/components/tool-style-card/ToolStyleCard"
import { getApiV1Base } from "../../../../../common/utils/apiBaseUrl"
import {
  upsertRuntimeForViewerFromInvestorsPayload,
  upsertRuntimeFromViewerAddInvestmentForm,
} from "@/modules/Investing/pages/investments/upsertRuntimeFromDealSession"
import {
  fetchDealInvestorClasses,
  fetchDealInvestors,
  isDealDetailFormIncomplete,
  postDealInvestment,
  postDealLpInvestor,
  putDealInvestment,
  putDealLpInvestor,
  type DealDetailApi,
} from "../api/dealsApi"
import type { DealInvestorClass } from "../types/deal-investor-class.types"
import {
  investorProfileIdFromLabel,
  investorRoleSelectValueFromStored,
  isLpInvestorRole,
} from "../constants/investor-profile"
import { INVESTMENT_STATUS_APPROVE_FUND } from "../constants/investment-status"
import { formatMemberUsername } from "../../../../usermanagement/memberAdminShared"
import {
  buildDealInvestorsExportCsv,
  downloadDealExportCsv,
  exportAuditLinesForDealInvestorRows,
} from "../utils/dealInvestorExportCsv"
import {
  dealInvestorStatusDisplayLabel,
  investorFundedColumnLabel,
  investorRowIsFundApproved,
} from "../utils/dealInvestorTableDisplay"
import type {
  DealInvestorRow,
  DealInvestorsKpis,
  DealInvestorsPayload,
} from "../types/deal-investors.types"
import "../../../../usermanagement/user_management.css"
import "../../Dashboard/sponsor-dashboard.css"
import "../deals-list.css"
import "../deal-investors-tab.css"
import "../deal-members/tab/deal-members.css"

export interface DealInvestorsTabHandle {
  openViewInvestor: (row: DealInvestorRow) => void
  openEditInvestor: (row: DealInvestorRow) => void
  /** Refetch LP investors from the API without remounting (e.g. after member delete). */
  refetchInvestors: () => Promise<void>
}

/** Same compact “Add Investors” modal as add — `deal_lp_investor` rows, not full investment form. */
function shouldUseLpInvestorsModalForEdit(row: DealInvestorRow): boolean {
  if (row.id === ADD_MEMBER_DRAFT_ROW_ID) return false
  if (row.investorKind === "lp_roster") return true
  if (row.investorKind === "investment") return false
  return isLpInvestorRole(row.investorRole ?? "")
}

/** LP tab row, or add-member draft with a contact picked but role not set yet. */
function isLpInvestorsTabRow(r: DealInvestorRow): boolean {
   if (r.id === ADD_MEMBER_DRAFT_ROW_ID) {
    if (isLpInvestorRole(r.investorRole ?? "")) return true
    const role = String(r.investorRole ?? "").trim()
    const unset = !role || role === "—"
    return unset && Boolean(r.contactId?.trim())
  }
  return isLpInvestorRole(r.investorRole ?? "")
}

interface DealInvestorsTabProps {
  dealId: string
  dealName: string
  /** When set, KPI cards can show offering size from deal / investor classes if API KPIs are empty. */
  dealDetail?: DealDetailApi | null
  addInvestmentOpen: boolean
  /** Hide KPI/table; only host Add Investment modal (e.g. when Deal Members tab is open). */
  modalOnly?: boolean
  onAddInvestmentClose: () => void
  /** Opens the full add/edit investment modal (Deal Members flow + draft “Continue editing”). */
  onOpenFullInvestmentModal?: () => void
  /** Mirrors deal detail state: drives “Add Investor” vs “Add Member” modal title. */
  addInvestmentEntry?: "member" | "investor"
  /**
   * Add mode: restore autosaved add-member draft (default true). Deal detail sets false for
   * “Add Member” (empty form without clearing the table draft row); draft “Continue editing” uses true.
   */
  restoreAddMemberSessionDraft?: boolean
  /** Called after investors are added or updated — refreshes the Deal Members table only. */
  onInvestorsChanged?: () => void
  /** Send investor invitation email from the Investors table row menu. */
  onSendInvitationMail?: (row: DealInvestorRow) => void | Promise<void>
  /** Copy offering link (same as Deal Members). */
  onCopyOfferingLink?: (row: DealInvestorRow) => void
  /**
   * When true, “Copy offering link” is enabled (Offering Details → “Only visible with link”).
   */
  offeringLinkAvailable?: boolean
  /** Remove member / roster row (same as Deal Members). */
  onDeleteMember?: (row: DealInvestorRow) => void | Promise<void>
  /** Fires when Add or Edit investment modal is open — hide session draft row in Deal Members table. */
  onSharedInvestmentModalOpenChange?: (open: boolean) => void
  /**
   * Increment when investors change outside this tab (e.g. LP “Invest now” on the deal)
   * so the table and KPIs refetch from the API.
   */
  investorsListRefreshKey?: number
  /**
   * After send-invitation API succeeds, rows marked here show Mail sent / Re-send
   * until the list response includes `send_invitation_mail` / `invitationMailSent`.
   */
  invitationMailStatusByRowId?: Record<string, true>
}

function parseCommittedCellToNumber(s: string | undefined): number {
  if (!s || s === "—") return 0
  const n = parseFloat(String(s).replace(/[^0-9.-]/g, ""))
  return Number.isFinite(n) ? n : 0
}

function formatUsdKpiDisplay(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n)
}

/** Total Funded tile: always show USD (including `$0`); never em dash. */
function formatUsdKpiTotalFunded(n: number): string {
  const v = Number.isFinite(n) ? Math.max(0, n) : 0
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(v)
}

/**
 * Same source order as the deals list Investor Class column: investor-classes API
 * first, then list-row snapshot from deal detail when the API has not loaded classes yet.
 */
function buildDealClassNamesLine(
  investorClasses: DealInvestorClass[],
  dealDetail: DealDetailApi | null | undefined,
): string {
  const fromClasses = investorClasses
    .map((c) => String(c.name ?? "").trim())
    .filter(Boolean)
    .join(", ")
  if (fromClasses) return fromClasses
  const raw = dealDetail?.listRow?.investorClass?.trim()
  if (!raw || raw === "—") return ""
  return raw
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ")
}

function dealInvestorRowToFormValues(row: DealInvestorRow): AddInvestmentFormValues {
  const profileId =
    row.profileId?.trim() ||
    investorProfileIdFromLabel(row.entitySubtitle) ||
    ""
  return {
    offeringId: row.offeringId?.trim() || "primary",
    contactId: row.contactId ?? "",
    contactDisplayName: row.displayName,
    contactEmail:
      row.userEmail && row.userEmail !== "—" ? row.userEmail : undefined,
    contactUsername:
      row.userDisplayName && row.userDisplayName !== "—"
        ? row.userDisplayName
        : undefined,
    profileId,
    investorRole: investorRoleSelectValueFromStored(row.investorRole),
    status: row.status && row.status !== "—" ? row.status : "",
    investorClass:
      row.investorClass && row.investorClass !== "—" ? row.investorClass : "",
    docSignedDate: row.docSignedDateIso?.trim() ?? "",
    commitmentAmount: row.commitmentAmountRaw?.trim() ?? "",
    extraContributionAmounts: [...(row.extraContributionAmounts ?? [])],
    documentFileName: null,
    sendInvitationMail: "no",
    fundApproved:
      typeof row.fundApproved === "boolean"
        ? row.fundApproved
        : investorRowIsFundApproved(row),
  }
}

function investorRowSupportsApproveFund(row: DealInvestorRow): boolean {
  if (row.id === ADD_MEMBER_DRAFT_ROW_ID) return false
  if (row.investorKind === "lp_roster") return false
  return true
}

/** True when status is already at/after “Approve fund” or terminal — action disabled. */
function investorRowApproveFundNotApplicable(row: DealInvestorRow): boolean {
  if (investorRowIsFundApproved(row)) return true
  const s = (row.status ?? "").trim()
  if (!s || s === "—") return false
  if (s.startsWith("Inactive")) return true
  if (s.startsWith("Canceled")) return true
  return false
}

function resolveInvestorClassLabelForRow(
  formValue: string,
  classes: DealInvestorClass[],
): string {
  const t = formValue.trim()
  if (!t) return ""
  const byId = classes.find((c) => c.id === t)
  if (byId) return byId.name.trim() || byId.id
  return t
}

function VerifiedAccBadge({ label }: { label: string }) {
  const t = String(label ?? "").trim() || "—"
  const hint = t !== "—" ? t : undefined
  return (
    <span
      className="deal_inv_verified_badge deal_inv_verified_badge_ellipsis"
      title={hint}
    >
      <span className="deal_inv_verified_badge_inner">{t}</span>
    </span>
  )
}

/** Single-line cell: ellipsis + native tooltip (`title`) for overflow; full text stays in DOM for screen readers. */
function DealInvEllipsisText({
  text,
  alignEnd = false,
  className = "",
  title: titleProp,
}: {
  text: string
  alignEnd?: boolean
  className?: string
  /** Optional richer tooltip (e.g. name + `addedByUserId`). */
  title?: string
}) {
  const display = String(text ?? "").trim() || "—"
  const hint =
    titleProp?.trim() ||
    (display !== "—" ? display : undefined)
  return (
    <span
      className={`deal_inv_ellipsis_text${alignEnd ? " deal_inv_ellipsis_text_end" : ""}${className ? ` ${className}` : ""}`.trim()}
      title={hint}
    >
      {display}
    </span>
  )
}

/**
 * Same basis as the Offering Size KPI tile — numeric dollars, or `null` when unknown.
 */
function resolveOfferingSizeKpiAmount(
  base: DealInvestorsKpis,
  dealDetail: DealDetailApi | null | undefined,
  investorClasses: DealInvestorClass[],
): number | null {
  let sumFromClasses = 0
  let hasAnyClassAmount = false
  for (const c of investorClasses) {
    const n = parseMoneyDigits(String(c.offeringSize ?? ""))
    if (Number.isFinite(n)) {
      hasAnyClassAmount = true
      sumFromClasses += n
    }
  }
  if (hasAnyClassAmount) return sumFromClasses

  if (dealDetail?.offeringSize?.trim()) {
    const n = parseMoneyDigits(dealDetail.offeringSize)
    return Number.isFinite(n) ? n : null
  }

  const raise = dealDetail?.listRow?.raiseTarget?.trim()
  if (raise && raise !== "—") {
    const n = parseMoneyDigits(raise)
    return Number.isFinite(n) ? n : null
  }

  const apiOs = base.offeringSize?.trim()
  if (apiOs && apiOs !== "—") {
    const n = parseMoneyDigits(apiOs)
    return Number.isFinite(n) ? n : null
  }

  return null
}

/**
 * Offering Size KPI: sum of all investor-class offering sizes (Offering Information),
 * then deal `offeringSize` / list `raiseTarget`, then API KPIs.
 */
function resolveOfferingSizeKpi(
  base: DealInvestorsKpis,
  dealDetail: DealDetailApi | null | undefined,
  investorClasses: DealInvestorClass[],
): string {
  const amt = resolveOfferingSizeKpiAmount(base, dealDetail, investorClasses)
  return amt != null && Number.isFinite(amt)
    ? formatMoneyFieldDisplay(String(amt))
    : "—"
}

function DealInvestorsPopulated({
  initialPayload,
  dealId,
  dealDetail,
  investorClasses,
  onEditInvestor,
  onAddInvestor,
  onContinueDraftEdit,
  onSendInvitationMail,
  onCopyOfferingLink,
  onDeleteMember,
  offeringLinkAvailable,
  onRefreshInvestors,
}: {
  initialPayload: DealInvestorsPayload
  dealId: string
  dealDetail?: DealDetailApi | null
  investorClasses: DealInvestorClass[]
  onEditInvestor: (row: DealInvestorRow) => void
  onAddInvestor: () => void
  onContinueDraftEdit?: () => void
  onSendInvitationMail?: (row: DealInvestorRow) => void | Promise<void>
  onCopyOfferingLink?: (row: DealInvestorRow) => void
  onDeleteMember?: (row: DealInvestorRow) => void | Promise<void>
  offeringLinkAvailable: boolean
  onRefreshInvestors?: () => void | Promise<void>
}) {
  const [query, setQuery] = useState("")
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [rows, setRows] = useState<DealInvestorRow[]>(initialPayload.investors)
  const [approveFundBusyId, setApproveFundBusyId] = useState<string | null>(null)

  const handleApproveFund = useCallback(
    async (row: DealInvestorRow) => {
      if (!getApiV1Base()) {
        toast.error(
          "Not available",
          "Configure the API base URL to update investments.",
        )
        return
      }
      if (
        !investorRowSupportsApproveFund(row) ||
        investorRowApproveFundNotApplicable(row) ||
        investorRowCommittedAmountIsZero(row)
      ) {
        return
      }
      setApproveFundBusyId(row.id)
      try {
        const values: AddInvestmentFormValues = {
          ...dealInvestorRowToFormValues(row),
          status: INVESTMENT_STATUS_APPROVE_FUND,
          fundApproved: true,
        }
        const res = await putDealInvestment(dealId, row.id, values, null)
        if (!res.ok) {
          toast.error("Could not approve fund", res.message)
          return
        }
        if (res.mode !== "api") {
          toast.error("Not available", "API is not configured.")
          return
        }
        toast.success("Fund approved", "Investment status updated.")
        await onRefreshInvestors?.()
      } finally {
        setApproveFundBusyId(null)
      }
    },
    [dealId, onRefreshInvestors],
  )

  const kpis = useMemo((): DealInvestorsKpis => {
    const base = initialPayload.kpis
    const sum = rows.reduce(
      (acc, r) =>
        acc + parseCommittedCellToNumber(displayInvestorCommittedAmount(r)),
      0,
    )
    const count = rows.length
    const avg = count > 0 && sum > 0 ? sum / count : 0
    const approvedInvestorCount = rows.filter(
      (r) =>
        r.id !== ADD_MEMBER_DRAFT_ROW_ID && investorRowIsFundApproved(r),
    ).length
    const fundedSum = rows
      .filter((r) => r.id !== ADD_MEMBER_DRAFT_ROW_ID)
      .reduce((acc, r) => acc + fundedAmountForTotalFundedKpi(r), 0)
    const offeringAmt = resolveOfferingSizeKpiAmount(
      base,
      dealDetail,
      investorClasses,
    )
    return {
      ...base,
      offeringSize: resolveOfferingSizeKpi(
        base,
        dealDetail,
        investorClasses,
      ),
      committed: formatUsdKpiDisplay(sum),
      totalApproved: formatUsdKpiDisplay(sum),
      /** Headcount of fund-approved investors (matches Funded column / investorRowIsFundApproved). */
      approvedCount: String(approvedInvestorCount),
      averageApproved:
        count > 0 && sum > 0 ? formatUsdKpiDisplay(avg) : "—",
      /** Sum of funded $: full commitment when Funded is Approved; if pending re-approval after LP increase, only the approved snapshot counts until sponsor approves again. */
      totalFunded: formatUsdKpiTotalFunded(fundedSum),
      /** Offering size (same basis as tile) minus total funded; unknown offering → "—". */
      remaining:
        offeringAmt != null && Number.isFinite(offeringAmt)
          ? formatUsdKpiTotalFunded(offeringAmt - fundedSum)
          : "—",
    }
  }, [
    initialPayload.kpis,
    rows,
    dealDetail,
    investorClasses,
  ])
  const [filterClass, setFilterClass] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [filterEsign, setFilterEsign] = useState("")
  const [filterFunding, setFilterFunding] = useState("")
  const [filterAccreditation, setFilterAccreditation] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  /** Count of investors with a signed date (excludes add-member draft row). */
  const documentSignedKpi = useMemo(() => {
    const dataRows = rows.filter((r) => r.id !== ADD_MEMBER_DRAFT_ROW_ID)
    const signedCount = dataRows.filter((r) => {
      const s = String(r.signedDate ?? "").trim()
      return s && s !== "—"
    }).length
    return dataRows.length > 0
      ? `${signedCount} of ${dataRows.length}`
      : "—"
  }, [rows])

  useEffect(() => {
    setRows(initialPayload.investors)
  }, [initialPayload])

  /** Classes on this deal: Offering Information API, else list row (matches deals list column). */
  const dealAllClassNamesLine = useMemo(
    () => buildDealClassNamesLine(investorClasses, dealDetail),
    [investorClasses, dealDetail],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (q) {
        const mailLabel =
          r.invitationMailSent === true
            ? "mail sent"
            : "not sent"
        const haystack =
          `${r.displayName} ${r.entitySubtitle} ${r.userDisplayName} ${r.userEmail} ${r.addedByDisplayName ?? ""} ${mailLabel} ${investorFundedColumnLabel(r)}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      if (filterClass) {
        const rowClass = (r.investorClass ?? "").trim()
        if (rowClass) {
          if (rowClass !== filterClass) return false
        } else {
          const dealLine = dealAllClassNamesLine.trim()
          const tokens = dealLine
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
          if (!tokens.includes(filterClass)) return false
        }
      }
      if (filterStatus && r.status !== filterStatus) return false
      if (filterAccreditation && r.selfAccredited !== filterAccreditation)
        return false
      if (filterEsign === "not_started") {
        if (!String(r.verifiedAccLabel).toLowerCase().includes("not started"))
          return false
      }
      if (filterEsign === "complete") {
        if (String(r.verifiedAccLabel).toLowerCase().includes("not started"))
          return false
      }
      if (filterFunding === "funded") {
        if (!investorRowIsFundApproved(r)) return false
      }
      if (filterFunding === "pending") {
        if (investorRowIsFundApproved(r)) return false
      }
      return true
    })
  }, [
    rows,
    query,
    filterClass,
    filterStatus,
    filterEsign,
    filterFunding,
    filterAccreditation,
    dealAllClassNamesLine,
  ])

  useEffect(() => {
    setPage(1)
  }, [
    query,
    filterClass,
    filterStatus,
    filterEsign,
    filterFunding,
    filterAccreditation,
  ])

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
    if (page > totalPages) setPage(totalPages)
  }, [filtered.length, pageSize, page])

  const classOptions = useMemo(() => {
    const s = new Set(
      rows.map((r) => r.investorClass).filter(Boolean) as string[],
    )
    for (const c of investorClasses) {
      const n = String(c.name ?? "").trim()
      if (n) s.add(n)
    }
    const listRaw = dealDetail?.listRow?.investorClass?.trim()
    if (listRaw && listRaw !== "—") {
      for (const p of listRaw.split(/[;,]/)) {
        const t = p.trim()
        if (t) s.add(t)
      }
    }
    return [...s].sort()
  }, [rows, investorClasses, dealDetail])

  const statusOptions = useMemo(() => {
    const s = new Set(rows.map((r) => r.status).filter(Boolean))
    return [...s].sort()
  }, [rows])

  const pagination = useMemo(
    () => ({
      page,
      pageSize,
      totalItems: filtered.length,
      onPageChange: setPage,
      onPageSizeChange: setPageSize,
      ariaLabel: "Investors table pagination",
    }),
    [page, pageSize, filtered.length],
  )

  const exportModalRows = useMemo(
    () => filtered.filter((r) => r.id !== ADD_MEMBER_DRAFT_ROW_ID),
    [filtered],
  )

  const columns: DataTableColumn<DealInvestorRow>[] = useMemo(
    () => [
      {
        id: "investor",
        header: "Investor",
        sortValue: (row) =>
          `${row.displayName} ${row.entitySubtitle} ${formatMemberUsername(row.userDisplayName)} ${row.userEmail}`.toLowerCase(),
        tdClassName: "um_td_user deal_inv_td_user_cell",
        cell: (row) => (
          <DealMemberUserCell
            row={row}
            isDraft={investorRowShowsDraftBadge(row)}
          />
        ),
      },
      {
        id: "role",
        header: "Role",
        sortValue: (row) => (row.investorRole ?? "").trim().toLowerCase(),
        tdClassName: "deal_inv_td_role deal_inv_td_role_badge_cell",
        cell: (row) => <DealInvestorRoleCell row={row} />,
      },
      {
        id: "investorClass",
        align: "center",
        header: (
          <span className="deal_inv_th_investor_class_head">
            <span>Investor Class</span>
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
        tdClassName:
          "deal_inv_td_investor_class deal_inv_td_investor_class_cell deal_inv_td_investor_class_center",
        sortValue: (row) => {
          const a = (row.investorClass ?? "").trim()
          if (a) return a.toLowerCase()
          return dealAllClassNamesLine.toLowerCase()
        },
        cell: (row) => {
          const assignedRaw = (row.investorClass ?? "").trim()
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
        id: "status",
        header: "Status",
        sortValue: (row) =>
          dealInvestorStatusDisplayLabel(row).toLowerCase(),
        tdClassName: "deal_inv_td_ellipsis",
        cell: (row) => (
          <DealInvEllipsisText text={dealInvestorStatusDisplayLabel(row)} />
        ),
      },
      {
        id: "added_by",
        header: "Added by",
        sortValue: (row) =>
          String(row.addedByDisplayName ?? "").toLowerCase(),
        tdClassName: "deal_inv_td_ellipsis",
        cell: (row) => {
          const s = String(row.addedByDisplayName ?? "").trim()
          const adderId = String(row.addedByUserId ?? "").trim()
          const title =
            adderId && s && s !== "—"
              ? `${s} (${adderId})`
              : adderId
                ? adderId
                : undefined
          return (
            <DealInvEllipsisText
              text={s && s !== "—" ? s : "—"}
              title={title}
            />
          )
        },
      },
      {
        id: "committed",
        header: "Committed",
        align: "right",
        thClassName: "deals_th_align_right",
        sortValue: (row) => displayInvestorCommittedAmount(row),
        tdClassName: "deal_inv_td_ellipsis deal_inv_td_committed um_td_numeric",
        cell: (row) => <DealInvestorCommittedAmountCell row={row} />,
      },
      {
        id: "signed",
        header: "Signed",
        sortValue: (row) => row.signedDate ?? "",
        tdClassName: "deal_inv_td_ellipsis",
        cell: (row) => <DealInvEllipsisText text={row.signedDate ?? "—"} />,
      },
      {
        id: "funded",
        header: "Funded",
        sortValue: (row) => (investorRowIsFundApproved(row) ? "1" : "0"),
        tdClassName: "deal_inv_td_ellipsis",
        cell: (row) => (
          <DealInvEllipsisText text={investorFundedColumnLabel(row)} />
        ),
      },
      {
        id: "selfAcc",
        header: "Self Acc",
        sortValue: (row) => row.selfAccredited ?? "",
        tdClassName: "deal_inv_td_ellipsis",
        cell: (row) => <DealInvEllipsisText text={row.selfAccredited ?? "—"} />,
      },
      {
        id: "verifiedAcc",
        header: "Verified Acc",
        sortValue: (row) => row.verifiedAccLabel ?? "",
        tdClassName: "deal_inv_td_ellipsis deal_inv_td_verified",
        cell: (row) => (
          <VerifiedAccBadge label={row.verifiedAccLabel ?? "—"} />
        ),
      },
      {
        id: "mailStatus",
        header: "Mail status",
        sortValue: (row) =>
          row.id === ADD_MEMBER_DRAFT_ROW_ID
            ? -1
            : row.invitationMailSent === true
              ? 1
              : 0,
        tdClassName: "deal_inv_td_mail_status",
        cell: (row) => <InviteMailStatusBadge row={row} />,
      },
      {
        id: "actions",
        header: "Actions",
        align: "center",
        thClassName: "um_th_actions",
        tdClassName: "um_td_actions deal_inv_td_actions",
        cell: (row) => (
          <div className="deal_members_actions_cell">
            <DealMemberRowActions
              row={row}
              draftRow={row.id === ADD_MEMBER_DRAFT_ROW_ID}
              invitationMailSent={row.invitationMailSent === true}
              offeringLinkAvailable={offeringLinkAvailable}
              onEdit={(r) => {
                if (r.id === ADD_MEMBER_DRAFT_ROW_ID) {
                  if (onContinueDraftEdit) onContinueDraftEdit()
                  else onAddInvestor()
                  return
                }
                onEditInvestor(r)
              }}
              onCopyLink={(r) => onCopyOfferingLink?.(r)}
              onSendInvite={(r) => {
                void onSendInvitationMail?.(r)
              }}
              onApproveFund={handleApproveFund}
              approveFundDisabled={
                approveFundBusyId === row.id ||
                !investorRowSupportsApproveFund(row) ||
                investorRowApproveFundNotApplicable(row) ||
                investorRowCommittedAmountIsZero(row)
              }
              approveFundDisabledTitle={
                approveFundBusyId === row.id
                  ? "Approving…"
                  : !investorRowSupportsApproveFund(row)
                    ? "Available only for investors with an investment record"
                    : investorRowApproveFundNotApplicable(row)
                      ? "Already past this step or closed"
                      : investorRowCommittedAmountIsZero(row)
                        ? "Committed amount must be greater than $0"
                        : undefined
              }
              onDelete={(r) => {
                void onDeleteMember?.(r)
              }}
            />
          </div>
        ),
      },
    ],
    [
      dealAllClassNamesLine,
      investorClasses.length,
      onEditInvestor,
      onAddInvestor,
      onContinueDraftEdit,
      onSendInvitationMail,
      onCopyOfferingLink,
      onDeleteMember,
      offeringLinkAvailable,
      handleApproveFund,
      approveFundBusyId,
    ],
  )

  function handleExportInvestors(selected: DealInvestorRow[]) {
    const csv = buildDealInvestorsExportCsv(selected, dealAllClassNamesLine)
    const stamp = new Date().toISOString().slice(0, 10)
    const safeDeal = dealId.replace(/[^\w-]+/g, "_").slice(0, 36)
    downloadDealExportCsv(csv, `deal-investors-${safeDeal}-${stamp}.csv`)
    void notifyDealInvestorsExportAudit(dealId, {
      rowCount: selected.length,
      exportedLines: exportAuditLinesForDealInvestorRows(selected),
    })
  }

  const kpiMetricCards = useMemo(
    () =>
      (
        [
          {
            icon: CircleDollarSign,
            title: "Offering Size",
            description: kpis.offeringSize,
          },
          { icon: DollarSign, title: "Committed", description: kpis.committed },
          {
            icon: FileCheck,
            title: "Document signed",
            description: documentSignedKpi,
          },
          {
            icon: BadgeCheck,
            title: "Approved",
            description: kpis.approvedCount,
          },
          {
            icon: Landmark,
            title: "Total Funded",
            description: kpis.totalFunded,
          },
          { icon: PiggyBank, title: "Remaining", description: kpis.remaining },
        ] as const
      ).map((item) => (
        <ToolStyleCard
          key={item.title}
          variant="metric"
          icon={item.icon}
          title={item.title}
          description={item.description}
        />
      )),
    [kpis, documentSignedKpi],
  )

  return (
    <div className="deal_inv_populated deal_members_tab">
      <section
        className="sponsor_dash_metrics deal_inv_kpi_metrics"
        aria-label="Deal investment summary"
      >
        {kpiMetricCards}
      </section>

      <div className="um_header_row deal_inv_investors_cta_row">
        <button
          type="button"
          className="deals_list_add_btn"
          onClick={onAddInvestor}
        >
          <Plus size={18} strokeWidth={2} aria-hidden />
          Add Investor
        </button>
      </div>

      <div className="deal_inv_controls">
        {/* Share with lead sponsor + Send email (deferred)
        <div className="deal_inv_toolbar">
          <div className="deal_inv_toolbar_leading">
            <button
              type="button"
              className="um_btn_toolbar deal_inv_toolbar_share_btn"
            >
              Share Investor Details with Lead Sponsor
            </button>
          </div>
          <div
            className="deal_inv_toolbar_actions"
            role="toolbar"
            aria-label="Investor list actions"
          >
            <button type="button" className="um_btn_toolbar" disabled>
              <Mail size={16} strokeWidth={2} aria-hidden />
              Send email
            </button>
          </div>
        </div>
        */}

        <section
          className="deal_inv_filters_section"
          aria-labelledby="deal-inv-filters-heading"
        >
          <h3 id="deal-inv-filters-heading" className="deal_inv_filters_heading">
            Filters
          </h3>
          <div
            className="deal_inv_filters_grid"
            role="group"
            aria-label="Investor list filters"
          >
            <div className="deal_inv_filter_field">
              <label
                className="deal_inv_filter_label"
                htmlFor={`deal-inv-filter-class-${dealId}`}
              >
                <Tag size={14} strokeWidth={2} aria-hidden />
                Investor class
              </label>
              <select
                id={`deal-inv-filter-class-${dealId}`}
                className="deal_inv_filter_select"
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
              >
                <option value="">All classes</option>
                {classOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="deal_inv_filter_field">
              <label
                className="deal_inv_filter_label"
                htmlFor={`deal-inv-filter-status-${dealId}`}
              >
                <Activity size={14} strokeWidth={2} aria-hidden />
                Investment status
              </label>
              <select
                id={`deal-inv-filter-status-${dealId}`}
                className="deal_inv_filter_select"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">All statuses</option>
                {statusOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="deal_inv_filter_field">
              <label
                className="deal_inv_filter_label"
                htmlFor={`deal-inv-filter-esign-${dealId}`}
              >
                <BadgeCheck size={14} strokeWidth={2} aria-hidden />
                eSign status
              </label>
              <select
                id={`deal-inv-filter-esign-${dealId}`}
                className="deal_inv_filter_select"
                value={filterEsign}
                onChange={(e) => setFilterEsign(e.target.value)}
              >
                <option value="">All</option>
                <option value="not_started">Not started</option>
                <option value="complete">Complete</option>
              </select>
            </div>
            <div className="deal_inv_filter_field">
              <label
                className="deal_inv_filter_label"
                htmlFor={`deal-inv-filter-funding-${dealId}`}
              >
                <Landmark size={14} strokeWidth={2} aria-hidden />
                Funded
              </label>
              <select
                id={`deal-inv-filter-funding-${dealId}`}
                className="deal_inv_filter_select"
                value={filterFunding}
                onChange={(e) => setFilterFunding(e.target.value)}
                aria-label="Filter by funded status"
              >
                <option value="">All</option>
                <option value="funded">Approved</option>
                <option value="pending">Not Approved</option>
              </select>
            </div>
            <div className="deal_inv_filter_field">
              <label
                className="deal_inv_filter_label"
                htmlFor={`deal-inv-filter-accred-${dealId}`}
              >
                <UserRound size={14} strokeWidth={2} aria-hidden />
                Accreditation
              </label>
              <select
                id={`deal-inv-filter-accred-${dealId}`}
                className="deal_inv_filter_select"
                value={filterAccreditation}
                onChange={(e) => setFilterAccreditation(e.target.value)}
              >
                <option value="">All</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
          </div>
        </section>
      </div>

      <ExportDealInvestorRowsModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        title="Export deal investors"
        hint="Search and select investors, then export to Excel (CSV format)."
        searchPlaceholder="Search investors…"
        searchAriaLabel="Search investors in export list"
        listAriaLabel="Deal investors to export"
        rows={exportModalRows}
        onExportExcel={handleExportInvestors}
      />

      <div className="um_panel um_members_tab_panel deal_inv_table_panel">
        <div className="um_toolbar deal_inv_table_um_toolbar">
          <div className="um_search_wrap">
            <Search className="um_search_icon" size={18} aria-hidden />
            <input
              type="search"
              className="um_search_input"
              placeholder="Search investors…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search investors"
            />
          </div>
          <div className="um_toolbar_actions deal_inv_table_toolbar_actions">
            <button
              type="button"
              className="um_toolbar_export_btn"
              onClick={() => setExportModalOpen(true)}
            >
              <Download size={18} strokeWidth={2} aria-hidden />
              <span>Export all investors</span>
            </button>
          </div>
        </div>

        <DataTable
          visualVariant="members"
          membersTableClassName="um_table_members deal_inv_table"
          columns={columns}
          rows={filtered}
          getRowKey={(row, i) => row.id || `inv-${dealId}-${i}`}
          getRowClassName={(row) =>
            investorRowShowsDraftBadge(row) ? "deal_inv_row_draft" : undefined
          }
          emptyLabel="No LP investors match your filters."
          pagination={pagination}
        />
      </div>
    </div>
  )
}

export const DealInvestorsTab = forwardRef<
  DealInvestorsTabHandle,
  DealInvestorsTabProps
>(function DealInvestorsTab(
  {
    dealId,
    dealName,
    dealDetail,
    addInvestmentOpen,
    modalOnly = false,
    onAddInvestmentClose,
    onOpenFullInvestmentModal,
    addInvestmentEntry = "member",
    restoreAddMemberSessionDraft = true,
    onInvestorsChanged,
    onSendInvitationMail,
    onCopyOfferingLink,
    onDeleteMember,
    onSharedInvestmentModalOpenChange,
    offeringLinkAvailable = false,
    investorsListRefreshKey = 0,
    invitationMailStatusByRowId,
  },
  ref,
) {
  const [addLpInvestorOpen, setAddLpInvestorOpen] = useState(false)
  /** “Continue editing” on draft row: prefill AddLpInvestorModal from session add-member draft. */
  const [lpResumeAddMemberDraft, setLpResumeAddMemberDraft] = useState(false)
  const [payload, setPayload] = useState<DealInvestorsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [localAddedInvestors, setLocalAddedInvestors] = useState<
    DealInvestorRow[]
  >([])
  const [investorClasses, setInvestorClasses] = useState<DealInvestorClass[]>([])
  const [editRow, setEditRow] = useState<DealInvestorRow | null>(null)
  const [editLpRow, setEditLpRow] = useState<DealInvestorRow | null>(null)
  const [viewInvestorRow, setViewInvestorRow] = useState<DealInvestorRow | null>(
    null,
  )
  const [addMemberDraftTick, setAddMemberDraftTick] = useState(0)

  useEffect(() => {
    function onDraftUpdated() {
      setAddMemberDraftTick((t) => t + 1)
    }
    window.addEventListener(ADD_MEMBER_DRAFT_UPDATED_EVENT, onDraftUpdated)
    return () =>
      window.removeEventListener(ADD_MEMBER_DRAFT_UPDATED_EVENT, onDraftUpdated)
  }, [])

  const editFormInitialValues = useMemo(
    () => (editRow ? dealInvestorRowToFormValues(editRow) : null),
    [editRow],
  )

  const dealClassNamesLineForView = useMemo(
    () => buildDealClassNamesLine(investorClasses, dealDetail),
    [investorClasses, dealDetail],
  )

  const handleEditInvestor = useCallback(
    (row: DealInvestorRow) => {
      setViewInvestorRow(null)
      setLpResumeAddMemberDraft(false)
      /** Dismiss “Add investment” so `addInvestmentOpen` is false; otherwise the effect
       * below clears `editRow` while the modal stays in add mode and session draft POSTs again. */
      onAddInvestmentClose()
      if (shouldUseLpInvestorsModalForEdit(row)) {
        setEditRow(null)
        setEditLpRow(row)
        return
      }
      setEditLpRow(null)
      setEditRow(row)
    },
    [onAddInvestmentClose],
  )

  const handleContinueDraftInvestor = useCallback(() => {
    const draft = loadAddMemberDraft(dealId)
    if (draft && isLpInvestorRole(draft.form.investorRole ?? "")) {
      setLpResumeAddMemberDraft(true)
      setAddLpInvestorOpen(true)
      return
    }
    onOpenFullInvestmentModal?.()
  }, [dealId, onOpenFullInvestmentModal])

  useImperativeHandle(
    ref,
    () => ({
      openViewInvestor: (row: DealInvestorRow) => {
        setViewInvestorRow(row)
      },
      openEditInvestor: (row: DealInvestorRow) => {
        setViewInvestorRow(null)
        setLpResumeAddMemberDraft(false)
        onAddInvestmentClose()
        if (shouldUseLpInvestorsModalForEdit(row)) {
          setEditRow(null)
          setEditLpRow(row)
          return
        }
        setEditLpRow(null)
        setEditRow(row)
      },
      refetchInvestors: async () => {
        const data = await fetchDealInvestors(dealId, { lpInvestorsOnly: true })
        setPayload(data)
      },
    }),
    [dealId, onAddInvestmentClose],
  )

  useEffect(() => {
    if (addInvestmentOpen) {
      setEditRow(null)
      setEditLpRow(null)
    }
  }, [addInvestmentOpen])

  useLayoutEffect(() => {
    onSharedInvestmentModalOpenChange?.(
      Boolean(
        addInvestmentOpen ||
          editRow !== null ||
          editLpRow !== null ||
          addLpInvestorOpen,
      ),
    )
  }, [
    addInvestmentOpen,
    editRow,
    editLpRow,
    addLpInvestorOpen,
    onSharedInvestmentModalOpenChange,
  ])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      const data = await fetchDealInvestors(dealId, { lpInvestorsOnly: true })
      if (!cancelled) {
        setPayload(data)
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [dealId, investorsListRefreshKey])

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
    setLocalAddedInvestors([])
  }, [dealId])

  const sessionDraftRow = useMemo((): DealInvestorRow | null => {
    void addMemberDraftTick
    return buildAddMemberDraftInvestorRow(dealId, investorClasses)
  }, [dealId, investorClasses, addMemberDraftTick])

  const mergedInvestors = useMemo(() => {
    const combined = [...(payload?.investors ?? []), ...localAddedInvestors]
    const lpOnly = combined.filter((r) => isLpInvestorsTabRow(r))
    const draftRedundantWithApi = isAddMemberSessionDraftRedundantWithApiRows(
      dealId,
      combined,
    )
    const showDraft =
      sessionDraftRow &&
      !draftRedundantWithApi &&
      !editRow &&
      !editLpRow &&
      !addInvestmentOpen &&
      !addLpInvestorOpen &&
      isLpInvestorsTabRow(sessionDraftRow)
    if (showDraft) return [...lpOnly, sessionDraftRow]
    return lpOnly
  }, [
    dealId,
    payload,
    localAddedInvestors,
    sessionDraftRow,
    editRow,
    editLpRow,
    addInvestmentOpen,
    addLpInvestorOpen,
  ])

  const mergedPayload = useMemo((): DealInvestorsPayload | null => {
    if (!payload) return null
    const o = invitationMailStatusByRowId
    if (!o || Object.keys(o).length === 0) {
      return { ...payload, investors: mergedInvestors }
    }
    return {
      ...payload,
      investors: mergedInvestors.map((r) => {
        if (!o[r.id]) return r
        if (r.invitationMailSent === true) return r
        return { ...r, invitationMailSent: true }
      }),
    }
  }, [payload, mergedInvestors, invitationMailStatusByRowId])

  async function handleSaveAddInvestment(
    values: AddInvestmentFormValues,
    subscriptionDocument: File | null,
  ) {
    const draftMeta = loadAddMemberDraft(dealId)
    const autosavedLpId = draftMeta?.backendLpInvestorId?.trim()
    const autosavedInvId = draftMeta?.backendInvestmentId?.trim()
    const result = isLpInvestorRole(values.investorRole)
      ? autosavedLpId
        ? await putDealLpInvestor(dealId, autosavedLpId, values)
        : await postDealLpInvestor(dealId, values)
      : autosavedInvId
        ? await putDealInvestment(
            dealId,
            autosavedInvId,
            values,
            subscriptionDocument,
          )
        : await postDealInvestment(dealId, values, subscriptionDocument)
    if (!result.ok) throw new Error(result.message)
    upsertRuntimeFromViewerAddInvestmentForm({
      dealId,
      values,
      dealDetail: dealDetail ?? null,
    })
    const valuesForDisplay: AddInvestmentFormValues = {
      ...values,
      investorClass: resolveInvestorClassLabelForRow(
        values.investorClass,
        investorClasses,
      ),
    }
    if (result.mode === "client") {
      setLocalAddedInvestors((prev) => [
        ...prev,
        addInvestmentFormToRow(valuesForDisplay, dealId),
      ])
    } else {
      setLocalAddedInvestors([])
      const data = await fetchDealInvestors(dealId, { lpInvestorsOnly: true })
      setPayload(data)
      const full = await fetchDealInvestors(dealId, { lpInvestorsOnly: false })
      upsertRuntimeForViewerFromInvestorsPayload(
        dealId,
        full,
        dealDetail ?? null,
      )
    }
    onAddInvestmentClose()
    onInvestorsChanged?.()
  }

  function handleCloseInvestmentModal() {
    setEditRow(null)
    setEditLpRow(null)
    onAddInvestmentClose()
  }

  async function handleSaveInvestmentModal(
    values: AddInvestmentFormValues,
    subscriptionDocument: File | null,
  ) {
    if (editRow) {
      const result =
        editRow.investorKind === "lp_roster"
          ? await putDealLpInvestor(dealId, editRow.id, values)
          : await putDealInvestment(
              dealId,
              editRow.id,
              values,
              subscriptionDocument,
            )
      if (!result.ok) throw new Error(result.message)
      /** Stale add-member session draft would still append a draft row — same person appears twice. */
      clearAddMemberDraft(dealId)
      upsertRuntimeFromViewerAddInvestmentForm({
        dealId,
        values,
        dealDetail: dealDetail ?? null,
      })
      if (result.mode === "client") {
        setPayload((prev) => {
          if (!prev) return prev
          const valuesForDisplay: AddInvestmentFormValues = {
            ...values,
            investorClass: resolveInvestorClassLabelForRow(
              values.investorClass,
              investorClasses,
            ),
          }
          const merged: DealInvestorRow = {
            ...addInvestmentFormToRow(valuesForDisplay, dealId),
            id: editRow.id,
          }
          return {
            ...prev,
            investors: prev.investors.map((r) =>
              r.id === editRow.id ? merged : r,
            ),
          }
        })
        setEditRow(null)
        onAddInvestmentClose()
        onInvestorsChanged?.()
        return
      }
      setEditRow(null)
      onAddInvestmentClose()
      const data = await fetchDealInvestors(dealId, { lpInvestorsOnly: true })
      setPayload(data)
      const full = await fetchDealInvestors(dealId, { lpInvestorsOnly: false })
      upsertRuntimeForViewerFromInvestorsPayload(
        dealId,
        full,
        dealDetail ?? null,
      )
      onInvestorsChanged?.()
      return
    }
    await handleSaveAddInvestment(values, subscriptionDocument)
  }

  /** Investors table/KPI (`modalOnly` false): always use Add/Edit Investor chrome. Deal Members tab (`modalOnly` true) follows parent `addInvestmentEntry` for Add/Edit Member vs shared flows. */
  const addEntryForModal = modalOnly ? addInvestmentEntry : "investor"

  const refreshInvestorsFromApi = useCallback(async () => {
    const data = await fetchDealInvestors(dealId, { lpInvestorsOnly: true })
    setPayload(data)
    const full = await fetchDealInvestors(dealId, { lpInvestorsOnly: false })
    upsertRuntimeForViewerFromInvestorsPayload(
      dealId,
      full,
      dealDetail ?? null,
    )
    onInvestorsChanged?.()
  }, [dealId, dealDetail, onInvestorsChanged])

  const modal = (
    <AddInvestmentModal
      dealId={dealId}
      open={addInvestmentOpen || editRow !== null}
      onClose={handleCloseInvestmentModal}
      onSave={handleSaveInvestmentModal}
      defaultOfferingLabel={dealName}
      mode={editRow ? "edit" : "add"}
      initialValues={editFormInitialValues}
      prefillKey={
        editRow?.id ??
        (restoreAddMemberSessionDraft ? "add-restore-draft" : "add-fresh")
      }
      addEntry={addEntryForModal}
      restoreAddMemberSessionDraft={restoreAddMemberSessionDraft}
      onBackendAutosave={async (detail) => {
        const data = await fetchDealInvestors(dealId, {
          lpInvestorsOnly: true,
        })
        setPayload(data)
        const full = await fetchDealInvestors(dealId, { lpInvestorsOnly: false })
        upsertRuntimeForViewerFromInvestorsPayload(
          dealId,
          full,
          dealDetail ?? null,
        )
        if (detail?.createdInvestment) onInvestorsChanged?.()
      }}
      dealBlocksInvitationEmails={
        dealDetail != null &&
        (String(dealDetail.dealStage ?? "").trim().toLowerCase() ===
          "draft" ||
          isDealDetailFormIncomplete(dealDetail))
      }
    />
  )

  const lpBlocksInvites =
    dealDetail != null &&
    (String(dealDetail.dealStage ?? "").trim().toLowerCase() === "draft" ||
      isDealDetailFormIncomplete(dealDetail))

  const lpInvestorModal = (
    <AddLpInvestorModal
      dealId={dealId}
      open={addLpInvestorOpen || editLpRow !== null}
      mode={editLpRow ? "edit" : "add"}
      editRow={editLpRow}
      resumeAddMemberDraft={lpResumeAddMemberDraft}
      dealBlocksInvitationEmails={lpBlocksInvites}
      onClose={() => {
        setAddLpInvestorOpen(false)
        setEditLpRow(null)
        setLpResumeAddMemberDraft(false)
      }}
      onSaved={async () => {
        setLocalAddedInvestors([])
        setEditLpRow(null)
        const data = await fetchDealInvestors(dealId, { lpInvestorsOnly: true })
        setPayload(data)
        const full = await fetchDealInvestors(dealId, { lpInvestorsOnly: false })
        upsertRuntimeForViewerFromInvestorsPayload(
          dealId,
          full,
          dealDetail ?? null,
        )
        onInvestorsChanged?.()
      }}
    />
  )

  if (modalOnly)
    return (
      <>
        {modal}
        {lpInvestorModal}
        <DealInvestorViewModal
          row={viewInvestorRow}
          onClose={() => setViewInvestorRow(null)}
          investorClasses={investorClasses}
          dealAllClassNamesLine={dealClassNamesLineForView}
          onEdit={handleEditInvestor}
        />
      </>
    )

  if (loading)
    return (
      <>
        {modal}
        {lpInvestorModal}
        <p className="deals_list_not_found" role="status">
          Loading investors…
        </p>
      </>
    )

  if (!mergedPayload) return null

  return (
    <>
      {modal}
      {lpInvestorModal}
      <DealInvestorsPopulated
        initialPayload={mergedPayload}
        dealId={dealId}
        dealDetail={dealDetail}
        investorClasses={investorClasses}
        onEditInvestor={handleEditInvestor}
        onAddInvestor={() => {
          setEditLpRow(null)
          setLpResumeAddMemberDraft(false)
          setAddLpInvestorOpen(true)
        }}
        onContinueDraftEdit={handleContinueDraftInvestor}
        onSendInvitationMail={onSendInvitationMail}
        onCopyOfferingLink={onCopyOfferingLink}
        onDeleteMember={onDeleteMember}
        offeringLinkAvailable={offeringLinkAvailable}
        onRefreshInvestors={refreshInvestorsFromApi}
      />
      <DealInvestorViewModal
        row={viewInvestorRow}
        onClose={() => setViewInvestorRow(null)}
        investorClasses={investorClasses}
        dealAllClassNamesLine={dealClassNamesLineForView}
        onEdit={handleEditInvestor}
      />
    </>
  )
})
