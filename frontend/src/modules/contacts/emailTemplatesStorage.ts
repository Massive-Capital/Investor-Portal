/** Client-side persistence for email templates (until a backend exists). */

export const EMAIL_TEMPLATE_SUBJECT_MAX = 255
/** Max plain-text characters (Quill content), excluding HTML markup. */
export const EMAIL_TEMPLATE_BODY_MAX = 255
/** Stored body is semantic HTML from Quill (larger than plain-text limit). */
export const EMAIL_TEMPLATE_BODY_HTML_MAX = 200_000
/** Single attachment per template; max file size. */
export const EMAIL_TEMPLATE_ATTACHMENT_MAX_BYTES = 1024 * 1024

const STORAGE_KEY = "investor_portal_email_templates_v1"

export type EmailTemplateAttachmentStored = {
  fileName: string
  mimeType: string
  size: number
  /** Raw base64 payload (no data: prefix). */
  dataBase64: string
}

export type EmailTemplateRow = {
  id: string
  name: string
  subject: string
  body: string
  attachment: EmailTemplateAttachmentStored | null
  /** When true, template appears under Archived */
  archived?: boolean
  createdBy: string
  createdAt: string
}

function coerceRow(raw: Record<string, unknown>): EmailTemplateRow | null {
  const id = typeof raw.id === "string" ? raw.id : ""
  if (!id) return null
  const nameRaw = typeof raw.name === "string" ? raw.name.trim() : ""
  const name = nameRaw || "Untitled"
  const subject =
    typeof raw.subject === "string" ? raw.subject.slice(0, EMAIL_TEMPLATE_SUBJECT_MAX) : ""
  const body =
    typeof raw.body === "string"
      ? raw.body.slice(0, EMAIL_TEMPLATE_BODY_HTML_MAX)
      : ""
  let attachment: EmailTemplateAttachmentStored | null = null
  const att = raw.attachment
  if (att && typeof att === "object" && att !== null) {
    const o = att as Record<string, unknown>
    const fileName = typeof o.fileName === "string" ? o.fileName : ""
    const mimeType = typeof o.mimeType === "string" ? o.mimeType : ""
    const size = typeof o.size === "number" ? o.size : 0
    const dataBase64 = typeof o.dataBase64 === "string" ? o.dataBase64 : ""
    if (fileName && dataBase64)
      attachment = { fileName, mimeType, size, dataBase64 }
  }
  const createdBy =
    typeof raw.createdBy === "string" ? raw.createdBy : "—"
  const createdAt =
    typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString()
  const archived =
    typeof raw.archived === "boolean" ? raw.archived : false
  return {
    id,
    name,
    subject,
    body,
    attachment,
    archived,
    createdBy,
    createdAt,
  }
}

export function loadEmailTemplates(): EmailTemplateRow[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const out: EmailTemplateRow[] = []
    for (const item of parsed) {
      if (item && typeof item === "object") {
        const row = coerceRow(item as Record<string, unknown>)
        if (row) out.push(row)
      }
    }
    return out
  } catch {
    return []
  }
}

export function saveEmailTemplates(rows: EmailTemplateRow[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
  } catch {
    // quota / private mode
  }
}

export function appendEmailTemplate(row: EmailTemplateRow): void {
  const rows = loadEmailTemplates()
  rows.push(row)
  saveEmailTemplates(rows)
}

export function getEmailTemplateById(id: string): EmailTemplateRow | undefined {
  return loadEmailTemplates().find((r) => r.id === id)
}

/** Replaces the row with the same `id` if it exists. */
export function updateEmailTemplate(row: EmailTemplateRow): boolean {
  const rows = loadEmailTemplates()
  const idx = rows.findIndex((r) => r.id === row.id)
  if (idx === -1) return false
  rows[idx] = row
  saveEmailTemplates(rows)
  return true
}

export function fileToStoredAttachment(
  file: File,
): Promise<
  | { ok: true; data: EmailTemplateAttachmentStored }
  | { ok: false; error: string }
> {
  if (file.size > EMAIL_TEMPLATE_ATTACHMENT_MAX_BYTES) {
    return Promise.resolve({
      ok: false,
      error: "Attachment must be 1 MB or smaller.",
    })
  }
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== "string") {
        resolve({ ok: false, error: "Could not read file." })
        return
      }
      const comma = result.indexOf(",")
      const base64 = comma >= 0 ? result.slice(comma + 1) : result
      resolve({
        ok: true,
        data: {
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          dataBase64: base64,
        },
      })
    }
    reader.onerror = () =>
      resolve({ ok: false, error: "Could not read file." })
    reader.readAsDataURL(file)
  })
}

/** Build a temporary object URL for preview/download (caller should revoke). */
export function attachmentToObjectUrl(
  att: EmailTemplateAttachmentStored,
): string {
  try {
    const bin = atob(att.dataBase64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    const blob = new Blob([bytes], { type: att.mimeType })
    return URL.createObjectURL(blob)
  } catch {
    return ""
  }
}
