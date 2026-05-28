import { Eye, FileCheck, FilePen, Pencil, Trash2 } from "lucide-react"
import { useCallback, useState } from "react"
import { toast } from "@/common/components/Toast"
import {
  dealAssetRelativePathToUploadsUrl,
  normalizeDealGallerySrc,
} from "@/common/utils/apiBaseUrl"
import {
  fetchDealEsignTemplateViewUrl,
  type DealEsignTemplateFileRecord,
} from "@/modules/Syndication/Deals/api/dealsApi"
import type { EsignEntityCategory } from "./esignEntityCategories"
import { esignTemplateDisplayName } from "../../utils/esignTemplateDisplay"

function isPdfFileName(name: string): boolean {
  return name.toLowerCase().endsWith(".pdf")
}

function esignFileViewUrl(relativePath: string): string {
  return normalizeDealGallerySrc(dealAssetRelativePathToUploadsUrl(relativePath))
}

function statusLabel(file: DealEsignTemplateFileRecord): string {
  if (file.dropboxSignStatus === "ready") return "Ready"
  if (file.dropboxSignStatus === "draft") return "Setup incomplete — click Edit"
  return "Not configured"
}

export function EsignProfileTemplateEmptyRow({
  category,
  showStatusColumn,
}: {
  category: EsignEntityCategory
  showStatusColumn: boolean
}) {
  return (
    <tr className="deal_esign_profiles_row deal_esign_profiles_row_empty">
      <th scope="row" className="deal_esign_profiles_cell_profile">
        {category.label}
      </th>
      <td className="deal_esign_profiles_cell_muted" colSpan={showStatusColumn ? 4 : 3}>
        No template
      </td>
    </tr>
  )
}

function EsignProfileTemplateFileRow({
  category,
  dealId,
  file,
  canManageDocuments,
  uploading,
  savingTemplate,
  dropboxSignConfigured,
  onRemove,
  onEditTemplate,
}: {
  category: EsignEntityCategory
  dealId: string
  file: DealEsignTemplateFileRecord
  canManageDocuments: boolean
  uploading: boolean
  savingTemplate: boolean
  dropboxSignConfigured: boolean
  onRemove: () => void
  onEditTemplate: () => void
}) {
  const isPdf = isPdfFileName(file.originalName)
  const ready = file.dropboxSignStatus === "ready"
  const notConfigured =
    !file.dropboxSignStatus || file.dropboxSignStatus === "none"
  const actionLabel = notConfigured ? "Configure" : "Edit"
  const staticViewUrl = esignFileViewUrl(file.relativePath)
  const displayName = esignTemplateDisplayName(file)
  const showFileName =
    file.originalName.trim() &&
    displayName.toLowerCase() !== file.originalName.trim().toLowerCase()
  const hasIncludes = file.includesW9Appendix || file.includeQuestionnaire

  const [openingView, setOpeningView] = useState(false)

  const handleView = useCallback(async () => {
    setOpeningView(true)
    try {
      const result = await fetchDealEsignTemplateViewUrl(dealId, file.id)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      const url = normalizeDealGallerySrc(result.viewUrl) || staticViewUrl
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer")
      } else {
        toast.error("Preview URL is not available")
      }
    } finally {
      setOpeningView(false)
    }
  }, [dealId, file.id, staticViewUrl])

  const canView = Boolean(staticViewUrl) || isPdf

  return (
    <tr className="deal_esign_profiles_row">
      <th scope="row" className="deal_esign_profiles_cell_profile" title={category.label}>
        {category.label}
      </th>
      <td className="deal_esign_profiles_cell_name">
        <span className="deal_esign_file_name" title={displayName}>
          {displayName}
        </span>
        {showFileName ? (
          <span className="deal_esign_file_original" title={file.originalName}>
            {file.originalName}
          </span>
        ) : null}
      </td>
      <td className="deal_esign_profiles_cell_includes">
        {hasIncludes ? (
          <div className="deal_esign_doc_badges">
            {file.includesW9Appendix ? (
              <span className="deal_esign_file_badge deal_esign_file_badge_w9">+ W-9</span>
            ) : null}
            {file.includeQuestionnaire ? (
              <span className="deal_esign_file_badge">Questionnaire</span>
            ) : null}
          </div>
        ) : (
          <span className="deal_esign_doc_muted">—</span>
        )}
      </td>
      {canManageDocuments ? (
        <td className="deal_esign_profiles_cell_status">
          <span
            className={`deal_esign_file_status deal_esign_file_status_${file.dropboxSignStatus ?? "none"}`}
          >
            {ready ? (
              <FileCheck size={12} strokeWidth={2} aria-hidden />
            ) : (
              <FilePen size={12} strokeWidth={2} aria-hidden />
            )}
            {statusLabel(file)}
          </span>
        </td>
      ) : null}
      <td className="deal_esign_profiles_cell_actions">
        <div className="deal_esign_file_actions">
          {canView ? (
            <button
              type="button"
              className="deal_esign_file_action deal_esign_file_action_view"
              disabled={uploading || savingTemplate || openingView}
              aria-label={`View ${file.originalName}`}
              onClick={() => void handleView()}
            >
              <Eye size={14} strokeWidth={2} aria-hidden />
              {openingView ? "Opening…" : "View"}
            </button>
          ) : null}
          {canManageDocuments ? (
            <>
              {dropboxSignConfigured && isPdf ? (
                <button
                  type="button"
                  className="deal_esign_file_action deal_esign_file_action_edit"
                  disabled={uploading || savingTemplate}
                  title={
                    ready
                      ? undefined
                      : notConfigured
                        ? "Open Dropbox Sign editor to configure this template"
                        : "Open Dropbox Sign editor to place fields"
                  }
                  aria-label={`${actionLabel} ${displayName}`}
                  onClick={onEditTemplate}
                >
                  <Pencil size={14} strokeWidth={2} aria-hidden />
                  {actionLabel}
                </button>
              ) : null}
              {!dropboxSignConfigured && isPdf ? (
                <span
                  className="deal_esign_file_hint"
                  title="Configure Dropbox Sign in backend .env"
                >
                  Dropbox Sign not configured
                </span>
              ) : null}
              <button
                type="button"
                className="deal_esign_file_action deal_esign_file_action_delete"
                disabled={uploading || savingTemplate}
                aria-label={`Delete ${file.originalName}`}
                onClick={onRemove}
              >
                <Trash2 size={14} strokeWidth={2} aria-hidden />
                Delete
              </button>
            </>
          ) : null}
        </div>
      </td>
    </tr>
  )
}

export function EsignProfileTemplateRow({
  category,
  dealId,
  file,
  canManageDocuments,
  uploading,
  savingTemplate,
  dropboxSignConfigured,
  onRemove,
  onEditTemplate,
}: {
  category: EsignEntityCategory
  dealId: string
  file: DealEsignTemplateFileRecord | null
  canManageDocuments: boolean
  uploading: boolean
  savingTemplate: boolean
  dropboxSignConfigured: boolean
  onRemove: () => void
  onEditTemplate: () => void
}) {
  if (!file) {
    return (
      <EsignProfileTemplateEmptyRow
        category={category}
        showStatusColumn={canManageDocuments}
      />
    )
  }

  return (
    <EsignProfileTemplateFileRow
      category={category}
      dealId={dealId}
      file={file}
      canManageDocuments={canManageDocuments}
      uploading={uploading}
      savingTemplate={savingTemplate}
      dropboxSignConfigured={dropboxSignConfigured}
      onRemove={onRemove}
      onEditTemplate={onEditTemplate}
    />
  )
}
