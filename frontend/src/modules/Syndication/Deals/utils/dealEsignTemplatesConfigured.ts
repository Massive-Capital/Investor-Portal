import type { DealEsignTemplateFileRecord } from "../api/dealsApi"

/** True when at least one template exists and every template is Dropbox Sign–ready. */
export function areDealEsignTemplatesConfigured(
  filesByCategory: Record<string, DealEsignTemplateFileRecord[]>,
): boolean {
  const files = Object.values(filesByCategory).flat()
  return areDealEsignTemplateFilesConfigured(files)
}

export function areDealEsignTemplateFilesConfigured(
  files: DealEsignTemplateFileRecord[],
): boolean {
  if (files.length === 0) return false
  return files.every((f) => f.dropboxSignStatus === "ready")
}
