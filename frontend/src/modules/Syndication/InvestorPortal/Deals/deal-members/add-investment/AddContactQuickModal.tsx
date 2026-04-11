import { Loader2, X } from "lucide-react"
import {
  useCallback,
  useId,
  useState,
  type FormEvent,
} from "react"
import { getSessionUserDisplayName } from "../../../../../../common/auth/sessionUserDisplayName"
import { createContact } from "../../../../../contacts/api/contactsApi"
import type { ContactRow } from "../../../../../contacts/types/contact.types"
import "./add_contact_quick_modal.css"

export interface AddContactQuickModalProps {
  open: boolean
  onClose: () => void
  /** Called with the created contact after a successful API save. */
  onCreated: (contact: ContactRow) => void
  /** Existing contacts to block duplicate emails (case-insensitive). */
  existingContacts: ContactRow[]
}

function normalizeEmail(s: string): string {
  return s.trim().toLowerCase()
}

export function AddContactQuickModal({
  open,
  onClose,
  onCreated,
  existingContacts,
}: AddContactQuickModalProps) {
  const titleId = useId()
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const reset = useCallback(() => {
    setFirstName("")
    setLastName("")
    setEmail("")
    setPhone("")
    setFormError(null)
    setSubmitting(false)
  }, [])

  const handleClose = useCallback(() => {
    reset()
    onClose()
  }, [onClose, reset])

  if (!open) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    const fn = firstName.trim()
    const ln = lastName.trim()
    const em = email.trim()
    if (!fn) {
      setFormError("First name is required.")
      return
    }
    if (!ln) {
      setFormError("Last name is required.")
      return
    }
    if (!em) {
      setFormError("Email is required.")
      return
    }
    const emNorm = normalizeEmail(em)
    const dup = existingContacts.some(
      (c) => normalizeEmail(c.email) === emNorm,
    )
    if (dup) {
      setFormError("A contact with this email already exists.")
      return
    }

    setSubmitting(true)
    try {
      const ownerName = getSessionUserDisplayName().trim()
      const created = await createContact({
        firstName: fn,
        lastName: ln,
        email: em,
        phone: phone.trim(),
        note: "",
        tags: [],
        lists: [],
        owners: ownerName ? [ownerName] : ["User"],
        status: "active",
      })
      onCreated(created)
      reset()
      onClose()
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Could not create contact.",
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="add_contact_quick_overlay"
      role="presentation"
    >
      <div
        className="add_contact_quick_modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="add_contact_quick_head">
          <h3 id={titleId} className="add_contact_quick_title">
            New contact
          </h3>
          <button
            type="button"
            className="add_contact_quick_close"
            aria-label="Close"
            disabled={submitting}
            onClick={handleClose}
          >
            <X size={18} strokeWidth={2} aria-hidden />
          </button>
        </div>
        <form className="add_contact_quick_form" onSubmit={handleSubmit}>
          {formError ? (
            <p className="add_contact_quick_error" role="alert">
              {formError}
            </p>
          ) : null}
          <div className="add_contact_quick_fields">
            <label className="add_contact_quick_label">
              First name
              <input
                className="add_contact_quick_input deals_add_inv_field_pill"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
                disabled={submitting}
                required
              />
            </label>
            <label className="add_contact_quick_label">
              Last name
              <input
                className="add_contact_quick_input deals_add_inv_field_pill"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
                disabled={submitting}
                required
              />
            </label>
            <label className="add_contact_quick_label">
              Email
              <input
                type="email"
                className="add_contact_quick_input deals_add_inv_field_pill"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                disabled={submitting}
                required
              />
            </label>
            <label className="add_contact_quick_label">
              Phone <span className="add_contact_quick_optional">(optional)</span>
              <input
                className="add_contact_quick_input deals_add_inv_field_pill"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                disabled={submitting}
              />
            </label>
          </div>
          <div className="add_contact_quick_actions">
            <button
              type="button"
              className="add_contact_quick_btn_secondary"
              disabled={submitting}
              onClick={handleClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="add_contact_quick_btn_primary"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2
                    className="add_contact_quick_spinner"
                    size={16}
                    strokeWidth={2}
                    aria-hidden
                  />
                  Saving…
                </>
              ) : (
                "Save contact"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
