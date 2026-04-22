import { useCallback, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import {
  Eye,
  EyeOff,
  HelpCircle,
  Info,
  Mail,
  MapPin,
  Phone,
  Search,
  Shield,
  UserPlus,
  UserRound,
  X,
} from "lucide-react"
import { toast } from "@/common/components/Toast"
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

interface AddBeneficiaryModalProps {
  open: boolean
  onClose: () => void
  onSave: (b: BeneficiaryDraft) => void
  initial?: BeneficiaryDraft | null
  /** "edit" shows save label and title for editing an existing row. */
  variant?: "add" | "edit"
}

function TaxIdHelp() {
  return (
    <button
      type="button"
      className="investing_field_hint"
      title="EIN, SSN, or other tax identifier for the beneficiary or entity"
      aria-label="Tax ID — more information"
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
}: AddBeneficiaryModalProps) {
  const [d, setD] = useState<BeneficiaryDraft>(empty)
  const [taxVisible, setTaxVisible] = useState(false)
  const isEdit = variant === "edit"

  useEffect(() => {
    if (!open) return
    setD(initial && Object.keys(initial).length ? { ...empty, ...initial } : { ...empty })
    setTaxVisible(false)
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
  }, [])

  function handleAdd() {
    if (!d.fullName.trim()) {
      toast.error("Name required", "Enter the full name of the individual or entity.")
      return
    }
    onSave({ ...d, fullName: d.fullName.trim() })
    onClose()
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

        <form
          className="deals_add_inv_modal_form"
          onSubmit={(e) => {
            e.preventDefault()
            void handleAdd()
          }}
          noValidate
        >
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
                labelSuffix={<TaxIdHelp />}
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

            <InvestingFormField id="ben-phone" label="Phone number" Icon={Phone} tight>
              <input
                id="ben-phone"
                className="deals_add_inv_input deals_add_inv_field_control"
                type="tel"
                value={d.phone}
                onChange={(e) => patch({ phone: e.target.value })}
                autoComplete="tel"
                placeholder="Phone"
              />
            </InvestingFormField>

            <InvestingFormField id="ben-email" label="Email" Icon={Mail} tight>
              <input
                id="ben-email"
                className="deals_add_inv_input deals_add_inv_field_control"
                type="email"
                value={d.email}
                onChange={(e) => patch({ email: e.target.value })}
                autoComplete="email"
                placeholder="Email"
              />
            </InvestingFormField>

            <div className="add_beneficiary_field_grid__full">
              <InvestingFormField id="ben-addr" label="Address" Icon={MapPin}>
                <div className="add_profile_search_wrap">
                  <Search
                    className="add_profile_search_icon"
                    size={16}
                    strokeWidth={2}
                    aria-hidden
                  />
                  <input
                    id="ben-addr"
                    className="deals_add_inv_input deals_add_inv_field_control add_profile_search"
                    value={d.addressQuery}
                    onChange={(e) => patch({ addressQuery: e.target.value })}
                    placeholder="Search"
                    autoComplete="off"
                    aria-label="Search address"
                  />
                </div>
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
