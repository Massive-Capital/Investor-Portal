import { useCallback, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { IdCard, X } from "lucide-react"
import { toast } from "@/common/components/Toast"
import { InvestingFormField } from "./InvestingFormField"
import type { InvestorProfileListRow, NewInvestorProfilePayload } from "./investor-profiles.types"
import "@/modules/Syndication/InvestorPortal/Deals/components/add-investment-modal.css"
import "@/modules/contacts/contacts.css"
import "@/modules/usermanagement/user_management.css"
import "./add-investor-profile-modal.css"
import "./investing-profiles-form-modals.css"

type EditInvestorProfileModalProps = {
  open: boolean
  onClose: () => void
  profile: InvestorProfileListRow | null
  onSave: (id: string, body: NewInvestorProfilePayload) => void | Promise<void>
}

export function EditInvestorProfileModal({
  open,
  onClose,
  profile,
  onSave,
}: EditInvestorProfileModalProps) {
  const [profileName, setProfileName] = useState("")
  const [profileType, setProfileType] = useState("")

  useEffect(() => {
    if (!open || !profile) return
    setProfileName(profile.profileName ?? "")
    setProfileType(profile.profileType ?? "")
  }, [open, profile])

  const submit = useCallback(() => {
    if (!profile?.id) return
    const n = profileName.trim()
    if (!n) {
      toast.error("Name required", "Enter a profile name.")
      return
    }
    void (async () => {
      try {
        await onSave(profile.id, {
          profileName: n,
          profileType: profileType.trim() || "—",
        })
        onClose()
        toast.success("Profile updated", "Your changes were saved.")
      } catch (e) {
        toast.error(
          "Could not save",
          e instanceof Error ? e.message : "Please try again.",
        )
      }
    })()
  }, [profile, profileName, profileType, onSave, onClose])

  if (!open || !profile) return null

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
        aria-labelledby="edit-investor-profile-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="um_modal_head add_contact_modal_head">
          <div className="add_contact_modal_head_main">
            <h2
              id="edit-investor-profile-title"
              className="um_modal_title add_contact_modal_title"
            >
              Edit profile
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
            submit()
          }}
        >
          <div className="deals_add_inv_modal_scroll">
            <div className="add_contact_name_grid add_beneficiary_field_grid">
              <div className="add_beneficiary_field_grid__full">
                <InvestingFormField
                  id="edit-profile-name"
                  label={
                    <>
                      Profile name{" "}
                      <span className="investing_form_req" aria-label="required">
                        *
                      </span>
                    </>
                  }
                  Icon={IdCard}
                >
                  <input
                    id="edit-profile-name"
                    className="deals_add_inv_input deals_add_inv_field_control"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    autoComplete="off"
                    placeholder="Profile name"
                  />
                </InvestingFormField>
              </div>
              <div className="add_beneficiary_field_grid__full">
                <InvestingFormField
                  id="edit-profile-type"
                  label="Profile type"
                  Icon={IdCard}
                >
                  <input
                    id="edit-profile-type"
                    className="deals_add_inv_input deals_add_inv_field_control"
                    value={profileType}
                    onChange={(e) => setProfileType(e.target.value)}
                    autoComplete="off"
                    placeholder="Profile type"
                  />
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
                Save changes
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}
