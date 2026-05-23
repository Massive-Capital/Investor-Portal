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

export function EsignTemplateFileRow({
  dealId,
  file,
  canManageDocuments,
  uploading,
  savingTemplate,
  dropboxSignConfigured,
  onRemove,
  onEditTemplate,
}: {
  dealId: string
  file: DealEsignTemplateFileRecord
  /** Lead sponsor: upload, edit template, delete. Other roles: view only. */
  canManageDocuments: boolean
  uploading: boolean
  savingTemplate: boolean
  dropboxSignConfigured: boolean
  onRemove: () => void
  onEditTemplate: () => void
}) {
  const isPdf = isPdfFileName(file.originalName)
  const ready = file.dropboxSignStatus === "ready"
  const staticViewUrl = esignFileViewUrl(file.relativePath)
  const displayName = esignTemplateDisplayName(file)
  const showFileName =
    file.originalName.trim() &&
    displayName.toLowerCase() !== file.originalName.trim().toLowerCase()

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
    <li className="deal_esign_file_row">
      <div className="deal_esign_file_main">
        <span className="deal_esign_file_name" title={displayName}>
          {displayName}
        </span>
        {showFileName ? (
          <span className="deal_esign_file_original" title={file.originalName}>
            {file.originalName}
          </span>
        ) : null}
        {file.includesW9Appendix ? (
          <span className="deal_esign_file_badge deal_esign_file_badge_w9">
            + W-9
          </span>
        ) : null}
        {file.includeQuestionnaire ? (
          <span className="deal_esign_file_badge">Questionnaire</span>
        ) : null}
        {canManageDocuments ? (
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
        ) : null}
      </div>
      <div className="deal_esign_file_actions">
        {canView ? (
          <button
            type="button"
            className="deal_esign_file_action deal_esign_file_action_view"
            disabled={uploading || savingTemplate || openingView}
            aria-label={`View ${file.originalName}`}
            onClick={(e) => {
              e.stopPropagation()
              void handleView()
            }}
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
                onClick={(e) => {
                  e.stopPropagation()
                  onEditTemplate()
                }}
              >
                <Pencil size={14} strokeWidth={2} aria-hidden />
                Edit
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
              onClick={(e) => {
                e.stopPropagation()
                onRemove()
              }}
            >
              <Trash2 size={14} strokeWidth={2} aria-hidden />
            </button>
          </>
        ) : null}
      </div>
    </li>
  )
}
