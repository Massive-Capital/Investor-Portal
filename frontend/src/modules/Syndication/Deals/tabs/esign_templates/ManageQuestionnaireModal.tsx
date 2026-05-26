import { Settings2, X } from "lucide-react"
import { useEffect, useId } from "react"
import { createPortal } from "react-dom"
import {
  ESIGN_ENTITY_CATEGORIES,
  ESIGN_ENTITY_CATEGORY_COLUMN_LABELS,
} from "./esignEntityCategories"
import {
  isQuestionnaireSectionVisibleForProfile,
  setQuestionnaireSectionVisibleForProfile,
} from "./investorQuestionnaireProfileVisibility"
import type {
  InvestorQuestionnaireProfileSectionVisibility,
  InvestorQuestionnaireSection,
} from "./investorQuestionnaire.types"
import { QuestionnaireToggle } from "./QuestionnaireToggle"

export interface ManageQuestionnaireModalProps {
  open: boolean
  sections: InvestorQuestionnaireSection[]
  visibility: InvestorQuestionnaireProfileSectionVisibility | undefined
  canEdit: boolean
  saving: boolean
  onClose: () => void
  onVisibilityChange: (
    visibility: InvestorQuestionnaireProfileSectionVisibility | undefined,
  ) => void
}

export function ManageQuestionnaireModal({
  open,
  sections,
  visibility,
  canEdit,
  saving,
  onClose,
  onVisibilityChange,
}: ManageQuestionnaireModalProps) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, saving, onClose])

  if (!open || typeof document === "undefined") return null

  const disabled = !canEdit || saving

  return createPortal(
    <div
      className="um_modal_overlay deals_add_inv_modal_overlay portal_modal_z_boost deal_esign_manage_q_overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose()
      }}
    >
      <div
        className="um_modal um_modal_view deals_add_inv_modal_panel add_contact_panel deal_esign_manage_q_modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="um_modal_head add_contact_modal_head">
          <h3 id={titleId} className="um_modal_title add_contact_modal_title">
            <Settings2
              size={18}
              strokeWidth={2}
              aria-hidden
              className="deal_esign_manage_q_title_icon"
            />
            Manage Questionnaire
          </h3>
          <button
            type="button"
            className="um_modal_close"
            onClick={() => !saving && onClose()}
            disabled={saving}
            aria-label="Close"
          >
            <X size={20} strokeWidth={2} aria-hidden />
          </button>
        </div>
        {/* <p className="deal_esign_manage_q_desc">
          Choose which questionnaire sections appear on each investor profile&apos;s
          e-sign template. When a section is off, it is hidden for that profile type.
        </p> */}
        <div className="deals_add_inv_modal_scroll deal_esign_manage_q_scroll">
          <table className="deal_esign_manage_q_table">
            <thead>
              <tr>
                <th
                  rowSpan={2}
                  scope="col"
                  className="deal_esign_manage_q_th_section"
                >
                  Section
                </th>
                <th
                  scope="col"
                  colSpan={ESIGN_ENTITY_CATEGORIES.length}
                  className="deal_esign_manage_q_th_profiles_group"
                >
                  Profiles
                </th>
              </tr>
              <tr>
                {ESIGN_ENTITY_CATEGORIES.map((profile) => (
                  <th
                    key={profile.id}
                    scope="col"
                    className="deal_esign_manage_q_th_profile"
                    title={profile.label}
                  >
                    {ESIGN_ENTITY_CATEGORY_COLUMN_LABELS[profile.id] ??
                      profile.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sections.map((section) => (
                <tr key={section.id}>
                  <th
                    scope="row"
                    className="deal_esign_manage_q_row_label"
                    title={section.label}
                  >
                    {section.label}
                  </th>
                  {ESIGN_ENTITY_CATEGORIES.map((profile) => {
                    const checked = isQuestionnaireSectionVisibleForProfile(
                      visibility,
                      profile.id,
                      section.id,
                    )
                    const toggleId = `manage-q-${section.id}-${profile.id}`
                    return (
                      <td
                        key={profile.id}
                        className="deal_esign_manage_q_cell"
                      >
                        <QuestionnaireToggle
                          id={toggleId}
                          checked={checked}
                          disabled={disabled}
                          ariaLabel={`${checked ? "Hide" : "Show"} ${section.label} for ${profile.label}`}
                          onChange={(next) => {
                            const updated =
                              setQuestionnaireSectionVisibleForProfile(
                                visibility,
                                profile.id,
                                section.id,
                                next,
                              )
                            const hasRules =
                              Object.keys(updated).length > 0
                            onVisibilityChange(
                              hasRules ? updated : undefined,
                            )
                          }}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="um_modal_actions">
          <button
            type="button"
            className="um_btn_primary"
            onClick={onClose}
            disabled={saving}
          >
            {saving ? "Saving…" : "Done"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
