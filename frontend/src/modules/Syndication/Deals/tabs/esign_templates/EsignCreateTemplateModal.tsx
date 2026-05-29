import {
  ClipboardList,
  CloudUpload,
  FileText,
  FileUp,
  FolderOpen,
  Loader2,
  Type,
  Users,
  X,
} from "lucide-react"
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from "react"
import type { LucideIcon } from "lucide-react"
import { createPortal } from "react-dom"
import { toast } from "@/common/components/Toast"
import { OFFERING_PREVIEW_SECTIONS_CHANGED_EVENT } from "../../utils/offeringPreviewDocSections"
import { applyOfferingInvestorPreviewJsonFromServer } from "../../utils/offeringPreviewServerState"
import type { EsignEntityCategory } from "./esignEntityCategories"
import {
  dealHasAnySectionDocuments,
  fetchDealDocumentAsPdfFile,
  listDealPdfDocumentsForEsignTemplate,
  type DealDocumentPickOption,
} from "./esignCreateTemplateDocumentSources"
import "../investors/add-investment-modal.css"
import "./esign-template-upload-modal.css"

export type EsignCreateTemplateSubmit = {
  categoryId: string
  file: File
  templateName: string
  includeQuestionnaire: boolean
}

type DocumentSourceMode = "upload" | "deal"

const UPLOAD_ACCEPT = ".pdf,application/pdf"

function defaultTemplateName(file: File): string {
  const base = file.name.replace(/\.[^.]+$/, "").trim()
  return base || file.name
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileExtensionLabel(name: string): string {
  const ext = name.split(".").pop()?.trim().toUpperCase() ?? ""
  return ext || "FILE"
}

function DocumentUploadZone({
  id,
  file,
  disabled,
  inputRef,
  onPickClick,
  onFileChange,
}: {
  id: string
  file: File | null
  disabled: boolean
  inputRef: RefObject<HTMLInputElement | null>
  onPickClick: () => void
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void
}) {
  const ext = file ? fileExtensionLabel(file.name) : null
  const sizeLabel = file ? formatFileSize(file.size) : null

  return (
    <div className="deal_esign_doc_upload">
      <input
        ref={inputRef}
        id={id}
        type="file"
        className="visually_hidden"
        accept={UPLOAD_ACCEPT}
        disabled={disabled}
        onChange={onFileChange}
      />
      <button
        type="button"
        className={`deal_esign_doc_upload_zone${file ? " deal_esign_doc_upload_zone--selected" : ""}`}
        disabled={disabled}
        aria-labelledby={`${id}-label`}
        onClick={onPickClick}
      >
        {!file ? (
          <span className="deal_esign_doc_upload_empty">
            <span className="deal_esign_doc_upload_icon_ring" aria-hidden>
              <CloudUpload size={22} strokeWidth={1.75} />
            </span>
            <span id={`${id}-label`} className="deal_esign_doc_upload_title">
              Upload from your computer
            </span>
            <span className="deal_esign_doc_upload_sub">
              Click to browse or drop a PDF here
            </span>
            <span className="deal_esign_doc_upload_formats" aria-hidden>
              <span className="deal_esign_doc_format_chip">PDF</span>
            </span>
          </span>
        ) : (
          <span className="deal_esign_doc_upload_selected">
            <span className="deal_esign_doc_upload_file_icon_ring" aria-hidden>
              <FileText size={20} strokeWidth={1.75} />
            </span>
            <span className="deal_esign_doc_upload_file_copy">
              <span id={`${id}-label`} className="deal_esign_doc_upload_file_name" title={file.name}>
                {file.name}
              </span>
              <span className="deal_esign_doc_upload_file_meta">
                {ext ? (
                  <span className="deal_esign_doc_format_chip deal_esign_doc_format_chip--filled">
                    {ext}
                  </span>
                ) : null}
                {sizeLabel ? (
                  <span className="deal_esign_doc_upload_file_size">{sizeLabel}</span>
                ) : null}
              </span>
            </span>
            <span className="deal_esign_doc_upload_change">Change</span>
          </span>
        )}
      </button>
    </div>
  )
}

function DocumentSourceToggle({
  value,
  disabled,
  hasDealDocuments,
  onChange,
}: {
  value: DocumentSourceMode
  disabled: boolean
  hasDealDocuments: boolean
  onChange: (mode: DocumentSourceMode) => void
}) {
  return (
    <div
      className="deal_esign_doc_source_toggle"
      role="radiogroup"
      aria-label="Document source"
    >
      <button
        type="button"
        role="radio"
        aria-checked={value === "deal"}
        className={`deal_esign_doc_source_toggle_btn${
          value === "deal" ? " deal_esign_doc_source_toggle_btn--active" : ""
        }`}
        disabled={disabled || !hasDealDocuments}
        onClick={() => onChange("deal")}
      >
        <FolderOpen size={16} strokeWidth={2} aria-hidden />
        Deal documents
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={value === "upload"}
        className={`deal_esign_doc_source_toggle_btn${
          value === "upload" ? " deal_esign_doc_source_toggle_btn--active" : ""
        }`}
        disabled={disabled}
        onClick={() => onChange("upload")}
      >
        <CloudUpload size={16} strokeWidth={2} aria-hidden />
        My computer
      </button>
    </div>
  )
}

function DealDocumentPicker({
  id,
  options,
  value,
  disabled,
  onChange,
}: {
  id: string
  options: DealDocumentPickOption[]
  value: string
  disabled: boolean
  onChange: (documentId: string) => void
}) {
  if (options.length === 0) {
    return (
      <p className="deal_esign_doc_deal_empty" id={id}>
        No PDFs available from the deal <strong>Documents</strong> tab. Upload a PDF
        there, or choose <strong>My computer</strong> above.
      </p>
    )
  }

  return (
    <>
      <select
        id={id}
        className="um_field_select deals_add_inv_field_control deal_esign_doc_deal_select"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select a document…</option>
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.sectionLabel} — {opt.name}
          </option>
        ))}
      </select>
      {value ? (
        <p className="deal_esign_create_field_hint deal_esign_doc_deal_selected_hint">
          Uses the PDF stored on this deal&apos;s Documents tab.
        </p>
      ) : null}
    </>
  )
}

function CreateTemplateField({
  id,
  label,
  Icon,
  children,
  hint,
}: {
  id: string
  label: string
  Icon: LucideIcon
  children: ReactNode
  hint?: string
}) {
  return (
    <div className="um_field add_contact_field_tight deal_esign_create_field">
      <label htmlFor={id} className="um_field_label_row">
        <Icon className="um_field_label_icon" size={17} strokeWidth={2} aria-hidden />
        <span>{label}</span>
      </label>
      {children}
      {hint ? <p className="deal_esign_create_field_hint">{hint}</p> : null}
    </div>
  )
}

export interface EsignCreateTemplateModalProps {
  open: boolean
  dealId: string
  offeringInvestorPreviewJson?: string | null
  categories: EsignEntityCategory[]
  uploading: boolean
  onClose: () => void
  onConfirm: (data: EsignCreateTemplateSubmit) => void | Promise<void>
}

export function EsignCreateTemplateModal({
  open,
  dealId,
  offeringInvestorPreviewJson,
  categories,
  uploading,
  onClose,
  onConfirm,
}: EsignCreateTemplateModalProps) {
  const formId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [categoryId, setCategoryId] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [templateName, setTemplateName] = useState("")
  const [includeQuestionnaire, setIncludeQuestionnaire] = useState(false)
  const [documentSource, setDocumentSource] = useState<DocumentSourceMode>("upload")
  const [dealDocuments, setDealDocuments] = useState<DealDocumentPickOption[]>([])
  const [selectedDealDocumentId, setSelectedDealDocumentId] = useState("")
  const [resolvingDocument, setResolvingDocument] = useState(false)

  const refreshDealDocuments = useCallback(() => {
    setDealDocuments(listDealPdfDocumentsForEsignTemplate(dealId))
  }, [dealId])

  useEffect(() => {
    if (!open) return
    const id = dealId?.trim() ?? ""
    if (id) {
      applyOfferingInvestorPreviewJsonFromServer(id, offeringInvestorPreviewJson, {
        notify: false,
      })
    }
    setCategoryId(categories[0]?.id ?? "")
    setFile(null)
    setTemplateName("")
    setIncludeQuestionnaire(false)
    setSelectedDealDocumentId("")
    setResolvingDocument(false)
    refreshDealDocuments()
    setDocumentSource(dealHasAnySectionDocuments(dealId) ? "deal" : "upload")
  }, [open, categories, dealId, offeringInvestorPreviewJson, refreshDealDocuments])

  useEffect(() => {
    if (!open) return
    function onSectionsChanged() {
      refreshDealDocuments()
    }
    window.addEventListener(OFFERING_PREVIEW_SECTIONS_CHANGED_EVENT, onSectionsChanged)
    return () =>
      window.removeEventListener(OFFERING_PREVIEW_SECTIONS_CHANGED_EVENT, onSectionsChanged)
  }, [open, refreshDealDocuments])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !uploading && !resolvingDocument) onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, uploading, resolvingDocument, onClose])

  const onFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.files?.[0] ?? null
    e.target.value = ""
    setFile(next)
    if (next) setTemplateName(defaultTemplateName(next))
  }, [])

  const onDocumentSourceChange = useCallback((mode: DocumentSourceMode) => {
    setDocumentSource(mode)
    if (mode === "upload") {
      setSelectedDealDocumentId("")
    } else {
      setFile(null)
    }
  }, [])

  const onDealDocumentChange = useCallback(
    (documentId: string) => {
      setSelectedDealDocumentId(documentId)
      const picked = dealDocuments.find((d) => d.id === documentId)
      if (picked) {
        const base = picked.name.replace(/\.[^.]+$/, "").trim()
        setTemplateName(base || picked.name)
      }
    },
    [dealDocuments],
  )

  const busy = uploading || resolvingDocument

  const hasDocument =
    documentSource === "upload"
      ? Boolean(file)
      : Boolean(selectedDealDocumentId)

  const handleSubmit = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault()
      if (!hasDocument || !categoryId.trim() || !templateName.trim() || busy) return

      let submitFile = file
      if (documentSource === "deal") {
        const picked = dealDocuments.find((d) => d.id === selectedDealDocumentId)
        if (!picked) return
        setResolvingDocument(true)
        try {
          submitFile = await fetchDealDocumentAsPdfFile(picked)
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Could not load the selected document."
          toast.error("Document unavailable", message)
          return
        } finally {
          setResolvingDocument(false)
        }
      }

      if (!submitFile) return
      await onConfirm({
        categoryId,
        file: submitFile,
        templateName: templateName.trim(),
        includeQuestionnaire,
      })
    },
    [
      busy,
      categoryId,
      dealDocuments,
      documentSource,
      file,
      hasDocument,
      includeQuestionnaire,
      onConfirm,
      selectedDealDocumentId,
      templateName,
    ],
  )

  if (!open || typeof document === "undefined") return null

  const canSubmit =
    hasDocument &&
    Boolean(categoryId) &&
    Boolean(templateName.trim()) &&
    !busy

  const documentPickId = `${formId}-document-pick`
  const dealDocumentSelectId = `${formId}-deal-document`

  return createPortal(
    <div
      className="um_modal_overlay deals_add_inv_modal_overlay portal_modal_z_boost deal_esign_upload_overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div
        className="um_modal um_modal_view deals_add_inv_modal_panel add_contact_panel deal_esign_upload_modal deal_esign_create_modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${formId}-title`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="um_modal_head add_contact_modal_head">
          <h3
            id={`${formId}-title`}
            className="um_modal_title add_contact_modal_title um_title_with_icon"
          >
            <FileUp className="um_title_icon" size={20} strokeWidth={2} aria-hidden />
            <span>Create template</span>
          </h3>
          <button
            type="button"
            className="um_modal_close"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
          >
            <X size={20} strokeWidth={2} aria-hidden />
          </button>
        </div>

        <form
          className="deals_add_inv_modal_form deal_esign_create_modal_form"
          onSubmit={(e) => void handleSubmit(e)}
          noValidate
        >
          <div className="deals_add_inv_modal_scroll deal_esign_create_modal_body">
            <div className="deal_esign_create_modal_fields">
              <CreateTemplateField
                id={`${formId}-profile`}
                label="Profile"
                Icon={Users}
              >
                <select
                  id={`${formId}-profile`}
                  className="um_field_select deals_add_inv_field_control"
                  value={categoryId}
                  disabled={busy || categories.length === 0}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  {categories.length === 0 ? (
                    <option value="">No profiles available</option>
                  ) : (
                    categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.label}
                      </option>
                    ))
                  )}
                </select>
              </CreateTemplateField>

              <CreateTemplateField
                id={documentPickId}
                label="Document"
                Icon={FileText}
                hint="Choose an existing deal PDF or upload one from your computer."
              >
                <DocumentSourceToggle
                  value={documentSource}
                  disabled={busy}
                  hasDealDocuments={dealHasAnySectionDocuments(dealId)}
                  onChange={onDocumentSourceChange}
                />
                {documentSource === "deal" ? (
                  <DealDocumentPicker
                    id={dealDocumentSelectId}
                    options={dealDocuments}
                    value={selectedDealDocumentId}
                    disabled={busy}
                    onChange={onDealDocumentChange}
                  />
                ) : (
                  <DocumentUploadZone
                    id={documentPickId}
                    file={file}
                    disabled={busy}
                    inputRef={fileInputRef}
                    onPickClick={() => fileInputRef.current?.click()}
                    onFileChange={onFileChange}
                  />
                )}
              </CreateTemplateField>

              <CreateTemplateField
                id={`${formId}-name`}
                label="Template name"
                Icon={Type}
              >
                <input
                  id={`${formId}-name`}
                  type="text"
                  className="deals_add_inv_input deals_add_inv_field_control"
                  value={templateName}
                  disabled={busy}
                  placeholder="e.g. Subscription agreement"
                  onChange={(e) => setTemplateName(e.target.value)}
                />
              </CreateTemplateField>

              <label className="deal_esign_create_option_row">
                <span className="deal_esign_create_option_icon" aria-hidden>
                  <ClipboardList size={18} strokeWidth={2} />
                </span>
                <span className="deal_esign_create_option_copy">
                  <span className="deal_esign_create_option_title">
                    Include investor questionnaire signature page
                  </span>
                  <span className="deal_esign_create_option_desc">
                    Adds the questionnaire signature page to this template
                  </span>
                </span>
                <input
                  type="checkbox"
                  className="deal_esign_create_option_checkbox"
                  checked={includeQuestionnaire}
                  disabled={busy}
                  onChange={(e) => setIncludeQuestionnaire(e.target.checked)}
                />
              </label>
            </div>
          </div>

          <div className="um_modal_actions add_contact_modal_actions">
            <button
              type="button"
              className="um_btn_secondary"
              disabled={busy}
              onClick={onClose}
            >
              <X size={16} strokeWidth={2} aria-hidden />
              Cancel
            </button>
            <button
              type="submit"
              className="um_btn_primary"
              disabled={!canSubmit}
            >
              {resolvingDocument ? (
                <>
                  <Loader2
                    size={16}
                    strokeWidth={2}
                    aria-hidden
                    className="add_contact_modal_btn_spin"
                  />
                  Loading document…
                </>
              ) : uploading ? (
                <>
                  <Loader2
                    size={16}
                    strokeWidth={2}
                    aria-hidden
                    className="add_contact_modal_btn_spin"
                  />
                  Uploading…
                </>
              ) : (
                <>
                  <FileUp size={16} strokeWidth={2} aria-hidden />
                  Create template
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}
