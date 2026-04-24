import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"
import { createPortal } from "react-dom"
import {
  Eye,
  EyeOff,
  HelpCircle,
  Info,
  Mail,
  MapPin,
  Phone,
  Shield,
  UserPlus,
  UserRound,
  X,
} from "lucide-react"
import { toast } from "@/common/components/Toast"
import { formatSavedAddressLabel, type SavedAddress } from "./address.types"
import { InvestingFormField } from "./InvestingFormField"
import "@/modules/Syndication/InvestorPortal/Deals/components/add-investment-modal.css"
import "@/modules/contacts/contacts.css"
import "@/modules/usermanagement/user_management.css"
import "./add-investor-profile-modal.css"
import "./investing-profiles-form-modals.css"

export type BeneficiaryDraft = {
  fullName: string
  relationship: string
  taxId: string
  phone: string
  email: string
  addressQuery: string
}

const empty: BeneficiaryDraft = {
  fullName: "",
  relationship: "",
  taxId: "",
  phone: "",
  email: "",
  addressQuery: "",
}

const RELATIONSHIP_OPTIONS = [
  "",
  "Spouse",
  "Child",
  "Parent",
  "Sibling",
  "Trust",
  "Other",
] as const

/** Non-empty value must look like a normal email. */
function getEmailError(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(t)) {
    return "Enter a valid email address."
  }
  return null
}

/** Non-empty value must have a plausible digit count; allows +, spaces, and common separators. */
function getPhoneError(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  const allowed = /^[\d+()\s.\-]+$/
  if (!allowed.test(t)) {
    return "Use only digits, spaces, and + ( ) - . in the phone number."
  }
  const digits = t.replace(/\D/g, "")
  if (digits.length < 7) {
    return "Phone number should include at least 7 digits."
  }
  if (digits.length > 15) {
    return "This phone number has too many digits."
  }
  return null
}

interface AddBeneficiaryModalProps {
  open: boolean
  onClose: () => void
  onSave: (b: BeneficiaryDraft) => void
  initial?: BeneficiaryDraft | null
  /** "edit" shows save label and title for editing an existing row. */
  variant?: "add" | "edit"
  /** Address tab rows — used for the address dropdown (active only). */
  savedAddresses?: SavedAddress[]
}

function findAddressIdByLabel(
  rows: SavedAddress[],
  addressQuery: string,
): string {
  const t = (addressQuery ?? "").trim()
  if (!t) return ""
  return rows.find((a) => formatSavedAddressLabel(a) === t)?.id ?? ""
}

function FieldLabelHint({ title: hintTitle, label }: { title: string; label: string }) {
  return (
    <button
      type="button"
      className="investing_field_hint"
      title={hintTitle}
      aria-label={label}
    >
      <Info size={16} strokeWidth={1.75} aria-hidden />
    </button>
  )
}

export function AddBeneficiaryModal({
  open,
  onClose,
  onSave,
  initial = null,
  variant = "add",
  savedAddresses = [],
}: AddBeneficiaryModalProps) {
  const [d, setD] = useState<BeneficiaryDraft>(empty)
  const [taxVisible, setTaxVisible] = useState(false)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const isEdit = variant === "edit"
  const activeSavedAddresses = useMemo(
    () => savedAddresses.filter((a) => !a.archived),
    [savedAddresses],
  )
  const selectedAddressId = useMemo(
    () => findAddressIdByLabel(activeSavedAddresses, d.addressQuery),
    [activeSavedAddresses, d.addressQuery],
  )
  const hasUnmatchedAddressQuery = Boolean(
    d.addressQuery.trim() && !selectedAddressId,
  )

  useEffect(() => {
    if (!open) return
    setD(initial && Object.keys(initial).length ? { ...empty, ...initial } : { ...empty })
    setTaxVisible(false)
    setPhoneError(null)
    setEmailError(null)
  }, [open, initial])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  const patch = useCallback((p: Partial<BeneficiaryDraft>) => {
    setD((prev) => ({ ...prev, ...p }))
    if (Object.prototype.hasOwnProperty.call(p, "phone")) setPhoneError(null)
    if (Object.prototype.hasOwnProperty.call(p, "email")) setEmailError(null)
  }, [])

  function handleAdd() {
    if (!d.fullName.trim()) {
      toast.error("Name required", "Enter the full name of the individual or entity.")
      return
    }
    const pErr = getPhoneError(d.phone)
    const eErr = getEmailError(d.email)
    setPhoneError(pErr)
    setEmailError(eErr)
    if (pErr || eErr) {
      const first = pErr || eErr || ""
      toast.error("Check contact details", first)
      return
    }
    onSave({ ...d, fullName: d.fullName.trim() })
    onClose()
  }

  function onFormSubmit(e: FormEvent) {
    e.preventDefault()
    handleAdd()
  }

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
        aria-labelledby="add-beneficiary-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="um_modal_head add_contact_modal_head">
          <div className="add_contact_modal_head_main">
            <h2
              id="add-beneficiary-title"
              className="um_modal_title add_contact_modal_title"
            >
              {isEdit ? "Edit beneficiary" : "Add beneficiary"}
            </h2>
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

        <form className="deals_add_inv_modal_form" onSubmit={onFormSubmit} noValidate>
          <div className="deals_add_inv_modal_scroll">
            <div
              className="add_contact_name_grid add_beneficiary_field_grid"
            >
            <InvestingFormField
              id="ben-fullname"
              label={
                <>
                  Full name of individual or entity{" "}
                  <span className="investing_form_req" aria-label="required">
                    *
                  </span>
                </>
              }
              Icon={UserRound}
              tight
            >
              <input
                id="ben-fullname"
                className="deals_add_inv_input deals_add_inv_field_control"
                value={d.fullName}
                onChange={(e) => patch({ fullName: e.target.value })}
                autoComplete="name"
                placeholder="Enter name"
              />
            </InvestingFormField>

            <InvestingFormField
              id="ben-rel"
              label="Relationship to profile holder"
              Icon={HelpCircle}
              tight
            >
              <select
                id="ben-rel"
                className="um_field_select deals_add_inv_field_control"
                value={d.relationship}
                onChange={(e) => patch({ relationship: e.target.value })}
                aria-label="Relationship to profile holder"
              >
                <option value="">Select</option>
                {RELATIONSHIP_OPTIONS.filter(Boolean).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </InvestingFormField>

            <div className="add_beneficiary_field_grid__full">
              <InvestingFormField
                id="ben-tax"
                label="Tax ID"
                Icon={Shield}
                labelSuffix={
                  <FieldLabelHint
                    title="EIN, SSN, or other tax identifier for the beneficiary or entity"
                    label="Tax ID — more information"
                  />
                }
              >
                <div className="add_profile_input_wrap">
                  <input
                    id="ben-tax"
                    className="deals_add_inv_input deals_add_inv_field_control"
                    type={taxVisible ? "text" : "password"}
                    value={d.taxId}
                    onChange={(e) => patch({ taxId: e.target.value })}
                    autoComplete="off"
                    placeholder="Tax ID"
                    aria-label="Tax ID"
                  />
                  <button
                    type="button"
                    className="add_profile_ssn_toggle"
                    onClick={() => setTaxVisible((v) => !v)}
                    aria-label={taxVisible ? "Hide tax ID" : "Show tax ID"}
                  >
                    {taxVisible ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                </div>
              </InvestingFormField>
            </div>

            <InvestingFormField
              id="ben-phone"
              label="Phone number"
              Icon={Phone}
              tight
              error={phoneError ?? undefined}
            >
              <input
                id="ben-phone"
                className="deals_add_inv_input deals_add_inv_field_control"
                type="tel"
                inputMode="tel"
                value={d.phone}
                onChange={(e) => patch({ phone: e.target.value })}
                autoComplete="tel"
                placeholder="(555) 000-0000"
                aria-invalid={Boolean(phoneError)}
                aria-describedby={phoneError ? "ben-phone-err" : undefined}
              />
            </InvestingFormField>

            <InvestingFormField
              id="ben-email"
              label="Email"
              Icon={Mail}
              tight
              error={emailError ?? undefined}
            >
              <input
                id="ben-email"
                className="deals_add_inv_input deals_add_inv_field_control"
                type="email"
                inputMode="email"
                value={d.email}
                onChange={(e) => patch({ email: e.target.value })}
                autoComplete="email"
                placeholder="name@example.com"
                aria-invalid={Boolean(emailError)}
                aria-describedby={emailError ? "ben-email-err" : undefined}
              />
            </InvestingFormField>

            <div className="add_beneficiary_field_grid__full">
              <InvestingFormField id="ben-addr" label="Address" Icon={MapPin}>
                {activeSavedAddresses.length === 0 ? (
                  <p className="add_profile_sub" style={{ marginBottom: "0.35em" }}>
                    Add at least one address in the <strong>Address</strong> tab, then return
                    here to select it, or continue without an address (leave the menu empty).
                  </p>
                ) : null}
                {hasUnmatchedAddressQuery ? (
                  <p className="add_profile_sub" style={{ marginBottom: "0.35em" }} role="status">
                    Address on file does not match a saved row:{" "}
                    <span className="um_field_hint" style={{ display: "block", marginTop: "0.2em" }}>
                      {d.addressQuery}
                    </span>{" "}
                    Choose a saved address below to replace it.
                  </p>
                ) : null}
                <select
                  id="ben-addr"
                  className="um_field_select deals_add_inv_field_control"
                  value={selectedAddressId}
                  onChange={(e) => {
                    const id = e.target.value
                    if (!id) {
                      patch({ addressQuery: "" })
                      return
                    }
                    const row = activeSavedAddresses.find((a) => a.id === id)
                    patch({ addressQuery: row ? formatSavedAddressLabel(row) : "" })
                  }}
                  aria-label="Mailing or legal address — choose a saved address"
                >
                  <option value="">
                    {activeSavedAddresses.length
                      ? "No address (optional)"
                      : "No saved addresses — add in Address tab"}
                  </option>
                  {activeSavedAddresses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {formatSavedAddressLabel(a)}
                    </option>
                  ))}
                </select>
              </InvestingFormField>
            </div>
            </div>
          </div>

          <div className="um_modal_actions add_contact_modal_actions">
            <button type="button" className="um_btn_secondary" onClick={onClose}>
              <X size={16} strokeWidth={2} aria-hidden />
              Cancel
            </button>
            <div className="add_contact_modal_actions_trailing">
              <button type="submit" className="um_btn_primary">
                <UserPlus size={18} strokeWidth={2} aria-hidden />
                {isEdit ? "Save changes" : "Add beneficiary"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}
