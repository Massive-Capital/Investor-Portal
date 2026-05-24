import { X } from "lucide-react"
import { useEffect, useId } from "react"
import { createPortal } from "react-dom"

interface EsignTemplateDeleteConfirmModalProps {
  open: boolean
  displayName: string
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function EsignTemplateDeleteConfirmModal({
  open,
  displayName,
  busy,
  onCancel,
  onConfirm,
}: EsignTemplateDeleteConfirmModalProps) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onCancel()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, busy, onCancel])

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div
      className="um_modal_overlay deals_add_inv_modal_overlay portal_modal_z_boost deal_member_delete_overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel()
      }}
    >
      <div
        className="um_modal um_modal_view deals_add_inv_modal_panel add_contact_panel deal_member_delete_modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="um_modal_head add_contact_modal_head">
          <h3 id={titleId} className="um_modal_title add_contact_modal_title">
            Delete eSign template?
          </h3>
          <button
            type="button"
            className="um_modal_close"
            onClick={() => !busy && onCancel()}
            disabled={busy}
            aria-label="Close"
          >
            <X size={20} strokeWidth={2} aria-hidden />
          </button>
        </div>
        <div className="deals_add_inv_modal_scroll">
          <p className="deals_suspend_all_modal_message">
            Remove &quot;{displayName}&quot; from this deal? This cannot be undone.
          </p>
        </div>
        <div className="um_modal_actions">
          <button
            type="button"
            className="um_btn_secondary"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="um_btn_primary deal_member_delete_confirm_btn"
            onClick={() => void onConfirm()}
            disabled={busy}
          >
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
