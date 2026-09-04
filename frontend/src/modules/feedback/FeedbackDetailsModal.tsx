import { CheckCircle2, ClipboardList, Loader2, MessageSquareText, X } from "lucide-react"
import { useEffect, useId, useState, type FormEvent } from "react"
import { createPortal } from "react-dom"
import { formatDateDdMmmYyyy } from "@/common/utils/formatDateDisplay"
import { feedbackLocationLabel } from "./feedbackLocation"
import type { FeedbackItem, FeedbackReviewAction } from "./types"
import "./feedback.css"

function formatDateTime(raw: string | null | undefined): string {
  if (!raw?.trim()) return "—"
  const date = formatDateDdMmmYyyy(raw)
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return date
  const time = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })
  return `${date} ${time}`
}

export function FeedbackDetailsModal({
  open,
  item,
  mode,
  submitting = false,
  onClose,
  onAction,
}: {
  open: boolean
  item: FeedbackItem | null
  mode: "review" | "view"
  submitting?: boolean
  onClose: () => void
  onAction?: (action: FeedbackReviewAction, adminResponse: string) => void
}) {
  const titleId = useId()
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setNotes(item?.adminResponse ?? "")
    setError(null)
  }, [open, item?.id, item?.adminResponse])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, submitting, onClose])

  if (!open || !item || typeof document === "undefined") return null

  const reviewMode = mode === "review"
  const canMarkReviewed = reviewMode && item.status === "Pending"
  const canMarkResolved = reviewMode && item.status !== "Resolved"

  function handleAction(action: FeedbackReviewAction) {
    const trimmed = notes.trim()
    if (action === "resolved" && trimmed.length < 3) {
      setError("Enter review comments before marking as resolved.")
      return
    }
    setError(null)
    onClose()
    onAction?.(action, trimmed)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (canMarkReviewed) handleAction("reviewed")
    else if (canMarkResolved) handleAction("resolved")
  }

  return createPortal(
    <div
      className="um_modal_overlay contacts_suspend_overlay portal_modal_z_boost"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose()
      }}
    >
      <div
        className="um_modal feedback_form_modal feedback_details_modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="um_modal_head add_contact_modal_head">
          <div className="add_contact_modal_head_main">
            <h3 id={titleId} className="um_modal_title um_title_with_icon">
              <MessageSquareText size={20} aria-hidden />
              {reviewMode ? "Review feedback" : "Feedback details"}
            </h3>
          </div>
          <button
            type="button"
            className="um_modal_close"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <form className="feedback_form" onSubmit={handleSubmit}>
          {error ? <p className="feedback_form_error">{error}</p> : null}
          <dl className="feedback_readonly_grid">
            <div>
              <dt>Submitted by</dt>
              <dd>{item.username || "—"}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{item.userEmail || "—"}</dd>
            </div>
            <div>
              <dt>Page</dt>
              <dd>{feedbackLocationLabel(item)}</dd>
            </div>
            <div>
              <dt>Submitted</dt>
              <dd>{formatDateTime(item.createdAt)}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{item.status}</dd>
            </div>
            {item.reviewedByName ? (
              <div>
                <dt>Reviewed by</dt>
                <dd>{item.reviewedByName}</dd>
              </div>
            ) : null}
            {item.reviewedAt ? (
              <div>
                <dt>Reviewed date</dt>
                <dd>{formatDateTime(item.reviewedAt)}</dd>
              </div>
            ) : null}
            {item.resolvedAt ? (
              <div>
                <dt>Resolved date</dt>
                <dd>{formatDateTime(item.resolvedAt)}</dd>
              </div>
            ) : null}
          </dl>
          <label className="feedback_field">
            <span>Original feedback</span>
            <p className="feedback_readonly_text">{item.description || "—"}</p>
          </label>
          {reviewMode ? (
            <label className="feedback_field">
              <span>Review Comments</span>
              <textarea
                className="feedback_textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={5}
                maxLength={8000}
                disabled={submitting}
                placeholder="Describe the review or how the issue was resolved…"
              />
            </label>
          ) : item.adminResponse ? (
            <label className="feedback_field">
              <span>Review Comments</span>
              <p className="feedback_readonly_text">{item.adminResponse}</p>
            </label>
          ) : null}
          <div className="um_modal_actions add_contact_modal_actions">
            <button
              type="button"
              className="um_btn_secondary"
              onClick={onClose}
              disabled={submitting}
            >
              <X size={16} aria-hidden />
              {reviewMode ? "Cancel" : "Close"}
            </button>
            {reviewMode ? (
              <div className="add_contact_modal_actions_trailing feedback_review_actions">
                {canMarkReviewed ? (
                  <button
                    type="button"
                    className="um_btn_secondary"
                    disabled={submitting}
                    onClick={() => handleAction("reviewed")}
                  >
                    {submitting ? (
                      <Loader2 size={16} className="feedback_spin" aria-hidden />
                    ) : (
                      <ClipboardList size={16} aria-hidden />
                    )}
                    Mark as Reviewed
                  </button>
                ) : null}
                {canMarkResolved ? (
                  <button
                    type="button"
                    className="um_btn_primary"
                    disabled={submitting}
                    onClick={() => handleAction("resolved")}
                  >
                    {submitting ? (
                      <Loader2 size={16} className="feedback_spin" aria-hidden />
                    ) : (
                      <CheckCircle2 size={16} aria-hidden />
                    )}
                    Mark as Resolved
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}
