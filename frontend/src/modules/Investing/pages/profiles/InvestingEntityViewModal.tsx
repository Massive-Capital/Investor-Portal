import type { LucideIcon } from "lucide-react"
import {
  Building2,
  Calendar,
  CircleCheck,
  FileText,
  Hash,
  Mail,
  MapPin,
  Phone,
  User,
  X,
} from "lucide-react"
import { createPortal } from "react-dom"
import { ViewReadonlyField } from "@/common/components/ViewReadonlyField"
import "@/modules/Syndication/InvestorPortal/Deals/components/add-investment-modal.css"
import "@/modules/contacts/contacts.css"
import "@/modules/usermanagement/user_management.css"
import "./investing-profiles.css"

type DetailRow = { label: string; value: string }

type InvestingEntityViewModalProps = {
  open: boolean
  onClose: () => void
  title: string
  /** Screen reader / subtitle (shown under title, centered) */
  description?: string
  rows: DetailRow[]
}

function viewFieldIconForLabel(label: string): LucideIcon {
  const t = label.toLowerCase()
  if (t.includes("email")) return Mail
  if (t.includes("phone")) return Phone
  if (
    t.includes("country") ||
    t.includes("city") ||
    t.includes("state") ||
    t.includes("region") ||
    t.includes("zip") ||
    t.includes("street") ||
    t === "address" ||
    t.includes("name / company")
  ) {
    return MapPin
  }
  if (
    t.includes("relationship") ||
    t.includes("name") ||
    t.includes("profile name")
  )
    return User
  if (t.includes("type") && t.includes("profile")) return Building2
  if (t.includes("date")) return Calendar
  if (t.includes("status") || t.includes("investment") || t.includes("added by"))
    return CircleCheck
  if (t.includes("tax id")) return Hash
  if (t.includes("memo") || t.includes("note") || t.includes("distribution")) return FileText
  return FileText
}

export function InvestingEntityViewModal({
  open,
  onClose,
  title,
  description,
  rows,
}: InvestingEntityViewModalProps) {
  if (!open) return null

  return createPortal(
    <div
      className="um_modal_overlay deals_add_inv_modal_overlay investing_ben_modal_overlay contacts_view_modal_overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="um_modal um_modal_view deals_add_inv_modal_panel add_contact_panel contacts_view_modal investing_entity_view_modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="investing-view-modal-title"
        aria-describedby={description ? "investing-view-modal-desc" : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="um_modal_head investing_entity_view_head">
          <h2 id="investing-view-modal-title" className="um_modal_title">
            {title}
          </h2>
          {description ? (
            <p
              id="investing-view-modal-desc"
              className="investing_entity_view_sub"
            >
              {description}
            </p>
          ) : null}
          <button
            type="button"
            className="um_modal_close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} strokeWidth={2} aria-hidden />
          </button>
        </div>
        <div className="deals_add_inv_modal_scroll">
          <div className="um_view_grid contacts_view_modal_grid">
            {rows.map((r) => {
              const v = r.value.trim() || "—"
              const Icon = viewFieldIconForLabel(r.label)
              return (
                <ViewReadonlyField
                  key={r.label}
                  Icon={Icon}
                  label={r.label}
                  value={v}
                />
              )
            })}
          </div>
        </div>
        <div className="um_modal_actions um_modal_actions_view contacts_view_modal_footer">
          <button type="button" className="um_btn_secondary" onClick={onClose}>
            <X size={16} strokeWidth={2} aria-hidden />
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
