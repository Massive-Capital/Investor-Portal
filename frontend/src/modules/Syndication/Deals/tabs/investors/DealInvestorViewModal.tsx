import {
  Activity,
  BadgeCheck,
  Briefcase,
  Calendar,
  CalendarCheck,
  DollarSign,
  IdCard,
  Mail,
  Percent,
  Pencil,
  Shield,
  Tag,
  User,
  UserRound,
  X,
} from "lucide-react"
import { useEffect } from "react"
import { createPortal } from "react-dom"
import { CardCompactAmount } from "../../../../../common/components/card-compact-amount/CardCompactAmount"
import { ViewReadonlyField } from "../../../../../common/components/ViewReadonlyField"
import { formatDateDdMmmYyyy } from "../../../../../common/utils/formatDateDisplay"
import { investorRoleLabel } from "../../constants/investor-profile"
import {
  dealInvestorStatusDisplayLabel,
  investorFundedColumnLabel,
} from "../../utils/dealInvestorTableDisplay"
import { displayInvestorCommittedAmount } from "../../utils/offeringMoneyFormat"
import { investorSignedColumnDisplay } from "../../utils/investorEsignStatus"
import type { DealInvestorClass } from "../../types/deal-investor-class.types"
import type { DealInvestorRow } from "../../types/deal-investors.types"
import "../../../usermanagement/user_management.css"
import "../../deals-list.css"
import "../../deal-investors-tab.css"

interface DealInvestorViewModalProps {
  row: DealInvestorRow | null
  onClose: () => void
  investorClasses: DealInvestorClass[]
  /** Comma-separated class names for the deal when the row has no assigned class */
  dealAllClassNamesLine: string
  onEdit: (row: DealInvestorRow) => void
}

function displayOrDash(v: string | null | undefined): string {
  const t = String(v ?? "").trim()
  if (!t || t === "—") return "—"
  return t
}

function displayPctOrDash(v: string | null | undefined): string {
  const t = String(v ?? "").trim()
  if (!t || t === "—") return "—"
  if (/%\s*$/.test(t)) return t
  const n = Number(t.replace(/,/g, ""))
  if (Number.isFinite(n)) return `${n}%`
  return t
}

function resolveInvestorClassDisplay(
  row: DealInvestorRow,
  classes: DealInvestorClass[],
  dealLine: string,
): string {
  const raw = (row.investorClass ?? "").trim()
  if (raw) {
    const byId = classes.find((c) => c.id === raw)
    if (byId) {
      const name = byId.name.trim()
      return name || byId.id
    }
    return raw
  }
  const fallback = dealLine.trim()
  return fallback || "—"
}

function investmentProfileLabel(row: DealInvestorRow): string {
  const named = String(row.userInvestorProfileName ?? "").trim()
  if (named) return named
  return displayOrDash(row.entitySubtitle)
}

function countersignedDisplay(row: DealInvestorRow): string {
  const completed = String(row.esignStatus?.completedAt ?? "").trim()
  if (completed) return formatDateDdMmmYyyy(completed)
  return "—"
}

function datePlacedDisplay(row: DealInvestorRow): string {
  const iso = String(row.investedAtIso ?? "").trim()
  if (iso) return formatDateDdMmmYyyy(iso)
  return "—"
}

export function DealInvestorViewModal({
  row,
  onClose,
  investorClasses,
  dealAllClassNamesLine,
  onEdit,
}: DealInvestorViewModalProps) {
  useEffect(() => {
    if (!row) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [row, onClose])

  if (row == null) return null

  const investorRow = row

  const invClass = resolveInvestorClassDisplay(
    investorRow,
    investorClasses,
    dealAllClassNamesLine,
  )
  const investedAmount = displayInvestorCommittedAmount(investorRow)

  function handleEdit() {
    onEdit(investorRow)
    onClose()
  }

  return createPortal(
    <div
      className="um_modal_overlay deals_deal_view_modal_overlay"
      role="presentation"
    >
      <div
        className="um_modal um_modal_view deals_deal_view_modal deal_inv_investor_view_modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="deal-inv-investor-view-title"
      >
        <div className="um_modal_head">
          <h2 id="deal-inv-investor-view-title" className="um_modal_title">
            Investor details
          </h2>
          <button
            type="button"
            className="um_modal_close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} strokeWidth={2} aria-hidden />
          </button>
        </div>

        <div className="deals_deal_view_modal_body deal_inv_view_body">
          <section className="deal_inv_view_section" aria-label="Investor">
            <header className="deal_inv_view_section_head">
              <h3 className="deal_inv_view_section_label">Investor</h3>
            </header>
            <div className="um_view_grid">
              <ViewReadonlyField
                Icon={UserRound}
                label="Investor name"
                value={displayOrDash(investorRow.displayName)}
              />
              <ViewReadonlyField
                Icon={Mail}
                label="Email address"
                value={displayOrDash(investorRow.userEmail)}
              />
              <ViewReadonlyField
                Icon={IdCard}
                label="Investment profile"
                value={investmentProfileLabel(investorRow)}
              />
              <ViewReadonlyField
                Icon={User}
                label="Username"
                value={displayOrDash(investorRow.userDisplayName)}
              />
              <ViewReadonlyField
                Icon={Briefcase}
                label="Role"
                value={investorRoleLabel(investorRow.investorRole ?? "")}
              />
              <ViewReadonlyField
                Icon={Shield}
                label="Self accredited"
                value={displayOrDash(investorRow.selfAccredited)}
              />
              <ViewReadonlyField
                Icon={BadgeCheck}
                label="Verified accreditation"
                fieldClassName="deals_deal_view_field_full"
                value={displayOrDash(investorRow.verifiedAccLabel)}
              />
            </div>
          </section>

          <section className="deal_inv_view_section" aria-label="Investment">
            <header className="deal_inv_view_section_head">
              <h3 className="deal_inv_view_section_label">Investment</h3>
            </header>
            <div className="um_view_grid">
              <ViewReadonlyField
                Icon={Activity}
                label="Investment status"
                value={dealInvestorStatusDisplayLabel(investorRow)}
              />
              <ViewReadonlyField
                Icon={Tag}
                label="Class"
                value={invClass}
              />
              <ViewReadonlyField
                Icon={User}
                label="Sponsor name"
                value={displayOrDash(investorRow.addedByDisplayName)}
              />
              <ViewReadonlyField
                Icon={BadgeCheck}
                label="Fund approval"
                value={investorFundedColumnLabel(investorRow)}
              />
            </div>
          </section>

          <section
            className="deal_inv_view_section"
            aria-label="Amounts and ownership"
          >
            <header className="deal_inv_view_section_head">
              <h3 className="deal_inv_view_section_label">
                Amounts and ownership
              </h3>
            </header>
            <div className="um_view_grid">
              <ViewReadonlyField
                Icon={DollarSign}
                label="Invested amount"
                value={<CardCompactAmount amount={investedAmount} />}
              />
              <ViewReadonlyField
                Icon={DollarSign}
                label="Committed"
                value={<CardCompactAmount amount={investorRow.committed} />}
              />
              <ViewReadonlyField
                Icon={Percent}
                label="Percent of class (ownership)"
                value={displayPctOrDash(investorRow.percentOfClassOwnership)}
              />
              <ViewReadonlyField
                Icon={Percent}
                label="Percent of class (distributions)"
                value={displayPctOrDash(
                  investorRow.percentOfClassDistributions,
                )}
              />
            </div>
          </section>

          <section
            className="deal_inv_view_section"
            aria-label="Signing and funding"
          >
            <header className="deal_inv_view_section_head">
              <h3 className="deal_inv_view_section_label">
                Signing and funding
              </h3>
            </header>
            <div className="um_view_grid">
              <ViewReadonlyField
                Icon={Calendar}
                label="Date placed"
                value={datePlacedDisplay(investorRow)}
              />
              <ViewReadonlyField
                Icon={Calendar}
                label="Document signed on"
                value={investorSignedColumnDisplay(investorRow)}
              />
              <ViewReadonlyField
                Icon={CalendarCheck}
                label="Document countersigned on"
                value={countersignedDisplay(investorRow)}
              />
              <ViewReadonlyField
                Icon={Calendar}
                label="Received / funded date"
                value={formatDateDdMmmYyyy(investorRow.fundedDate)}
              />
            </div>
          </section>
        </div>

        <div className="um_modal_actions um_modal_actions_view deals_deal_view_modal_actions">
          <button
            type="button"
            className="um_btn_secondary"
            onClick={onClose}
          >
            <X size={16} strokeWidth={2} aria-hidden />
            Close
          </button>
          <button
            type="button"
            className="um_btn_primary"
            onClick={handleEdit}
          >
            <Pencil size={16} strokeWidth={2} aria-hidden />
            Edit
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
