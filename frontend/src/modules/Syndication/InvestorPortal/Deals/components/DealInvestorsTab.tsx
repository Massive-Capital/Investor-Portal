import {
  Activity,
  BadgeCheck,
  Calculator,
  CircleDollarSign,
  Clock,
  DollarSign,
  Download,
  Landmark,
  ListOrdered,
  PiggyBank,
  Search,
  Tag,
  UserRound,
  Users,
  UserX,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AddInvestmentModal } from "./AddInvestmentModal"
import { InvestorClassPillsDisplay } from "./InvestorClassPillsDisplay"
import { DealInvestorRowActions } from "./DealInvestorRowActions"
import { DealInvestorViewModal } from "./DealInvestorViewModal"
import type { AddInvestmentFormValues } from "../types/add-investment.types"
import { formatDateDdMmmYyyy } from "../../../../../common/utils/formatDateDisplay"
import {
  formatMoneyFieldDisplay,
  parseMoneyDigits,
} from "../utils/offeringMoneyFormat"
import {
  DataTable,
  type DataTableColumn,
} from "../../../../../common/components/data-table/DataTable"
import { FormTooltip } from "../../../../../common/components/form-tooltip/FormTooltip"
import { ToolStyleCard } from "../../../../../common/components/tool-style-card/ToolStyleCard"
import {
  fetchDealInvestorClasses,
  fetchDealInvestors,
  postDealInvestment,
  putDealInvestment,
  type DealDetailApi,
} from "../api/dealsApi"
import type { DealInvestorClass } from "../types/deal-investor-class.types"
import {
  investorProfileIdFromLabel,
  investorProfileLabel,
  investorRoleLabel,
  investorRoleSelectValueFromStored,
} from "../constants/investor-profile"
import { formatMemberUsername } from "../../../../usermanagement/memberAdminShared"
import type {
  DealInvestorRow,
  DealInvestorsKpis,
  DealInvestorsPayload,
} from "../types/deal-investors.types"
import "../../../../usermanagement/user_management.css"
import "../../Dashboard/sponsor-dashboard.css"
import "../deals-list.css"
import "../deal-investors-tab.css"

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

interface DealInvestorsTabProps {
  dealId: string
  dealName: string
  /** When set, KPI cards can show offering size from deal / investor classes if API KPIs are empty. */
  dealDetail?: DealDetailApi | null
  addInvestmentOpen: boolean
  onAddInvestmentClose: () => void
  onOpenAddInvestment: () => void
}

function memberNameFromContactId(id: string): string {
  const m: Record<string, string> = {
    rebecca_duffy: "Rebecca Duffy",
    nigam_family: "Nigam Family LLC",
    j_smith: "J. Smith",
  }
  return m[id] || id || "—"
}

function userFromContactId(contactId: string): {
  userDisplayName: string
  userEmail: string
} {
  const m: Record<string, { userDisplayName: string; userEmail: string }> = {
    rebecca_duffy: {
      userDisplayName: "rduffy",
      userEmail: "rebecca.duffy@example.com",
    },
    nigam_family: {
      userDisplayName: "anigam",
      userEmail: "contact@nigamfamily.com",
    },
    j_smith: {
      userDisplayName: "jsmith",
      userEmail: "j.smith@example.com",
    },
  }
  return m[contactId] ?? { userDisplayName: "—", userEmail: "—" }
}

function initialsFromUserRow(
  userDisplayName: string,
  memberDisplayName: string,
): string {
  const src =
    userDisplayName.trim() && userDisplayName !== "—"
      ? userDisplayName
      : memberDisplayName
  const t = src.trim()
  if (!t || t === "—") return "?"
  const parts = t.split(/[\s@._-]+/).filter(Boolean)
  if (parts.length >= 2)
    return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2)
  return t.slice(0, 2).toUpperCase()
}

function formatSignedDateDisplay(iso: string): string {
  return formatDateDdMmmYyyy(iso)
}

function formatCommittedFromForm(v: AddInvestmentFormValues): string {
  const raw = [v.commitmentAmount, ...v.extraContributionAmounts]
  const nums = raw
    .map((s) => parseFloat(String(s).replace(/[^0-9.-]/g, "")))
    .filter((n) => Number.isFinite(n))
  if (nums.length === 0) return v.commitmentAmount.trim() || "—"
  const sum = nums.reduce((a, b) => a + b, 0)
  if (sum === 0) return "—"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(sum)
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
  }
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

function addInvestmentFormToRow(
  v: AddInvestmentFormValues,
  dealId: string,
): DealInvestorRow {
  const fallback = userFromContactId(v.contactId)
  const displayName =
    v.contactDisplayName?.trim() || memberNameFromContactId(v.contactId)
  const userEmail = v.contactEmail?.trim() || fallback.userEmail
  const userDisplayName =
    v.contactUsername !== undefined
      ? formatMemberUsername(v.contactUsername)
      : fallback.userDisplayName
  return {
    id: `inv-${dealId}-${Date.now()}`,
    displayName,
    entitySubtitle: investorProfileLabel(v.profileId),
    userDisplayName,
    userEmail,
    investorClass: v.investorClass || "—",
    investorRole: investorRoleLabel(v.investorRole),
    status: v.status || "—",
    committed: formatCommittedFromForm(v),
    signedDate: formatSignedDateDisplay(v.docSignedDate),
    fundedDate: "—",
    selfAccredited: "—",
    verifiedAccLabel: "Not Started",
  }
}

function DealInvestorsEmpty({ onInvite }: { onInvite: () => void }) {
  return (
    <div className="um_panel deal_inv_empty_panel">
      <div className="deal_inv_empty_state">
        <p className="deal_inv_empty_title">
          Investments Will Be Listed Here
        </p>
        <button
          type="button"
          className="deals_list_add_btn deal_inv_empty_cta"
          onClick={onInvite}
        >
          Invite Contacts
        </button>
      </div>
    </div>
  )
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
}: {
  text: string
  alignEnd?: boolean
  className?: string
}) {
  const display = String(text ?? "").trim() || "—"
  const hint = display !== "—" ? display : undefined
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
 * Offering Size KPI: sum of all investor-class offering sizes (Offering Information),
 * then deal `offeringSize` / list `raiseTarget`, then API KPIs.
 */
function resolveOfferingSizeKpi(
  base: DealInvestorsKpis,
  dealDetail: DealDetailApi | null | undefined,
  investorClasses: DealInvestorClass[],
): string {
  let sumFromClasses = 0
  let hasAnyClassAmount = false
  for (const c of investorClasses) {
    const n = parseMoneyDigits(String(c.offeringSize ?? ""))
    if (Number.isFinite(n)) {
      hasAnyClassAmount = true
      sumFromClasses += n
    }
  }
  if (hasAnyClassAmount)
    return formatMoneyFieldDisplay(String(sumFromClasses))

  if (dealDetail?.offeringSize?.trim())
    return formatMoneyFieldDisplay(dealDetail.offeringSize)

  const raise = dealDetail?.listRow?.raiseTarget?.trim()
  if (raise && raise !== "—") return formatMoneyFieldDisplay(raise)

  const apiOs = base.offeringSize?.trim()
  if (apiOs && apiOs !== "—") return formatMoneyFieldDisplay(apiOs)

  return "—"
}

function DealInvestorsPopulated({
  initialPayload,
  dealId,
  dealDetail,
  investorClasses,
  onEditInvestor,
  onViewInvestor,
}: {
  initialPayload: DealInvestorsPayload
  dealId: string
  dealDetail?: DealDetailApi | null
  investorClasses: DealInvestorClass[]
  onEditInvestor: (row: DealInvestorRow) => void
  onViewInvestor: (row: DealInvestorRow) => void
}) {
  const [query, setQuery] = useState("")
  const [rows, setRows] = useState<DealInvestorRow[]>(initialPayload.investors)
  const kpis = useMemo((): DealInvestorsKpis => {
    const base = initialPayload.kpis
    const sum = rows.reduce(
      (acc, r) => acc + parseCommittedCellToNumber(r.committed),
      0,
    )
    const count = rows.length
    const avg = count > 0 && sum > 0 ? sum / count : 0
    return {
      ...base,
      offeringSize: resolveOfferingSizeKpi(
        base,
        dealDetail,
        investorClasses,
      ),
      committed: formatUsdKpiDisplay(sum),
      totalApproved: formatUsdKpiDisplay(sum),
      approvedCount: String(count),
      averageApproved:
        count > 0 && sum > 0 ? formatUsdKpiDisplay(avg) : "—",
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
        const haystack =
          `${r.displayName} ${r.entitySubtitle} ${r.userDisplayName} ${r.userEmail}`.toLowerCase()
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
        if (!r.fundedDate?.trim() || r.fundedDate === "—") return false
      }
      if (filterFunding === "pending") {
        if (r.fundedDate && r.fundedDate !== "—") return false
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

  const columns: DataTableColumn<DealInvestorRow>[] = useMemo(
    () => [
      {
        id: "member",
        header: "Member",
        sortValue: (row) =>
          `${row.displayName} ${row.entitySubtitle} ${formatMemberUsername(row.userDisplayName)} ${row.userEmail}`.toLowerCase(),
        tdClassName: "deal_inv_td_member",
        cell: (row) => {
          const initials = initialsFromUserRow(
            row.userDisplayName,
            row.displayName,
          )
          const line1 = String(row.displayName ?? "").trim() || "—"
          const profileName = String(row.entitySubtitle ?? "").trim() || "—"
          return (
            <div className="deal_inv_identity_cell">
              <div className="deal_inv_identity_avatar" aria-hidden>
                <span className="deal_inv_identity_initials">{initials}</span>
              </div>
              <div className="deal_inv_identity_text">
                <span
                  className="deal_inv_identity_line1 deal_inv_identity_ellipsis"
                  title={line1 !== "—" ? line1 : undefined}
                >
                  {line1}
                </span>
                <span
                  className="deal_inv_identity_line2 deal_inv_identity_ellipsis"
                  title={profileName !== "—" ? profileName : undefined}
                >
                  {profileName}
                </span>
              </div>
            </div>
          )
        },
      },
      {
        id: "role",
        header: "Role",
        sortValue: (row) => (row.investorRole ?? "").trim().toLowerCase(),
        tdClassName: "deal_inv_td_role deal_inv_td_ellipsis",
        cell: (row) => (
          <DealInvEllipsisText text={investorRoleLabel(row.investorRole ?? "")} />
        ),
      },
      {
        id: "investorClass",
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
              />
            ) : null}
          </span>
        ),
        tdClassName: "deal_inv_td_investor_class deal_inv_td_investor_class_cell",
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
        sortValue: (row) => row.status ?? "",
        tdClassName: "deal_inv_td_ellipsis",
        cell: (row) => <DealInvEllipsisText text={row.status ?? "—"} />,
      },
      {
        id: "committed",
        header: "Committed",
        align: "right",
        sortValue: (row) => row.committed ?? "",
        tdClassName: "deal_inv_td_ellipsis deal_inv_td_committed",
        cell: (row) => (
          <DealInvEllipsisText
            text={formatMoneyFieldDisplay(row.committed)}
            alignEnd
          />
        ),
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
        sortValue: (row) => row.fundedDate ?? "",
        tdClassName: "deal_inv_td_ellipsis",
        cell: (row) => <DealInvEllipsisText text={row.fundedDate ?? "—"} />,
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
        id: "actions",
        header: "Action",
        align: "right",
        thClassName: "um_th_actions",
        tdClassName: "um_td_actions deal_inv_td_actions",
        cell: (row) => (
          <DealInvestorRowActions
            investorLabel={row.displayName}
            onViewDetails={() => onViewInvestor(row)}
            onEdit={() => onEditInvestor(row)}
          />
        ),
      },
    ],
    [
      dealAllClassNamesLine,
      investorClasses.length,
      onEditInvestor,
      onViewInvestor,
    ],
  )

  function exportInvestorsCsv() {
    const headers = [
      "Member name",
      "Profile",
      "Role",
      "Investor class",
      "Status",
      "Committed",
      "Signed",
      "Funded",
      "Self accredited",
      "Verified accreditation",
      "Username",
      "Email",
    ]
    const lines = [headers.map(escapeCsvCell).join(",")]
    for (const row of filtered) {
      const invClass =
        (row.investorClass ?? "").trim() ||
        dealAllClassNamesLine.trim() ||
        "—"
      const roleForCsv = investorRoleLabel(row.investorRole ?? "")
      const line = [
        row.displayName,
        row.entitySubtitle,
        roleForCsv,
        invClass,
        row.status,
        formatMoneyFieldDisplay(row.committed),
        row.signedDate,
        row.fundedDate,
        row.selfAccredited,
        row.verifiedAccLabel,
        row.userDisplayName,
        row.userEmail,
      ]
      lines.push(line.map((c) => escapeCsvCell(String(c ?? ""))).join(","))
    }
    const csv = `\ufeff${lines.join("\r\n")}`
    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `deal-investors-${dealId.replace(/[^\w-]+/g, "_").slice(0, 36)}.csv`
    a.click()
    URL.revokeObjectURL(url)
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
          { icon: PiggyBank, title: "Remaining", description: kpis.remaining },
          {
            icon: BadgeCheck,
            title: "Total Approved",
            description: kpis.totalApproved,
          },
          {
            icon: Clock,
            title: "Total Pending",
            description: kpis.totalPending,
          },
          {
            icon: Landmark,
            title: "Total Funded",
            description: kpis.totalFunded,
          },
          {
            icon: Users,
            title: "Approved",
            description: kpis.approvedCount,
          },
          {
            icon: UserRound,
            title: "Pending",
            description: kpis.pendingCount,
          },
          {
            icon: ListOrdered,
            title: "Waitlist",
            description: kpis.waitlistCount,
          },
          {
            icon: Calculator,
            title: "Average Approved",
            description: kpis.averageApproved,
          },
          {
            icon: UserX,
            title: "Non-Accredited",
            description: kpis.nonAccreditedCount,
          },
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
    [kpis],
  )

  return (
    <div className="deal_inv_populated">
      <section
        className="sponsor_dash_metrics deal_inv_kpi_metrics"
        aria-label="Deal investment summary"
      >
        {kpiMetricCards}
      </section>

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
                Funding status
              </label>
              <select
                id={`deal-inv-filter-funding-${dealId}`}
                className="deal_inv_filter_select"
                value={filterFunding}
                onChange={(e) => setFilterFunding(e.target.value)}
              >
                <option value="">All</option>
                <option value="funded">Funded</option>
                <option value="pending">Pending</option>
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
            <label className="deal_inv_rows_per_page">
              <span className="deal_inv_rows_per_page_label">Rows per page</span>
              <select
                className="deal_inv_rows_per_page_select"
                value={String(pageSize)}
                onChange={(e) => setPageSize(Number(e.target.value))}
                aria-label="Rows per page"
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </select>
            </label>
            <button
              type="button"
              className="um_toolbar_export_btn"
              onClick={exportInvestorsCsv}
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
          emptyLabel="No investors match your filters."
          pagination={filtered.length > 0 ? pagination : undefined}
        />
      </div>
    </div>
  )
}

export function DealInvestorsTab({
  dealId,
  dealName,
  dealDetail,
  addInvestmentOpen,
  onAddInvestmentClose,
  onOpenAddInvestment,
}: DealInvestorsTabProps) {
  const [payload, setPayload] = useState<DealInvestorsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [localAddedInvestors, setLocalAddedInvestors] = useState<
    DealInvestorRow[]
  >([])
  const [investorClasses, setInvestorClasses] = useState<DealInvestorClass[]>([])
  const [editRow, setEditRow] = useState<DealInvestorRow | null>(null)
  const [viewInvestorRow, setViewInvestorRow] = useState<DealInvestorRow | null>(
    null,
  )

  const editFormInitialValues = useMemo(
    () => (editRow ? dealInvestorRowToFormValues(editRow) : null),
    [editRow],
  )

  const dealClassNamesLineForView = useMemo(
    () => buildDealClassNamesLine(investorClasses, dealDetail),
    [investorClasses, dealDetail],
  )

  const handleEditInvestor = useCallback((row: DealInvestorRow) => {
    setViewInvestorRow(null)
    setEditRow(row)
  }, [])

  useEffect(() => {
    if (addInvestmentOpen) setEditRow(null)
  }, [addInvestmentOpen])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      const data = await fetchDealInvestors(dealId)
      if (!cancelled) {
        setPayload(data)
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [dealId])

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

  const mergedInvestors = useMemo(() => {
    return [...(payload?.investors ?? []), ...localAddedInvestors]
  }, [payload, localAddedInvestors])

  const mergedPayload = useMemo((): DealInvestorsPayload | null => {
    if (!payload) return null
    return { ...payload, investors: mergedInvestors }
  }, [payload, mergedInvestors])

  async function handleSaveAddInvestment(
    values: AddInvestmentFormValues,
    subscriptionDocument: File | null,
  ) {
    const result = await postDealInvestment(dealId, values, subscriptionDocument)
    if (!result.ok) throw new Error(result.message)
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
    } else if (import.meta.env.VITE_USE_MOCK_DEAL_INVESTORS === "true") {
      setLocalAddedInvestors((prev) => [
        ...prev,
        addInvestmentFormToRow(valuesForDisplay, dealId),
      ])
    } else {
      setLocalAddedInvestors([])
      const data = await fetchDealInvestors(dealId)
      setPayload(data)
    }
    onAddInvestmentClose()
  }

  function handleCloseInvestmentModal() {
    setEditRow(null)
    onAddInvestmentClose()
  }

  async function handleSaveInvestmentModal(
    values: AddInvestmentFormValues,
    subscriptionDocument: File | null,
  ) {
    if (editRow) {
      const result = await putDealInvestment(
        dealId,
        editRow.id,
        values,
        subscriptionDocument,
      )
      if (!result.ok) throw new Error(result.message)
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
        return
      }
      setEditRow(null)
      onAddInvestmentClose()
      const data = await fetchDealInvestors(dealId)
      setPayload(data)
      return
    }
    await handleSaveAddInvestment(values, subscriptionDocument)
  }

  const modal = (
    <AddInvestmentModal
      dealId={dealId}
      open={addInvestmentOpen || editRow !== null}
      onClose={handleCloseInvestmentModal}
      onSave={handleSaveInvestmentModal}
      defaultOfferingLabel={dealName}
      mode={editRow ? "edit" : "add"}
      initialValues={editFormInitialValues}
      prefillKey={editRow?.id ?? "add-investment"}
    />
  )

  if (loading)
    return (
      <>
        {modal}
        <p className="deals_list_not_found" role="status">
          Loading investors…
        </p>
      </>
    )

  if (!mergedPayload) return null

  if (mergedInvestors.length === 0) {
    return (
      <>
        {modal}
        <DealInvestorsEmpty onInvite={onOpenAddInvestment} />
      </>
    )
  }

  return (
    <>
      {modal}
      <DealInvestorsPopulated
        initialPayload={mergedPayload}
        dealId={dealId}
        dealDetail={dealDetail}
        investorClasses={investorClasses}
        onEditInvestor={handleEditInvestor}
        onViewInvestor={setViewInvestorRow}
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
}
