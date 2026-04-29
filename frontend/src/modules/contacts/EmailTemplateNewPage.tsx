import {
  ArrowLeft,
  LayoutTemplate,
  Loader2,
  Save,
  Trash2,
  X,
} from "lucide-react"
import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import Quill from "quill"
import "quill/dist/quill.snow.css"
import { toast } from "../../common/components/Toast"
import { getSessionUserDisplayName } from "../../common/auth/sessionUserDisplayName"
import "../../common/components/work_in_progress_page.css"
import "../../modules/usermanagement/user_management.css"
import "../Syndication/InvestorPortal/Deals/deal-offering-details.css"
import "../Syndication/InvestorPortal/Deals/deals-create.css"
import "../Syndication/InvestorPortal/Deals/deals-list.css"
import "./contacts.css"
import {
  appendEmailTemplate,
  EMAIL_TEMPLATE_ATTACHMENT_MAX_BYTES,
  EMAIL_TEMPLATE_BODY_HTML_MAX,
  EMAIL_TEMPLATE_BODY_MAX,
  EMAIL_TEMPLATE_SUBJECT_MAX,
  fileToStoredAttachment,
  getEmailTemplateById,
  updateEmailTemplate,
  type EmailTemplateAttachmentStored,
} from "./emailTemplatesStorage"

function removeQuillSnowArtifacts(host: HTMLDivElement | null): void {
  if (!host) return
  const wrap = host.parentElement
  if (wrap) {
    for (const el of wrap.querySelectorAll(":scope > .ql-toolbar")) {
      el.remove()
    }
  }
  host.classList.remove("ql-container", "ql-snow", "ql-bubble", "ql-disabled")
  host.removeAttribute("data-quill-id")
  host.innerHTML = ""
}

export default function EmailTemplateNewPage() {
  const { templateId } = useParams<{ templateId: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(templateId)
  const existingRow = useMemo(
    () => (templateId ? getEmailTemplateById(templateId) : undefined),
    [templateId],
  )

  const [name, setName] = useState("")
  const [subject, setSubject] = useState("")
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  /** When true, a stored attachment (edit mode) is cleared and not kept on save. */
  const [stripStoredAttachment, setStripStoredAttachment] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [bodyPlainLen, setBodyPlainLen] = useState(0)

  const editorRef = useRef<HTMLDivElement>(null)
  const quillRef = useRef<Quill | null>(null)

  useEffect(() => {
    if (!templateId) return
    if (!getEmailTemplateById(templateId)) {
      toast.error("Template not found", "It may have been removed.")
      navigate("/contacts/email-templates", { replace: true })
    }
  }, [templateId, navigate])

  useEffect(() => {
    if (!existingRow) return
    setName(existingRow.name)
    setSubject(existingRow.subject)
    setAttachmentFile(null)
    setStripStoredAttachment(false)
  }, [existingRow?.id])

  useEffect(() => {
    const editorEl = editorRef.current
    if (!editorEl) return
    if (isEdit && (!templateId || !getEmailTemplateById(templateId))) return

    removeQuillSnowArtifacts(editorEl)

    const quill = new Quill(editorEl, {
      theme: "snow",
      modules: {
        toolbar: [
          [{ font: [] }, { size: [] }],
          [{ header: [1, 2, 3, false] }],
          ["bold", "italic", "underline", "strike"],
          [{ color: [] }, { background: [] }],
          [{ align: [] }],
          [{ list: "ordered" }, { list: "bullet" }],
          [{ indent: "-1" }, { indent: "+1" }],
          ["link", "image", "video"],
          ["blockquote", "code-block"],
          ["clean"],
        ],
      },
      placeholder: "Email body…",
    })

    if (isEdit && templateId) {
      const row = getEmailTemplateById(templateId)
      const bodyHtml = row?.body?.trim() ? row?.body : ""
      if (bodyHtml) {
        try {
          const delta = quill.clipboard.convert({ html: bodyHtml })
          quill.setContents(delta, "silent")
        } catch {
          quill.setText("")
        }
      }
    }

    const updatePlainLen = () => {
      const t = quill.getText().replace(/\n$/, "").trim()
      setBodyPlainLen(t.length)
    }
    updatePlainLen()

    quill.on("text-change", updatePlainLen)
    quillRef.current = quill

    return () => {
      quill.off("text-change", updatePlainLen)
      quillRef.current = null
      removeQuillSnowArtifacts(editorRef.current)
    }
  }, [isEdit, templateId])

  const removeAttachment = useCallback(() => {
    if (attachmentFile) {
      setAttachmentFile(null)
      return
    }
    if (isEdit && existingRow?.attachment) {
      setStripStoredAttachment(true)
    }
  }, [attachmentFile, isEdit, existingRow?.attachment])

  const onAttachmentChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      const file = files?.[0] ?? null
      e.target.value = ""
      if (!file) return
      if (file.size > EMAIL_TEMPLATE_ATTACHMENT_MAX_BYTES) {
        toast.error(
          "File too large",
          `Choose a file up to ${EMAIL_TEMPLATE_ATTACHMENT_MAX_BYTES / 1024 / 1024} MB.`,
        )
        return
      }
      setAttachmentFile(file)
      setStripStoredAttachment(false)
    },
    [],
  )

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      const trimmedName = name.trim()
      if (!trimmedName) {
        toast.error("Name required", "Enter a template name.")
        return
      }
      if (subject.length > EMAIL_TEMPLATE_SUBJECT_MAX) {
        toast.error(
          "Subject too long",
          `Use at most ${EMAIL_TEMPLATE_SUBJECT_MAX} characters.`,
        )
        return
      }
      const quill = quillRef.current
      if (!quill) {
        toast.error("Editor not ready", "Please wait a moment and try again.")
        return
      }
      const plain = quill.getText().replace(/\n$/, "").trim()
      if (plain.length > EMAIL_TEMPLATE_BODY_MAX) {
        toast.error(
          "Body too long",
          `Use at most ${EMAIL_TEMPLATE_BODY_MAX} characters of text.`,
        )
        return
      }
      const len = quill.getLength()
      const html =
        len <= 1 && !quill.getText().trim()
          ? ""
          : quill.getSemanticHTML(0, Math.max(0, len - 1))

      setSubmitting(true)
      try {
        if (isEdit && templateId) {
          const current = getEmailTemplateById(templateId)
          if (!current) {
            toast.error("Template not found", "It may have been removed.")
            return
          }
          let attachment: EmailTemplateAttachmentStored | null = null
          if (attachmentFile) {
            const result = await fileToStoredAttachment(attachmentFile)
            if (!result.ok) {
              toast.error("Attachment", result.error)
              return
            }
            attachment = result.data
          } else if (current.attachment && !stripStoredAttachment) {
            attachment = current.attachment
          }
          const ok = updateEmailTemplate({
            ...current,
            name: trimmedName,
            subject: subject.slice(0, EMAIL_TEMPLATE_SUBJECT_MAX),
            body: html.slice(0, EMAIL_TEMPLATE_BODY_HTML_MAX),
            attachment,
          })
          if (!ok) {
            toast.error("Could not save", "Template was not found.")
            return
          }
          toast.success("Template updated", trimmedName)
        } else {
          let attachment: EmailTemplateAttachmentStored | null = null
          if (attachmentFile) {
            const result = await fileToStoredAttachment(attachmentFile)
            if (!result.ok) {
              toast.error("Attachment", result.error)
              return
            }
            attachment = result.data
          }
          const id =
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : `tpl-${Date.now()}`
          appendEmailTemplate({
            id,
            name: trimmedName,
            subject: subject.slice(0, EMAIL_TEMPLATE_SUBJECT_MAX),
            body: html.slice(0, EMAIL_TEMPLATE_BODY_HTML_MAX),
            attachment,
            archived: false,
            createdBy: getSessionUserDisplayName().trim() || "—",
            createdAt: new Date().toISOString(),
          })
          toast.success("Template saved", trimmedName)
        }
        navigate("/contacts/email-templates")
      } finally {
        setSubmitting(false)
      }
    },
    [
      attachmentFile,
      isEdit,
      name,
      navigate,
      stripStoredAttachment,
      subject,
      templateId,
    ],
  )

  const cancel = useCallback(() => {
    navigate("/contacts/email-templates")
  }, [navigate])

  const hasStoredAttachmentVisible =
    isEdit && Boolean(existingRow?.attachment) && !stripStoredAttachment
  const showAttachmentChosen =
    Boolean(attachmentFile) || hasStoredAttachmentVisible

  const formTitle = isEdit ? "Edit email template" : "New email template"
  const formTitleId = "email-template-form-title"

  return (
    <section
      className="um_page deals_list_page deals_detail_page deals_add_investor_class_page deals_add_deal_asset_page contacts_page email_templates_page email_template_new_page"
      aria-labelledby={formTitleId}
    >
      <header className="deals_list_head deals_add_investor_class_page_head">
        <div className="deals_add_deal_asset_head_main">
          <div className="deals_list_title_row deals_add_deal_asset_title_row">
            <Link
              to="/contacts/email-templates"
              className="deals_list_back_circle"
              aria-label="Back to email templates"
            >
              <ArrowLeft size={20} strokeWidth={2} aria-hidden />
            </Link>
            <div className="deals_add_deal_asset_title_stack">
              <h1
                id={formTitleId}
                className="deals_list_title email_template_new_title"
              >
                <LayoutTemplate
                  className="email_template_new_title_icon"
                  size={22}
                  strokeWidth={1.75}
                  aria-hidden
                />
                {formTitle}
              </h1>
            </div>
          </div>
        </div>
      </header>

      <form
        className="um_panel um_members_tab_panel deal_inv_table_panel contacts_table_panel email_template_new_form"
        onSubmit={handleSubmit}
        noValidate
      >
        <div className="um_field">
          <label
            className="um_field_label_row"
            htmlFor="email-template-form-name"
          >
            Template name *
          </label>
          <input
            id="email-template-form-name"
            type="text"
            className="um_input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
            required
            aria-required
          />
        </div>

        <div className="um_field">
          <div className="email_template_new_label_row">
            <label
              className="um_field_label_row"
              htmlFor="email-template-form-subject"
            >
              Subject
            </label>
            <span className="email_template_char_count" aria-live="polite">
              {subject.length}/{EMAIL_TEMPLATE_SUBJECT_MAX}
            </span>
          </div>
          <input
            id="email-template-form-subject"
            type="text"
            className="um_input"
            value={subject}
            maxLength={EMAIL_TEMPLATE_SUBJECT_MAX}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>

        <div className="um_field email_template_body_field">
          <div className="email_template_new_label_row">
            <span
              className="um_field_label_row"
              id="email-template-form-body-label"
            >
              Body
            </span>
            <span className="email_template_char_count" aria-live="polite">
              {bodyPlainLen}/{EMAIL_TEMPLATE_BODY_MAX}
            </span>
          </div>
          <div
            className="deal_offering_quill"
            aria-labelledby="email-template-form-body-label"
          >
            <div ref={editorRef} className="deal_offering_quill_editor_host" />
          </div>
        </div>

        <div className="um_field email_template_attachment_field">
          <span className="um_field_label_row">Attachment</span>
          <p className="um_hint email_template_field_hint">
            One file, maximum {EMAIL_TEMPLATE_ATTACHMENT_MAX_BYTES / 1024 / 1024} MB.
          </p>
          {!showAttachmentChosen ? (
            <label className="email_template_attachment_upload_btn">
              <input
                type="file"
                className="email_template_attachment_input_hidden"
                onChange={onAttachmentChange}
                aria-label="Choose attachment file"
              />
              <span className="um_btn_secondary">Choose file</span>
            </label>
          ) : (
            <div className="email_template_attachment_chosen">
              <span
                className="email_template_attachment_name"
                title={
                  attachmentFile
                    ? attachmentFile.name
                    : (existingRow?.attachment?.fileName ?? "")
                }
              >
                {attachmentFile
                  ? attachmentFile.name
                  : (existingRow?.attachment?.fileName ?? "")}
              </span>
              <span className="email_template_attachment_size" aria-hidden>
                {attachmentFile ? (
                  <>({(attachmentFile.size / 1024).toFixed(1)} KB)</>
                ) : existingRow?.attachment ? (
                  <>({(existingRow.attachment.size / 1024).toFixed(1)} KB)</>
                ) : null}
              </span>
              <button
                type="button"
                className="contacts_table_icon_action_btn email_template_attachment_remove"
                onClick={removeAttachment}
                aria-label="Remove attachment"
              >
                <Trash2 size={17} strokeWidth={2} aria-hidden />
              </button>
            </div>
          )}
        </div>

        <div className="email_template_new_actions um_modal_actions">
          <button
            type="button"
            className="um_btn_secondary"
            onClick={cancel}
            disabled={submitting}
          >
            <X size={16} strokeWidth={2} aria-hidden />
            Cancel
          </button>
          <button type="submit" className="um_btn_primary" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2
                  size={16}
                  strokeWidth={2}
                  className="email_template_new_btn_spin"
                  aria-hidden
                />
                Saving…
              </>
            ) : isEdit ? (
              <>
                <Save size={16} strokeWidth={2} aria-hidden />
                Save changes
              </>
            ) : (
              <>
                <Save size={16} strokeWidth={2} aria-hidden />
                Save template
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  )
}
