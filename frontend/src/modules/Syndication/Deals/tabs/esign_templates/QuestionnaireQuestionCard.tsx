import { ChevronDown, ChevronRight, Clock, Trash2 } from "lucide-react"
import { useId, useState } from "react"
import {
  resolveQuestionForDisplay,
  type InvestorQuestionnaireQuestion,
} from "./investorQuestionnaire.types"
import {
  QUESTIONNAIRE_TYPE_OPTIONS,
  fieldTypeUsesOptions,
} from "./investorQuestionnaireFieldTypes"
import type { InvestorQuestionnaireFieldType } from "./investorQuestionnaire.types"
import { QuestionnaireToggle } from "./QuestionnaireToggle"

type QuestionnaireQuestionCardProps = {
  question: InvestorQuestionnaireQuestion
  index: number
  canEdit: boolean
  saving: boolean
  defaultExpanded?: boolean
  onToggleRequired: (questionId: string, required: boolean) => void
  onUpdateQuestion: (
    questionId: string,
    patch: Partial<
      Pick<
        InvestorQuestionnaireQuestion,
        "label" | "fieldType" | "subtext" | "required" | "options"
      >
    >,
  ) => void
  onDeleteQuestion: (question: InvestorQuestionnaireQuestion) => void
}

export function QuestionnaireQuestionCard({
  question,
  index,
  canEdit,
  saving,
  onToggleRequired,
  onUpdateQuestion,
  onDeleteQuestion,
  defaultExpanded = false,
}: QuestionnaireQuestionCardProps) {
  const q = resolveQuestionForDisplay(question)
  const [expanded, setExpanded] = useState(defaultExpanded)
  const baseId = useId()
  const labelFieldId = `${baseId}-label`
  const typeFieldId = `${baseId}-type`
  const subtextFieldId = `${baseId}-subtext`
  const requiredId = `${baseId}-required`
  const requiredLabelId = `${baseId}-required-label`
  const panelId = `${baseId}-panel`

  const disabled = !canEdit || saving
  const defaultLocked = Boolean(q.isDefault)
  const coreDisabled = disabled || defaultLocked
  const optionsLocked = defaultLocked
  const showOptions = fieldTypeUsesOptions(q.fieldType)
  const options = q.options ?? []

  return (
    <li
      className={`deal_esign_questionnaire_question_card${expanded ? " deal_esign_questionnaire_question_card_expanded" : ""}`}
    >
      <div className="deal_esign_questionnaire_question_body">
        <div className="deal_esign_questionnaire_question_summary">
          <button
            type="button"
            className="deal_esign_questionnaire_question_summary_btn"
            aria-expanded={expanded}
            aria-controls={panelId}
            onClick={() => setExpanded((v) => !v)}
          >
            <div className="deal_esign_questionnaire_question_summary_text">
              <span className="deal_esign_questionnaire_question_index">
                Question {index + 1}
              </span>
              <span className="deal_esign_questionnaire_question_title">
                {q.label}
              </span>
            </div>
            <div className="deal_esign_questionnaire_question_head_end">
              {q.isDefault ? (
                <span className="deal_esign_questionnaire_default_badge">
                  <Clock size={12} strokeWidth={2} aria-hidden />
                  Default
                </span>
              ) : null}
              {expanded ? (
                <ChevronDown
                  size={18}
                  strokeWidth={2}
                  className="deal_esign_questionnaire_question_chevron"
                  aria-hidden
                />
              ) : (
                <ChevronRight
                  size={18}
                  strokeWidth={2}
                  className="deal_esign_questionnaire_question_chevron"
                  aria-hidden
                />
              )}
            </div>
          </button>
        </div>

        {expanded ? (
          <div
            id={panelId}
            className="deal_esign_questionnaire_question_panel"
            role="region"
            aria-label={`Settings for ${q.label}`}
          >
            <div className="deal_esign_questionnaire_field">
              <label htmlFor={labelFieldId} className="deal_esign_questionnaire_field_label">
                Label
                <span className="deal_esign_questionnaire_field_required" aria-hidden>
                  *
                </span>
              </label>
              <input
                id={labelFieldId}
                type="text"
                className={`deal_esign_questionnaire_field_input${defaultLocked ? " deal_esign_questionnaire_field_input_locked" : ""}`}
                value={q.label}
                placeholder={q.label}
                disabled={coreDisabled}
                readOnly={defaultLocked}
                aria-readonly={defaultLocked}
                onChange={(e) =>
                  onUpdateQuestion(question.id, { label: e.target.value })
                }
              />
            </div>

            <div className="deal_esign_questionnaire_field">
              <label htmlFor={typeFieldId} className="deal_esign_questionnaire_field_label">
                Type
                <span className="deal_esign_questionnaire_field_required" aria-hidden>
                  *
                </span>
              </label>
              <select
                id={typeFieldId}
                className={`deal_esign_questionnaire_field_select${defaultLocked ? " deal_esign_questionnaire_field_input_locked" : ""}`}
                value={q.fieldType}
                disabled={coreDisabled}
                onChange={(e) => {
                  const fieldType = e.target.value as InvestorQuestionnaireFieldType
                  if (fieldTypeUsesOptions(fieldType)) {
                    onUpdateQuestion(question.id, {
                      fieldType,
                      options:
                        question.options?.length ? question.options : [""],
                    })
                  } else {
                    onUpdateQuestion(question.id, { fieldType, options: [] })
                  }
                }}
              >
                {QUESTIONNAIRE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {showOptions ? (
              <div className="deal_esign_questionnaire_field">
                <span className="deal_esign_questionnaire_field_label">
                  Options
                  <span className="deal_esign_questionnaire_field_required" aria-hidden>
                    *
                  </span>
                </span>
                <ol className="deal_esign_questionnaire_options_list">
                  {options.map((option, optionIndex) => (
                    <li
                      key={`${q.id}-opt-${optionIndex}`}
                      className="deal_esign_questionnaire_option_row"
                    >
                      <label
                        className="deal_esign_questionnaire_option_label"
                        htmlFor={`${q.id}-opt-input-${optionIndex}`}
                      >
                        Option {optionIndex + 1}
                        <span className="deal_esign_questionnaire_field_required" aria-hidden>
                          *
                        </span>
                      </label>
                      <div className="deal_esign_questionnaire_option_input_row">
                        {optionsLocked ? (
                          <span className="deal_esign_questionnaire_option_readonly">
                            {option}
                          </span>
                        ) : (
                          <input
                            id={`${q.id}-opt-input-${optionIndex}`}
                            type="text"
                            className="deal_esign_questionnaire_field_input deal_esign_questionnaire_option_input"
                            value={option}
                            placeholder={`Option ${optionIndex + 1}`}
                            disabled={disabled}
                            aria-label={`Option ${optionIndex + 1}`}
                            onChange={(e) => {
                              const next = [...options]
                              next[optionIndex] = e.target.value
                              onUpdateQuestion(question.id, { options: next })
                            }}
                          />
                        )}
                        {canEdit && !optionsLocked && options.length > 1 ? (
                          <button
                            type="button"
                            className="deal_esign_questionnaire_option_remove"
                            disabled={disabled}
                            aria-label={`Remove option ${optionIndex + 1}`}
                            onClick={() => {
                              const next = options.filter((_, i) => i !== optionIndex)
                              onUpdateQuestion(question.id, { options: next })
                            }}
                          >
                            <Trash2 size={14} strokeWidth={2} aria-hidden />
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
                {canEdit && !optionsLocked ? (
                  <button
                    type="button"
                    className="deal_esign_questionnaire_option_add"
                    disabled={disabled}
                    onClick={() =>
                      onUpdateQuestion(question.id, {
                        options: [...options, ""],
                      })
                    }
                  >
                    + Add option
                  </button>
                ) : null}
              </div>
            ) : null}

            <div className="deal_esign_questionnaire_field">
              <label htmlFor={subtextFieldId} className="deal_esign_questionnaire_field_label">
                Subtext
              </label>
              <input
                id={subtextFieldId}
                type="text"
                className="deal_esign_questionnaire_field_input"
                value={q.subtext ?? ""}
                placeholder="Enter subtext"
                disabled={disabled}
                onChange={(e) =>
                  onUpdateQuestion(question.id, { subtext: e.target.value })
                }
              />
            </div>

            <div className="deal_esign_questionnaire_question_foot">
              <div className="deal_esign_questionnaire_required_row">
                <span
                  id={requiredLabelId}
                  className="deal_esign_questionnaire_required_label"
                >
                  Required
                </span>
                <QuestionnaireToggle
                  id={requiredId}
                  labelId={requiredLabelId}
                  checked={q.required}
                  disabled={coreDisabled}
                  compact
                  onChange={(required) => onToggleRequired(question.id, required)}
                />
              </div>
              {canEdit && !q.isDefault ? (
                <button
                  type="button"
                  className="deal_esign_questionnaire_delete_btn"
                  disabled={disabled}
                  onClick={() => onDeleteQuestion(question)}
                >
                  <Trash2 size={14} strokeWidth={2} aria-hidden />
                  Delete
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="deal_esign_questionnaire_question_collapsed_foot">
            <div className="deal_esign_questionnaire_required_row">
              <span
                id={requiredLabelId}
                className="deal_esign_questionnaire_required_label"
              >
                Required
              </span>
              <QuestionnaireToggle
                id={requiredId}
                labelId={requiredLabelId}
                checked={q.required}
                disabled={coreDisabled}
                compact
                onChange={(required) => onToggleRequired(question.id, required)}
              />
            </div>
          </div>
        )}
      </div>
    </li>
  )
}
