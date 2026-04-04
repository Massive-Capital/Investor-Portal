import { type ReactNode } from "react"
import {
  FormTooltip,
  MandatoryFieldMark,
} from "../../../../../common/components/form-tooltip/FormTooltip"
// import { SEC_TYPE_OPTIONS } from "../../../../../common/components/constants/sec-type-options"
import { SEC_TYPE_OPTIONS } from "../constants/sec-type-options";
import {
  DEAL_FORM_TYPE_OPTIONS,
  DEAL_STAGE_CHOICES,
  type DealStepDraft,
  type YesNo,
} from "../types/deals.types"
import { FieldInfoHeading } from "./FieldInfoHeading"
import "./deal-step-form.css"

interface DealStepFormProps {
  draft: DealStepDraft
  errors: Partial<Record<keyof DealStepDraft, string>>
  onChange: (patch: Partial<DealStepDraft>) => void
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="deals_create_field_error">{message}</p>
}

function YesNoRadios({
  name,
  titleId,
  label,
  infoContent,
  value,
  onChange,
  error,
  noIsCommon,
  required: isRequired,
}: {
  name: string
  titleId: string
  label: string
  infoContent: ReactNode
  value: YesNo | ""
  onChange: (v: YesNo) => void
  error?: string
  noIsCommon?: boolean
  required?: boolean
}) {
  return (
    <fieldset className="deal_step_fieldset">
      <legend className="deal_step_sr_legend">
        {label}
        {isRequired ? ", required" : ""}. Choose Yes or No.
      </legend>
      <FieldInfoHeading
        titleId={titleId}
        label={label}
        required={isRequired}
        infoContent={infoContent}
      />
      <div className="deal_step_yesno" role="radiogroup" aria-labelledby={titleId}>
        {(["yes", "no"] as const).map((v) => (
          <label key={v} className="deal_step_yesno_label">
            <input
              type="radio"
              name={name}
              checked={value === v}
              onChange={() => onChange(v)}
            />
            <span>
              {v === "yes" ? "Yes" : "No"}
              {v === "no" && noIsCommon ? (
                <span className="deal_step_yesno_common"> (most common)</span>
              ) : null}
            </span>
          </label>
        ))}
      </div>
      <FieldError message={error} />
    </fieldset>
  )
}

export function DealStepForm({ draft, errors, onChange }: DealStepFormProps) {
  const selectedDealType = DEAL_FORM_TYPE_OPTIONS.find(
    (o) => o.value === draft.dealType,
  )
  const dealTypeInfoText = selectedDealType?.infoText

  return (
    <section
      className="deals_create_card"
      aria-labelledby="create-step-deal"
    >
      <h2 id="create-step-deal" className="deals_create_section_title">
        Deal
      </h2>
      <div className="deals_create_fields deal_step_grid">
        <label className="deals_create_label">
          <span className="form_label_toolbar">
            <span className="form_label_inline_row">
              <span>Deal name</span>
              <MandatoryFieldMark />
            </span>
            <FormTooltip
              label="About deal name"
              content={
                <p>
                  The name shown to your team and investors for this deal. You
                  can change it later where allowed.
                </p>
              }
            />
          </span>
          <input
            className="deals_create_input"
            value={draft.dealName}
            onChange={(e) => onChange({ dealName: e.target.value })}
            aria-invalid={Boolean(errors.dealName)}
          />
          <FieldError message={errors.dealName} />
        </label>

        <div className="deals_create_label deal_step_deal_type_wrap">
          <div className="deal_step_deal_type_label_row">
            <label className="deal_step_deal_type_label" htmlFor="deal-type-select">
              Deal type
            </label>
            <FormTooltip
              label="About deal type"
              content={
                <p>
                  {dealTypeInfoText ??
                    "Choose the category that best describes this syndication. More detail may appear for certain types."}
                </p>
              }
            />
          </div>
          <select
            id="deal-type-select"
            className="deals_create_select"
            value={draft.dealType}
            onChange={(e) => onChange({ dealType: e.target.value })}
          >
            <option value="">Select type…</option>
            {DEAL_FORM_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <fieldset className="deal_step_fieldset deals_create_label_full">
          <legend className="deal_step_sr_legend">
            Deal stage, required. Select one option.
          </legend>
          <FieldInfoHeading
            titleId="deal-stage-heading"
            label="Deal stage"
            required
            infoContent={
              <ul className="field_info_list">
                {DEAL_STAGE_CHOICES.map((opt) => (
                  <li key={opt.value}>
                    <strong>{opt.label}</strong> — {opt.hint}
                  </li>
                ))}
              </ul>
            }
          />
          <div
            className="deal_stage_radios"
            role="radiogroup"
            aria-labelledby="deal-stage-heading"
          >
            {DEAL_STAGE_CHOICES.map((opt) => (
              <label key={opt.value} className="deal_stage_row">
                <input
                  type="radio"
                  name="dealStage"
                  checked={draft.dealStage === opt.value}
                  onChange={() => onChange({ dealStage: opt.value })}
                />
                <span className="deal_stage_row_label">{opt.label}</span>
              </label>
            ))}
          </div>
          <FieldError message={errors.dealStage} />
        </fieldset>

        <label className="deals_create_label deals_create_label_full">
          <span className="form_label_toolbar">
            <span className="form_label_inline_row">
              <span>SEC type</span>
              <MandatoryFieldMark />
            </span>
            <FormTooltip
              label="About SEC type"
              content={
                <p>
                  Choose how this offering is registered or exempt under SEC
                  rules (for example Reg D, Reg A, or 506(c)). If unsure, consult
                  your counsel.
                </p>
              }
            />
          </span>
          <select
            className="deals_create_select"
            value={draft.secType}
            onChange={(e) => onChange({ secType: e.target.value })}
            aria-invalid={Boolean(errors.secType)}
          >
            {SEC_TYPE_OPTIONS.map((o) => (
              <option key={o.value || "empty"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <FieldError message={errors.secType} />
        </label>

        <label className="deals_create_label deal_step_close_date_wrap">
          <span className="form_label_toolbar">
            <span>Close date</span>
            <FormTooltip
              label="About close date"
              content={
                <p>
                  Select the target or expected closing date for this deal, if
                  known. You can leave it blank and update later.
                </p>
              }
            />
          </span>
          <input
            type="date"
            className="deals_create_input"
            value={draft.closeDate}
            onChange={(e) => onChange({ closeDate: e.target.value })}
            aria-describedby="close-date-hint"
          />
          <span id="close-date-hint" className="deal_step_date_hint">
            Select a date
          </span>
        </label>

        <div className="deals_create_label_full deal_step_owning_block">
          <FieldInfoHeading
            titleId="deal-owning-entity-heading"
            label="Owning entity name"
            required
            infoContent={
              <p>
                If your entity has not been set up yet, you may enter a
                placeholder name. This can be updated later.
              </p>
            }
          />
          <input
            id="deal-owning-entity-input"
            className="deals_create_input"
            value={draft.owningEntityName}
            onChange={(e) => onChange({ owningEntityName: e.target.value })}
            placeholder="e.g. Deal name LLC"
            aria-labelledby="deal-owning-entity-heading"
            aria-invalid={Boolean(errors.owningEntityName)}
          />
          <FieldError message={errors.owningEntityName} />
        </div>

        <div className="deals_create_label_full deal_step_ruled_section">
          <YesNoRadios
            name="fundsBeforeGp"
            titleId="deal-funds-before-gp-heading"
            required
            label="Funds must be received before GP countersigns"
            infoContent={
              <p>
                Send wire instructions & confirm wire only after investors sign
                their subscription documents.
              </p>
            }
            value={draft.fundsBeforeGpCountersigns}
            onChange={(v) => onChange({ fundsBeforeGpCountersigns: v })}
            error={errors.fundsBeforeGpCountersigns}
            noIsCommon
          />
        </div>

        <div className="deals_create_label_full deal_step_ruled_section">
          <YesNoRadios
            name="autoFundingAfterGp"
            titleId="deal-auto-funding-gp-heading"
            required
            label="Automatically send funding instructions after GP countersigns"
            infoContent={
              <p>
                When enabled, investors receive funding instructions
                automatically after their subscription documents are
                countersigned by the GP.
              </p>
            }
            value={draft.autoFundingAfterGpCountersigns}
            onChange={(v) => onChange({ autoFundingAfterGpCountersigns: v })}
            error={errors.autoFundingAfterGpCountersigns}
            noIsCommon
          />
        </div>
      </div>
    </section>
  )
}
