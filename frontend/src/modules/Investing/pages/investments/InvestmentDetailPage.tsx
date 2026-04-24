import { ArrowLeft, Building2, Calendar, Search, UserCircle } from "lucide-react"
import { useCallback, useEffect, useId, useMemo, useState } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import { TabsScrollStrip } from "@/common/components/tabs-scroll-strip/TabsScrollStrip"
import {
  DataTable,
  type DataTableColumn,
} from "@/common/components/data-table/DataTable"
import { setAppDocumentTitle } from "@/common/utils/appDocumentTitle"
import "@/modules/usermanagement/user_management.css"
import "@/modules/Syndication/InvestorPortal/Deals/deals-list.css"
import "@/modules/contacts/contacts.css"
import "@/modules/Investing/pages/profiles/investing-profiles.css"
import { loadInvestmentDetailFromDeal } from "./investmentsListFromDeals"
import {
  getInvestmentDetail,
  mergeServerInvestmentDetailWithLocal,
} from "./investmentsRuntimeData"
import {
  enrichInvestmentListRow,
  fetchUserInvestorProfileNameMap,
} from "./investedAsDisplay"
import type {
  InvestmentBreakdownLine,
  InvestmentDetailRecord,
} from "./investments.types"
import "./investment-detail.css"

function formatInvDetailUsd(n: number): string {
  const abs = Math.abs(n)
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(abs)
  return n < 0 ? `(${formatted})` : formatted
}

type DebtInfoFields = {
  outstandingLoans: string
  debtService: string
  loanType: string
  ioOrAmortizing: string
  maturityDate: string
  lender: string
  interestRatePct: string
}

const PROPERTY_TYPES = [
  "Multifamily",
  "Industrial",
  "Office",
  "Retail",
  "Mixed-use",
  "Other",
] as const

const PROPERTY_STATUSES = [
  "Stabilized",
  "Leased",
  "Renovation",
  "Lease-up",
  "Other",
] as const

const LOAN_TYPES = [
  "Senior mortgage",
  "CMBS",
  "Bridge",
  "Mezzanine",
  "Other",
] as const

const IO_AMORT = ["Interest-only", "Amortizing", "Split"] as const

const PROPERTY_STATUS_STORAGE_KEY = (investmentDetailId: string) =>
  `investing:inv:propertyStatus:${investmentDetailId}`

function coercePropertyStatus(raw: string): (typeof PROPERTY_STATUSES)[number] {
  return (PROPERTY_STATUSES as readonly string[]).includes(raw) ? (raw as (typeof PROPERTY_STATUSES)[number]) : "Other"
}

function readPropertyStatusForDetail(
  id: string,
  serverValue: string,
): (typeof PROPERTY_STATUSES)[number] {
  try {
    const saved = localStorage.getItem(PROPERTY_STATUS_STORAGE_KEY(id))
    if (saved && (PROPERTY_STATUSES as readonly string[]).includes(saved)) {
      return coercePropertyStatus(saved)
    }
  } catch {
    /* localStorage may be blocked */
  }
  return coercePropertyStatus(serverValue)
}

const GENERAL_COMMENTS_STORAGE_KEY = (id: string) =>
  `investing:inv:generalComments:${id}`

function readStoredString(
  id: string,
  key: (i: string) => string,
  serverValue: string,
): string {
  try {
    const s = localStorage.getItem(key(id))
    if (s != null) return s
  } catch {
    /* ignore */
  }
  return serverValue
}

const DEBT_INFO_STORAGE_KEY = (id: string) => `investing:inv:debtInfo:${id}`

function debtFromRecord(d: InvestmentDetailRecord): DebtInfoFields {
  return {
    outstandingLoans: d.outstandingLoans ?? "0",
    debtService: d.debtService ?? "0",
    loanType: (d.loanType || "Other").trim() || "Other",
    ioOrAmortizing: (d.ioOrAmortizing || "Amortizing").trim() || "Amortizing",
    maturityDate: d.maturityDate ?? "—",
    lender: d.lender ?? "—",
    interestRatePct: d.interestRatePct ?? "—",
  }
}

function normalizeDebtFields(v: DebtInfoFields): DebtInfoFields {
  return {
    ...v,
    loanType: (LOAN_TYPES as readonly string[]).includes(v.loanType)
      ? v.loanType
      : "Other",
    ioOrAmortizing: (IO_AMORT as readonly string[]).includes(v.ioOrAmortizing)
      ? v.ioOrAmortizing
      : "Amortizing",
  }
}

function readDebtInfoForDetail(d: InvestmentDetailRecord): DebtInfoFields {
  const base = debtFromRecord(d)
  try {
    const raw = localStorage.getItem(DEBT_INFO_STORAGE_KEY(d.id))
    if (raw) {
      const p = JSON.parse(raw) as Partial<DebtInfoFields>
      return normalizeDebtFields({ ...base, ...p })
    }
  } catch {
    /* ignore */
  }
  return normalizeDebtFields(base)
}

function formatMoneyDigits(raw: string): string {
  const n = Number.parseFloat(String(raw ?? "").replace(/[^0-9.-]/g, ""))
  if (!Number.isFinite(n)) return raw || ""
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

function FieldText({
  label,
  value,
  required,
  readOnly = true,
  onChange,
  multiline,
  inputClassName,
  fieldClassName,
}: {
  label: string
  value: string
  required?: boolean
  readOnly?: boolean
  onChange?: (next: string) => void
  multiline?: boolean
  inputClassName?: string
  fieldClassName?: string
}) {
  const controlClass = `investment_detail_input${
    readOnly ? "" : " investment_detail_input--editable"
  }${inputClassName ? ` ${inputClassName}` : ""}`

  return (
    <div
      className={`investment_detail_field${
        !readOnly ? " investment_detail_field--editable" : ""
      }${fieldClassName ? ` ${fieldClassName}` : ""}`}
    >
      <label className="investment_detail_label">
        {label}
        {required ? (
          <span className="investment_detail_req" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      {multiline ? (
        <textarea
          className={controlClass}
          readOnly={readOnly}
          value={value}
          onChange={readOnly ? undefined : (e) => onChange?.(e.target.value)}
          rows={4}
          aria-required={required}
        />
      ) : (
        <input
          type="text"
          className={controlClass}
          readOnly={readOnly}
          value={value}
          onChange={readOnly ? undefined : (e) => onChange?.(e.target.value)}
          aria-required={required}
        />
      )}
    </div>
  )
}

function FieldCurrency({
  label,
  value,
  readOnly = true,
  onChange,
}: {
  label: string
  value: string
  readOnly?: boolean
  onChange?: (next: string) => void
}) {
  const display = value ? formatMoneyDigits(value) : "—"
  if (readOnly) {
    return (
      <div className="investment_detail_field">
        <label className="investment_detail_label">{label}</label>
        <input
          type="text"
          className="investment_detail_input"
          readOnly
          value={display}
        />
      </div>
    )
  }
  return (
    <div className="investment_detail_field investment_detail_field--editable">
      <label className="investment_detail_label">{label}</label>
      <input
        type="text"
        className="investment_detail_input investment_detail_input--editable"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        inputMode="decimal"
        aria-label={label}
      />
    </div>
  )
}

function FieldPct({
  label,
  value,
  notEditable,
  readOnly = true,
  onChange,
}: {
  label: string
  value: string
  /**
   * When set (e.g. General → Ownership %), the control is read-only and styled as fixed / not user-editable.
   * Other % fields (e.g. Occupancy) are read-only but not necessarily “locked” the same way.
   */
  notEditable?: boolean
  readOnly?: boolean
  onChange?: (next: string) => void
}) {
  const isLocked = Boolean(notEditable)
  const isReadOnly = isLocked || readOnly
  return (
    <div
      className={
        isLocked
          ? "investment_detail_field investment_detail_field--read-only-locked"
          : !isReadOnly
            ? "investment_detail_field investment_detail_field--editable"
            : "investment_detail_field"
      }
    >
      <label className="investment_detail_label">{label}</label>
      <div className="investment_detail_input_wrap">
        <input
          type="text"
          className={
            isReadOnly
              ? "investment_detail_input investment_detail_input--pct"
              : "investment_detail_input investment_detail_input--pct investment_detail_input--editable"
          }
          readOnly={isReadOnly}
          tabIndex={isLocked ? -1 : undefined}
          value={value}
          onChange={isReadOnly ? undefined : (e) => onChange?.(e.target.value)}
          inputMode="decimal"
          aria-readonly={isReadOnly ? true : undefined}
          aria-label={label}
        />
        <span className="investment_detail_suffix" aria-hidden>
          %
        </span>
      </div>
    </div>
  )
}

function FieldDate({
  label,
  value,
  readOnly = true,
  onChange,
}: {
  label: string
  value: string
  readOnly?: boolean
  onChange?: (next: string) => void
}) {
  return (
    <div
      className={
        readOnly
          ? "investment_detail_field"
          : "investment_detail_field investment_detail_field--editable"
      }
    >
      <label className="investment_detail_label">{label}</label>
      <div className="investment_detail_input_wrap">
        <input
          type="text"
          className={
            readOnly
              ? "investment_detail_input"
              : "investment_detail_input investment_detail_input--editable"
          }
          readOnly={readOnly}
          value={value}
          onChange={readOnly ? undefined : (e) => onChange?.(e.target.value)}
          placeholder={readOnly ? undefined : "e.g. 12/31/2030 or description"}
          aria-label={label}
        />
        <Calendar
          className="investment_detail_date_icon"
          size={18}
          strokeWidth={1.75}
          aria-hidden
        />
      </div>
    </div>
  )
}

function FieldSelect({
  label,
  value,
  options,
  /** When `true` (default), the native select is disabled. Use `isLocked={false}` for Property → Status, Debt, etc. */
  isLocked = true,
  onChange,
}: {
  label: string
  value: string
  options: readonly string[]
  isLocked?: boolean
  onChange?: (next: string) => void
}) {
  const selectId = useId()
  const isInteractive = !isLocked
  return (
    <div
      className={
        isLocked
          ? "investment_detail_field"
          : "investment_detail_field investment_detail_field--editable"
      }
    >
      <label className="investment_detail_label" htmlFor={selectId}>
        {label}
      </label>
      <select
        id={selectId}
        className={
          isLocked
            ? "investment_detail_select"
            : "investment_detail_select investment_detail_select--editable"
        }
        disabled={!isInteractive}
        value={value}
        onChange={
          isInteractive
            ? (e) => onChange?.(e.target.value)
            : undefined
        }
        aria-label={label}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  )
}

function DetailForm({ d }: { d: InvestmentDetailRecord }) {
  const list = d.list
  const investedDisplay = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(list.investedAmount)

  const [propertyStatus, setPropertyStatus] = useState(() =>
    readPropertyStatusForDetail(d.id, d.propertyStatus),
  )
  useEffect(() => {
    setPropertyStatus(readPropertyStatusForDetail(d.id, d.propertyStatus))
  }, [d.id, d.propertyStatus])

  const onPropertyStatusChange = (next: string) => {
    setPropertyStatus(coercePropertyStatus(next))
    try {
      localStorage.setItem(PROPERTY_STATUS_STORAGE_KEY(d.id), coercePropertyStatus(next))
    } catch {
      /* ignore */
    }
  }

  const [investedAsLine, setInvestedAsLine] = useState(d.investedAs)
  const [generalComments, setGeneralComments] = useState(() =>
    readStoredString(
      d.id,
      GENERAL_COMMENTS_STORAGE_KEY,
      d.generalComments,
    ),
  )
  const hasRoleBreakdownTable = (d.investedAsBreakdown?.length ?? 0) > 0
  const [profileBreakdownQuery, setProfileBreakdownQuery] = useState("")
  const filteredProfileBreakdown = useMemo(() => {
    const rows = d.investedAsBreakdown
    if (!rows?.length) return []
    const q = profileBreakdownQuery.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => {
      const name = (r.profileName ?? "").toLowerCase()
      const invType = (r.investorType ?? "").toLowerCase()
      const amt = formatInvDetailUsd(r.investedAmount).toLowerCase()
      return (
        name.includes(q) ||
        invType.includes(q) ||
        amt.includes(q) ||
        String(r.investedAmount).includes(q)
      )
    })
  }, [d.investedAsBreakdown, profileBreakdownQuery])
  useEffect(() => {
    setProfileBreakdownQuery("")
  }, [d.id])
  useEffect(() => {
    setInvestedAsLine(d.investedAs)
  }, [d.investedAs, d.id])
  useEffect(() => {
    if (hasRoleBreakdownTable) return
    let cancelled = false
    void (async () => {
      const nameMap = await fetchUserInvestorProfileNameMap()
      if (cancelled) return
      setInvestedAsLine(
        enrichInvestmentListRow(d.list, nameMap).investmentProfile,
      )
    })()
    return () => {
      cancelled = true
    }
  }, [
    hasRoleBreakdownTable,
    d.id,
    d.list.investmentProfile,
    d.list.commitmentProfileId,
    d.list.userInvestorProfileId,
  ])
  useEffect(() => {
    setGeneralComments(
      readStoredString(d.id, GENERAL_COMMENTS_STORAGE_KEY, d.generalComments),
    )
  }, [d.id, d.generalComments])

  const onGeneralCommentsChange = (next: string) => {
    setGeneralComments(next)
    try {
      localStorage.setItem(GENERAL_COMMENTS_STORAGE_KEY(d.id), next)
    } catch {
      /* ignore */
    }
  }

  const [debt, setDebt] = useState(() => readDebtInfoForDetail(d))
  useEffect(() => {
    setDebt(readDebtInfoForDetail(d))
  }, [d.id])

  const profileBreakdownColumns: DataTableColumn<InvestmentBreakdownLine>[] = useMemo(
    () => [
      {
        id: "profileName",
        header: "Profile name",
        sortValue: (r) => (r.profileName ?? "").toLowerCase(),
        tdClassName: "um_td_user",
        cell: (r) => r.profileName?.trim() || "—",
      },
      {
        id: "investorType",
        header: "Investor type",
        sortValue: (r) => (r.investorType ?? "").toLowerCase(),
        tdClassName: "um_td_user",
        cell: (r) => r.investorType?.trim() || "—",
      },
      {
        id: "invested",
        header: "Invested",
        align: "right",
        thClassName: "deals_th_align_right",
        tdClassName: "um_td_numeric",
        sortValue: (r) => r.investedAmount,
        cell: (r) => formatInvDetailUsd(r.investedAmount),
      },
    ],
    [],
  )

  const patchDebt = useCallback(
    (partial: Partial<DebtInfoFields>) => {
      setDebt((prev) => {
        const next = normalizeDebtFields({ ...prev, ...partial })
        try {
          localStorage.setItem(DEBT_INFO_STORAGE_KEY(d.id), JSON.stringify(next))
        } catch {
          /* ignore */
        }
        return next
      })
    },
    [d.id],
  )

  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab: "details" | "profile" =
    searchParams.get("tab") === "profile" ? "profile" : "details"
  const setActiveTab = (tab: "details" | "profile") => {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        if (tab === "profile") p.set("tab", "profile")
        else p.delete("tab")
        return p
      },
      { replace: true },
    )
  }
  const profileLineCount = d.investedAsBreakdown?.length ?? 0

  return (
    <>
      <div className="um_members_tabs_outer deals_tabs_outer investment_detail_tabs_outer">
        <TabsScrollStrip scrollClassName="deals_tabs_scroll">
          <div
            className="um_members_tabs_row deals_tabs_row"
            role="tablist"
            aria-label="Investment detail views"
          >
            <button
              type="button"
              id="inv-detail-tab-details"
              role="tab"
              aria-selected={activeTab === "details"}
              aria-controls="inv-detail-panel-details"
              className={`um_members_tab deals_tabs_tab${
                activeTab === "details" ? " um_members_tab_active" : ""
              }`}
              onClick={() => setActiveTab("details")}
            >
              <Building2
                className="deals_tabs_icon"
                size={18}
                strokeWidth={1.75}
                aria-hidden
              />
              <span className="deals_tabs_label">Details</span>
            </button>
            <button
              type="button"
              id="inv-detail-tab-profile"
              role="tab"
              aria-selected={activeTab === "profile"}
              aria-controls="inv-detail-panel-profile"
              className={`um_members_tab deals_tabs_tab${
                activeTab === "profile" ? " um_members_tab_active" : ""
              }`}
              onClick={() => setActiveTab("profile")}
            >
              <UserCircle
                className="deals_tabs_icon"
                size={18}
                strokeWidth={1.75}
                aria-hidden
              />
              <span className="deals_tabs_label">Profile and investment</span>
              {profileLineCount > 0 ? (
                <span className="deals_tabs_count">({profileLineCount})</span>
              ) : null}
            </button>
          </div>
        </TabsScrollStrip>
      </div>

      <div
        className="um_members_tab_content investment_detail_tab_panels"
        id="inv-detail-tab-panels"
      >
        {activeTab === "details" ? (
          <div
            id="inv-detail-panel-details"
            role="tabpanel"
            aria-labelledby="inv-detail-tab-details"
            className="investment_detail_tab_panel"
          >
            <section
              className="investment_detail_section"
              aria-labelledby="inv-sec-property"
            >
              <h2
                id="inv-sec-property"
                className="investment_detail_section_title"
              >
                Property information
              </h2>
              <div className="investment_detail_grid">
                <FieldText label="Name" value={d.propertyName} required />
                <FieldSelect
                  label="Property type"
                  value={d.propertyType}
                  options={PROPERTY_TYPES}
                />
                <FieldSelect
                  label="Status"
                  value={propertyStatus}
                  options={PROPERTY_STATUSES}
                  isLocked={false}
                  onChange={onPropertyStatusChange}
                />
                <FieldText label="City" value={d.city} />
                <FieldText label="State" value={d.state} />
                <FieldText label="Number of units" value={d.numberOfUnits} />
                <FieldPct label="Occupancy" value={d.occupancyPct} />
                <FieldDate label="Owned since" value={d.ownedSince} />
                <FieldText label="Year built" value={d.yearBuilt} />
              </div>
            </section>

            <section
              className="investment_detail_section"
              aria-labelledby="inv-sec-general"
            >
              <h2
                id="inv-sec-general"
                className="investment_detail_section_title"
              >
                General
              </h2>
              <div className="investment_detail_grid">
                <div className="investment_detail_field">
                  <label className="investment_detail_label">Invested amount</label>
                  <input
                    type="text"
                    className="investment_detail_input"
                    readOnly
                    value={investedDisplay}
                  />
                </div>
                {!hasRoleBreakdownTable && (
                  <div className="investment_detail_field">
                    <label
                      className="investment_detail_label"
                      htmlFor="inv-detail-invested-as"
                    >
                      Invested as
                    </label>
                    <input
                      id="inv-detail-invested-as"
                      type="text"
                      className="investment_detail_input"
                      readOnly
                      value={investedAsLine}
                    />
                  </div>
                )}
                <FieldPct
                  label="Ownership percentage"
                  value={d.ownershipPct}
                  notEditable
                />
                <FieldText
                  label="General comments"
                  value={generalComments}
                  readOnly={false}
                  onChange={onGeneralCommentsChange}
                  multiline
                  fieldClassName="investment_detail_field--full"
                  inputClassName="investment_detail_input--multiline"
                />
              </div>
            </section>

            <section
              className="investment_detail_section"
              aria-labelledby="inv-sec-cashflow"
            >
              <h2
                id="inv-sec-cashflow"
                className="investment_detail_section_title"
              >
                Cash flow and valuation
              </h2>
              <div className="investment_detail_grid">
                <FieldCurrency
                  label="Overall asset value"
                  value={d.overallAssetValue}
                />
                <FieldCurrency
                  label="Net operating income"
                  value={d.netOperatingIncome}
                />
              </div>
            </section>

            <section
              className="investment_detail_section"
              aria-labelledby="inv-sec-debt"
            >
              <h2
                id="inv-sec-debt"
                className="investment_detail_section_title"
              >
                Debt info
              </h2>
              <div className="investment_detail_grid">
                <FieldCurrency
                  label="Outstanding loans"
                  value={debt.outstandingLoans}
                  readOnly={false}
                  onChange={(next) => patchDebt({ outstandingLoans: next })}
                />
                <FieldCurrency
                  label="Debt service"
                  value={debt.debtService}
                  readOnly={false}
                  onChange={(next) => patchDebt({ debtService: next })}
                />
                <FieldSelect
                  label="Loan type"
                  value={debt.loanType}
                  options={LOAN_TYPES}
                  isLocked={false}
                  onChange={(next) => patchDebt({ loanType: next })}
                />
                <FieldSelect
                  label="IO or Amortizing"
                  value={debt.ioOrAmortizing}
                  options={IO_AMORT}
                  isLocked={false}
                  onChange={(next) => patchDebt({ ioOrAmortizing: next })}
                />
                <FieldDate
                  label="Maturity date"
                  value={debt.maturityDate}
                  readOnly={false}
                  onChange={(next) => patchDebt({ maturityDate: next })}
                />
                <FieldText
                  label="Lender"
                  value={debt.lender}
                  readOnly={false}
                  onChange={(next) => patchDebt({ lender: next })}
                />
                <FieldPct
                  label="Interest rate"
                  value={debt.interestRatePct}
                  readOnly={false}
                  onChange={(next) => patchDebt({ interestRatePct: next })}
                />
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === "profile" ? (
          <div
            id="inv-detail-panel-profile"
            role="tabpanel"
            aria-labelledby="inv-detail-tab-profile"
            className="investment_detail_tab_panel"
          >
            <div
              className="investment_detail_inv_profile_card um_panel um_members_tab_panel deals_list_table_panel deals_list_card_surface deal_inv_table_panel"
            >
              <div className="um_members_header_block contacts_inner_header">
                <h2
                  id="inv-sec-profile-inv"
                  className="investing_profiles_title investing_profiles_sr_only"
                >
                  Profile and investment
                </h2>
              </div>
              {hasRoleBreakdownTable && d.investedAsBreakdown ? (
                <>
                  <div
                    className="um_toolbar deal_inv_table_um_toolbar investment_detail_inv_profile_table_toolbar"
                    aria-label="Table tools"
                  >
                    <div className="um_search_wrap">
                      <Search className="um_search_icon" size={18} aria-hidden />
                      <input
                        type="search"
                        className="um_search_input"
                        placeholder="Search by profile, type, or amount…"
                        value={profileBreakdownQuery}
                        onChange={(e) => setProfileBreakdownQuery(e.target.value)}
                        aria-label="Filter profile commitments"
                      />
                    </div>
                    <div className="investment_detail_inv_profile_toolbar_end">
                      <p className="investment_detail_inv_profile_totals" aria-live="polite">
                        Invested {investedDisplay}
                      </p>
                    </div>
                  </div>
                  <DataTable<InvestmentBreakdownLine>
                    visualVariant="members"
                    membersTableClassName="um_table_members deal_inv_table"
                    columns={profileBreakdownColumns}
                    rows={filteredProfileBreakdown}
                    getRowKey={(_r, i) => `inv-breakdown-${i}`}
                    emptyLabel={
                      profileBreakdownQuery.trim()
                        ? "No lines match this filter."
                        : "No investment lines for this deal."
                    }
                    initialSort={{ columnId: "profileName", direction: "asc" }}
                  />
                </>
              ) : (
                <div className="investment_detail_inv_profile_solo">
                  <p className="investing_profiles_lead" aria-live="polite">
                    <strong>Invested amount</strong> {investedDisplay}
                  </p>
                  <p className="investing_profiles_lead" aria-live="polite">
                    <strong>Invested as</strong> {investedAsLine}
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </>
  )
}

export default function InvestmentDetailPage() {
  const { investmentId = "" } = useParams<{ investmentId: string }>()
  const decodedId = useMemo(
    () => decodeURIComponent(investmentId.trim()),
    [investmentId],
  )
  const fromLocal = useMemo(
    () => (decodedId ? getInvestmentDetail(decodedId) : undefined),
    [decodedId],
  )
  const [fromApi, setFromApi] = useState<InvestmentDetailRecord | null | undefined>(
    undefined,
  )
  const [loadPending, setLoadPending] = useState(false)

  useEffect(() => {
    if (!decodedId) {
      setFromApi(null)
      return
    }
    // Always load server deal + investors for this investment so the Profile and investment
    // table can list every book profile and amount (not only a single "Invested as" line
    // from local/runtime storage when both exist).
    let cancelled = false
    setLoadPending(true)
    void (async () => {
      try {
        const d = await loadInvestmentDetailFromDeal(decodedId)
        if (!cancelled) setFromApi(d ?? null)
      } catch {
        if (!cancelled) setFromApi(null)
      } finally {
        if (!cancelled) setLoadPending(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [decodedId])

  const detail = useMemo((): InvestmentDetailRecord | null => {
    if (fromApi) {
      return fromLocal
        ? mergeServerInvestmentDetailWithLocal(fromApi, fromLocal)
        : fromApi
    }
    return fromLocal ?? null
  }, [fromApi, fromLocal])

  useEffect(() => {
    if (loadPending && !fromLocal) {
      setAppDocumentTitle("Investment")
      return
    }
    if (!detail) {
      setAppDocumentTitle(
        decodedId ? "Investment not found" : "Investment",
      )
      return
    }
    const t =
      detail.list.investmentName?.trim() ||
      detail.propertyName?.trim() ||
      "Investment"
    setAppDocumentTitle(t)
  }, [detail, decodedId, loadPending, fromLocal])

  if (!decodedId) {
    return (
      <div className="um_page deals_list_page deals_detail_page investment_detail_page">
        <p className="deals_list_not_found">Missing investment.</p>
      </div>
    )
  }

  if (loadPending && !fromLocal) {
    return (
      <div className="um_page deals_list_page deals_detail_page investment_detail_page">
        <p className="deals_list_not_found" role="status">
          Loading investment…
        </p>
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="um_page deals_list_page deals_detail_page investment_detail_page">
        <p className="deals_list_not_found">
          Investment not found.{" "}
          <Link to="/investing/investments" className="deals_list_inline_back">
            <ArrowLeft size={18} strokeWidth={2} aria-hidden />
            Back to investments
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="um_page deals_list_page deals_detail_page investment_detail_page">
      <Link to="/investing/investments" className="investment_detail_back">
        <ArrowLeft size={18} strokeWidth={2} aria-hidden />
        Back to investments
      </Link>
      <h1 className="investment_detail_title">
        {detail.list.investmentName || detail.propertyName}
      </h1>
      <DetailForm d={detail} />
    </div>
  )
}
