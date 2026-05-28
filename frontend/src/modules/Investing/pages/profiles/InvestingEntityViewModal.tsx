import { Fragment, useEffect, useId, useState } from "react"
import type { LucideIcon } from "lucide-react"
import {
  Building2,
  Calendar,
  CircleCheck,
  ChevronRight,
  FileText,
  Hash,
  Mail,
  MapPin,
  Pencil,
  Phone,
  User,
  X,
  ArrowLeft,
} from "lucide-react"
import { createPortal } from "react-dom"
import { ViewReadonlyField } from "@/common/components/ViewReadonlyField"
import { InvestingFormField } from "./InvestingFormField"
import "@/modules/Syndication/Deals/tabs/investors/add-investment-modal.css"
import "@/modules/Syndication/contacts/contacts.css"
import "@/modules/Syndication/usermanagement/user_management.css"
import "./add-investor-profile-modal.css"
import "./investing-profiles-form-modals.css"
import "./investing-profiles.css"

type DetailRow = { label: string; value: string }

export type InvestingEntityViewSection = {
  heading: string
  rows: DetailRow[]
}

type InvestingEntityViewModalProps = {
  open: boolean
  onClose: () => void
  title: string
  /** Screen reader / subtitle under title */
  description?: string
  /** Flat field list (beneficiary / address view). Ignored when `sections` is set. */
  rows?: DetailRow[]
  /** Grouped fields (full investor profile view). */
  sections?: InvestingEntityViewSection[]
  /** Shown beside Close — typically navigates to the edit flow. */
  onEdit?: () => void
  editLabel?: string
}

const PROFILE_RECORD_SECTION_HEADING = "Profile record"

function slugFromLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
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
    t.includes("name / company") ||
    t.includes("mailing")
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
  if (t.includes("tax id") || t.includes("ssn") || t.includes("ein") || t.includes("routing") || t.includes("account number"))
    return Hash
  if (t.includes("memo") || t.includes("note") || t.includes("distribution")) return FileText
  return FileText
}

function ViewFieldGrid({ rows }: { rows: DetailRow[] }) {
  return (
    <div className="um_view_grid contacts_view_modal_grid">
      {rows.map((r, i) => {
        const v = r.value.trim() || "—"
        const Icon = viewFieldIconForLabel(r.label)
        return (
          <ViewReadonlyField
            key={`${r.label}-${i}`}
            Icon={Icon}
            label={r.label}
            value={v}
          />
        )
      })}
    </div>
  )
}

function ProfileWizardReadonlyFields({ rows }: { rows: DetailRow[] }) {
  return (
    <div className="investing_profile_view_fields">
      {rows.map((r, i) => {
        const v = r.value.trim() || "—"
        const id = `profile-view-${slugFromLabel(r.label)}-${i}`
        const Icon = viewFieldIconForLabel(r.label)
        return (
          <InvestingFormField key={id} id={id} label={r.label} Icon={Icon}>
            <div className="add_profile_readonly_type">{v}</div>
          </InvestingFormField>
        )
      })}
    </div>
  )
}

function ProfileViewStepper({
  steps,
  currentStep,
  onStepChange,
}: {
  steps: string[]
  currentStep: number
  onStepChange: (step: number) => void
}) {
  return (
    <div className="add_contact_stepper" role="group" aria-label="Profile sections">
      {steps.map((label, i) => {
        const n = i + 1
        const isActive = currentStep === n
        const isDone = currentStep > n
        return (
          <Fragment key={label}>
            {i > 0 ? (
              <span
                className={
                  currentStep > i
                    ? "add_contact_step_line add_contact_step_line_active"
                    : "add_contact_step_line"
                }
                aria-hidden
              />
            ) : null}
            <button
              type="button"
              className={
                isActive
                  ? "add_contact_step_node add_contact_step_node_active investing_profile_view_step_btn"
                  : isDone
                    ? "add_contact_step_node add_contact_step_node_done investing_profile_view_step_btn"
                    : "add_contact_step_node investing_profile_view_step_btn"
              }
              onClick={() => onStepChange(n)}
              aria-current={isActive ? "step" : undefined}
            >
              <span className="add_contact_step_dot">{n}</span>
              <span className="add_contact_step_label">{label}</span>
            </button>
          </Fragment>
        )
      })}
    </div>
  )
}

function ProfileWizardViewBody({
  profileTitle,
  sections,
  description,
  onClose,
  onEdit,
  editLabel,
}: {
  profileTitle: string
  sections: InvestingEntityViewSection[]
  description?: string
  onClose: () => void
  onEdit?: () => void
  editLabel: string
}) {
  const stepLabelId = useId()
  const wizardSections = sections.filter(
    (s) => s.heading && s.heading !== PROFILE_RECORD_SECTION_HEADING,
  )
  const metaSection = sections.find(
    (s) => s.heading === PROFILE_RECORD_SECTION_HEADING,
  )
  const totalSteps = Math.max(wizardSections.length, 1)
  const [step, setStep] = useState(1)

  useEffect(() => {
    setStep(1)
  }, [sections])

  const activeSection = wizardSections[step - 1]
  const isLastStep = step >= totalSteps
  const stepLabel = activeSection?.heading ?? ""

  return (
    <>
      <div className="um_modal_head add_contact_modal_head investing_profile_view_head">
        <div className="add_contact_modal_head_main">
          <h2
            id="investing-view-modal-title"
            className="um_modal_title add_contact_modal_title"
          >
            {profileTitle}
          </h2>
          {description ? (
            <p
              id="investing-view-modal-desc"
              className="investing_profile_view_desc"
            >
              {description}
            </p>
          ) : null}
          {wizardSections.length > 0 ? (
            <ProfileViewStepper
              steps={wizardSections.map((s) => s.heading)}
              currentStep={step}
              onStepChange={setStep}
            />
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

      <div className="deals_add_inv_modal_scroll investing_profile_view_scroll">
        <div
          className="add_contact_section"
          aria-labelledby={stepLabelId}
        >
          <p id={stepLabelId} className="add_contact_section_eyebrow">
            {stepLabel}
          </p>
          {activeSection ? (
            <ProfileWizardReadonlyFields rows={activeSection.rows} />
          ) : null}
          {isLastStep && metaSection ? (
            <>
              <hr className="add_contact_section_rule" aria-hidden />
              <p className="add_contact_section_eyebrow add_contact_section_eyebrow_spaced">
                {metaSection.heading}
              </p>
              <ProfileWizardReadonlyFields rows={metaSection.rows} />
            </>
          ) : null}
        </div>
      </div>

      <div className="um_modal_actions add_contact_modal_actions investing_profile_view_footer">
        <button type="button" className="um_btn_secondary" onClick={onClose}>
          <X size={16} strokeWidth={2} aria-hidden />
          Close
        </button>
        <div className="add_contact_modal_actions_trailing">
          {step > 1 ? (
            <button
              type="button"
              className="um_btn_secondary"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
            >
              <ArrowLeft size={16} strokeWidth={2} aria-hidden />
              Back
            </button>
          ) : null}
          {step < totalSteps ? (
            <button
              type="button"
              className="um_btn_primary"
              onClick={() => setStep((s) => Math.min(totalSteps, s + 1))}
            >
              Next
              <ChevronRight size={18} strokeWidth={2} aria-hidden />
            </button>
          ) : onEdit ? (
            <button type="button" className="um_btn_primary" onClick={onEdit}>
              <Pencil size={16} strokeWidth={2} aria-hidden />
              {editLabel}
            </button>
          ) : null}
        </div>
      </div>
    </>
  )
}

export function InvestingEntityViewModal({
  open,
  onClose,
  title,
  description,
  rows = [],
  sections,
  onEdit,
  editLabel = "Edit",
}: InvestingEntityViewModalProps) {
  if (!open) return null

  const isProfileWizard =
    sections && sections.length > 0 && sections.some((s) => s.heading)

  const sectionList =
    sections && sections.length > 0
      ? sections
      : rows.length > 0
        ? [{ heading: "", rows }]
        : []

  return createPortal(
    <div
      className={`um_modal_overlay deals_add_inv_modal_overlay investing_ben_modal_overlay contacts_view_modal_overlay${
        isProfileWizard ? " investing_profile_view_overlay" : ""
      }`}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={
          isProfileWizard
            ? "um_modal um_modal_view deals_add_inv_modal_panel add_contact_panel investing_add_profile_form_panel investing_entity_view_modal investing_entity_view_modal--profile investing_entity_view_modal--wizard"
            : `um_modal um_modal_view deals_add_inv_modal_panel add_contact_panel contacts_view_modal investing_entity_view_modal${
                sections && sections.length > 0
                  ? " investing_entity_view_modal--profile"
                  : ""
              }`
        }
        role="dialog"
        aria-modal="true"
        aria-labelledby="investing-view-modal-title"
        aria-describedby={description ? "investing-view-modal-desc" : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {isProfileWizard ? (
          <ProfileWizardViewBody
            profileTitle={title}
            sections={sectionList}
            description={description}
            onClose={onClose}
            onEdit={onEdit}
            editLabel={editLabel}
          />
        ) : (
          <>
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
              {sectionList.map((section, idx) => (
                <section
                  key={section.heading || `section-${idx}`}
                  className="investing_entity_view_section"
                  aria-label={section.heading || undefined}
                >
                  {section.heading ? (
                    <h3 className="investing_entity_view_section_title">
                      {section.heading}
                    </h3>
                  ) : null}
                  <ViewFieldGrid rows={section.rows} />
                </section>
              ))}
            </div>
            <div className="um_modal_actions um_modal_actions_view contacts_view_modal_footer investing_entity_view_footer">
              <button type="button" className="um_btn_secondary" onClick={onClose}>
                <X size={16} strokeWidth={2} aria-hidden />
                Close
              </button>
              {onEdit ? (
                <button type="button" className="um_btn_primary" onClick={onEdit}>
                  <Pencil size={16} strokeWidth={2} aria-hidden />
                  {editLabel}
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
