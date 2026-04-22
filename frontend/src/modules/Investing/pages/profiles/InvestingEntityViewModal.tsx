import { createPortal } from "react-dom"
import { X } from "lucide-react"
import "@/modules/usermanagement/user_management.css"
import "./investing-profiles.css"

type DetailRow = { label: string; value: string }

type InvestingEntityViewModalProps = {
  open: boolean
  onClose: () => void
  title: string
  /** Screen reader / subtitle */
  description?: string
  rows: DetailRow[]
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
      className="um_modal_overlay deals_add_inv_modal_overlay investing_ben_modal_overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="um_modal um_modal_view deals_add_inv_modal_panel add_contact_panel investing_add_beneficiary_form_panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="investing-view-modal-title"
        aria-describedby={description ? "investing-view-modal-desc" : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="um_modal_head add_contact_modal_head">
          <div className="add_contact_modal_head_main">
            <h2
              id="investing-view-modal-title"
              className="um_modal_title add_contact_modal_title"
            >
              {title}
            </h2>
            {description ? (
              <p id="investing-view-modal-desc" className="investing_profiles_lead" style={{ margin: "0.25em 0 0" }}>
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="um_modal_close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} strokeWidth={2} aria-hidden />
          </button>
        </div>
        <div className="deals_add_inv_modal_scroll" style={{ paddingTop: "0.5em" }}>
          <dl
            className="investing_view_detail_dl"
            style={{
              margin: 0,
              display: "grid",
              gridTemplateColumns: "minmax(6rem, 9rem) 1fr",
              gap: "0.65em 1rem",
              fontSize: "0.9rem",
            }}
          >
            {rows.map((r) => (
              <div key={r.label} style={{ display: "contents" }}>
                <dt
                  style={{
                    color: "var(--portal-text-secondary, #64748b)",
                    fontWeight: 600,
                  }}
                >
                  {r.label}
                </dt>
                <dd
                  style={{
                    margin: 0,
                    wordBreak: "break-word",
                    color: "var(--portal-text, #0f172a)",
                  }}
                >
                  {r.value.trim() || "—"}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="um_modal_actions add_contact_modal_actions">
          <div className="add_contact_modal_actions_trailing" style={{ marginLeft: "auto" }}>
            <button type="button" className="um_btn_primary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
