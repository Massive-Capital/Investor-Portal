import { FileUp, X } from "lucide-react"
import { useCallback, useEffect, useId, useState } from "react"
import type { EsignEntityCategory } from "./DealEsignTemplatesTab"
import "./esign-template-upload-modal.css"

export type EsignTemplateUploadDraft = {
  file: File
  templateName: string
  includeQuestionnaire: boolean
}

function defaultTemplateName(file: File): string {
  const base = file.name.replace(/\.[^.]+$/, "").trim()
  return base || file.name
}

export interface EsignTemplateUploadModalProps {
  open: boolean
  category: EsignEntityCategory | null
  pendingFiles: File[]
  uploading: boolean
  onClose: () => void
  onConfirm: (drafts: EsignTemplateUploadDraft[]) => void | Promise<void>
}

export function EsignTemplateUploadModal({
  open,
  category,
  pendingFiles,
  uploading,
  onClose,
  onConfirm,
}: EsignTemplateUploadModalProps) {
  const formId = useId()
  const [drafts, setDrafts] = useState<EsignTemplateUploadDraft[]>([])
  const [applyQuestionnaireToAll, setApplyQuestionnaireToAll] = useState(false)

  useEffect(() => {
    if (!open) return
    setDrafts(
      pendingFiles.map((file) => ({
        file,
        templateName: defaultTemplateName(file),
        includeQuestionnaire: false,
      })),
    )
    setApplyQuestionnaireToAll(false)
  }, [open, pendingFiles])

  const updateDraft = useCallback(
    (index: number, patch: Partial<EsignTemplateUploadDraft>) => {
      setDrafts((prev) =>
        prev.map((d, i) => (i === index ? { ...d, ...patch } : d)),
      )
    },
    [],
  )

  const handleApplyQuestionnaireToAll = useCallback((checked: boolean) => {
    setApplyQuestionnaireToAll(checked)
    setDrafts((prev) =>
      prev.map((d) => ({ ...d, includeQuestionnaire: checked })),
    )
  }, [])

  const handleSubmit = useCallback(() => {
    const valid = drafts.filter((d) => d.templateName.trim())
    if (valid.length === 0) return
    void onConfirm(
      valid.map((d) => ({
        ...d,
        templateName: d.templateName.trim(),
      })),
    )
  }, [drafts, onConfirm])

  if (!open || !category) return null

  const canSubmit =
    drafts.length > 0 &&
    drafts.every((d) => d.templateName.trim()) &&
    !uploading

  return (
    <div
      className="um_modal_overlay deal_esign_upload_overlay"
      role="presentation"
      onClick={uploading ? undefined : onClose}
    >
      <div
        className="um_modal deal_esign_upload_modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${formId}-title`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="um_modal_head">
          <h2 id={`${formId}-title`} className="um_modal_title um_title_with_icon">
            <FileUp size={20} strokeWidth={2} aria-hidden />
            Upload eSign template
          </h2>
          <button
            type="button"
            className="um_modal_close"
            onClick={onClose}
            disabled={uploading}
            aria-label="Close"
          >
            <X size={20} aria-hidden />
          </button>
        </div>

        {/* <p className="deal_esign_upload_modal_desc">
          Add a template name for each document. PDFs automatically include the
          W-9 form at the end. Optionally add investor questionnaire fields in
          the Dropbox Sign editor.
        </p> */}
        <p className="deal_esign_upload_modal_category">
          Category: <strong>{category.label}</strong>
        </p>

        {drafts.length > 1 ? (
          <label className="deal_esign_upload_apply_all">
            <input
              type="checkbox"
              checked={applyQuestionnaireToAll}
              disabled={uploading}
              onChange={(e) => handleApplyQuestionnaireToAll(e.target.checked)}
            />
            <span>Add questionnaire to all documents in this upload</span>
          </label>
        ) : null}

        <ul className="deal_esign_upload_modal_list">
          {drafts.map((draft, index) => (
            <li key={`${draft.file.name}-${index}`} className="deal_esign_upload_row">
              <p className="deal_esign_upload_row_file" title={draft.file.name}>
                {draft.file.name}
              </p>
              <div className="um_field">
                <label
                  className="um_label"
                  htmlFor={`${formId}-name-${index}`}
                >
                  Template name
                </label>
                <input
                  id={`${formId}-name-${index}`}
                  type="text"
                  className="um_input"
                  value={draft.templateName}
                  disabled={uploading}
                  placeholder="e.g. Subscription agreement"
                  onChange={(e) =>
                    updateDraft(index, { templateName: e.target.value })
                  }
                />
              </div>
              <label className="deal_esign_upload_questionnaire">
                <input
                  type="checkbox"
                  checked={draft.includeQuestionnaire}
                  disabled={uploading}
                  onChange={(e) =>
                    updateDraft(index, {
                      includeQuestionnaire: e.target.checked,
                    })
                  }
                />
                <span>Include investor questionnaire fields</span>
              </label>
            </li>
          ))}
        </ul>

        <div className="um_modal_actions deal_esign_upload_modal_actions">
          <button
            type="button"
            className="um_btn um_btn_secondary"
            disabled={uploading}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="um_btn um_btn_primary"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </div>
      </div>
    </div>
  )
}
