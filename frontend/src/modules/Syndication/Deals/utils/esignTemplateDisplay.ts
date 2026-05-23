import type { DealEsignTemplateFileRecord } from "../api/dealsApi"

/** Label shown in lists, send-esign modal, and Dropbox Sign title default. */
export function esignTemplateDisplayName(
  file: Pick<
    DealEsignTemplateFileRecord,
    "templateName" | "dropboxSignTitle" | "originalName"
  >,
): string {
  const name =
    file.templateName?.trim() ||
    file.dropboxSignTitle?.trim() ||
    file.originalName?.trim()
  return name || "Document"
}
