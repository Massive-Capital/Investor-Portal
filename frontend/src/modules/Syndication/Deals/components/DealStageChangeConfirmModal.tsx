import { Loader2, X } from "lucide-react"
import { useEffect, useId } from "react"
import { createPortal } from "react-dom"
import type { DealStageModalContent } from "../constants/deal-stage-modal-config"
import "../../usermanagement/user_management.css"

interface DealStageChangeConfirmModalProps {
  open: boolean
  content: DealStageModalContent
  confirming?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function DealStageChangeConfirmModal({
  open,
  content,
  confirming = false,
  onConfirm,
  onCancel,
}: DealStageChangeConfirmModalProps) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !confirming) onCancel()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, confirming, onCancel])

  if (!open) return null

  return createPortal(
    <div
      className="um_modal_overlay deals_add_inv_modal_overlay portal_modal_z_boost"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !confirming) onCancel()
      }}
    >
      <div
        className="um_modal deals_add_inv_modal_panel add_contact_panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="um_modal_head add_contact_modal_head">
          <h2 id={titleId} className="um_modal_title add_contact_modal_title">
            {content.title}
          </h2>
          <button
            type="button"
            className="um_modal_close"
            aria-label="Close"
            disabled={confirming}
            onClick={onCancel}
          >
            <X size={20} strokeWidth={2} aria-hidden />
          </button>
        </div>
        <div className="deals_add_inv_modal_scroll">
          <p className="deal_offer_pf_share_modal_lead">{content.description}</p>
        </div>
        <div className="um_modal_actions">
          <button
            type="button"
            className="um_btn_secondary"
            disabled={confirming}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="um_btn_primary"
            disabled={confirming}
            onClick={onConfirm}
          >
            {confirming ? (
              <>
                <Loader2
                  size={16}
                  strokeWidth={2}
                  className="deals_create_btn_spin"
                  aria-hidden
                />
                Saving…
              </>
            ) : (
              content.confirmText
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
