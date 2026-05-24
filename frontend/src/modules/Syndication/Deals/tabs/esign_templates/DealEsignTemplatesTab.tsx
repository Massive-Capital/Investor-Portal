import { Upload } from "lucide-react"

import {

  useCallback,

  useEffect,

  useId,

  useRef,

  useState,

  type ChangeEvent,

  type DragEvent,

} from "react"

import { DropboxSignEmbeddedEditor } from "@/common/components/dropbox-sign-embedded"

import { toast } from "@/common/components/Toast"

import {

  deleteDealEsignTemplateFile,

  fetchDealEsignDropboxSignConfig,

  notifyDealEsignTemplatesChanged,

  postDealEsignCompleteEmbeddedTemplate,

  postDealEsignEmbeddedDraft,

  postDealEsignTemplateUploads,

  type DealEsignTemplateFileRecord,

  fetchDealEsignTemplates,

} from "@/modules/Syndication/Deals/api/dealsApi"

import { EsignTemplateDeleteConfirmModal } from "./EsignTemplateDeleteConfirmModal"
import { EsignTemplateFileRow } from "./EsignTemplateFileRow"
import {
  EsignTemplateUploadModal,
  type EsignTemplateUploadDraft,
} from "./EsignTemplateUploadModal"
import { esignTemplateDisplayName } from "../../utils/esignTemplateDisplay"
import "./deal-esign-templates.css"



export interface EsignEntityCategory {

  id: string

  label: string

}



/** Logical folder label for e-signed templates (display + future API paths). */

export const ESIGN_FOLDER_SLUG = "e-signed"



export const ESIGN_ENTITY_CATEGORIES: EsignEntityCategory[] = [

  { id: "individual", label: "Individual" },

  {

    id: "custodian_ira_401k",

    label: "Custodian IRA or custodian based 401(k)",

  },

  { id: "joint_tenancy", label: "Joint tenancy" },

  { id: "llc", label: "LLC, corp, partnership, trust, solo 401(k), or checkbook IRA" },

]



interface DealEsignTemplatesTabProps {

  dealId: string

  /** When false, upload UI is hidden (lead sponsor only). */

  canUploadDocuments?: boolean

}



type EmbeddedEditorSession = {

  fileId: string

  categoryId: string

  editUrl: string

  clientId: string

  testMode: boolean

  templateId: string

}



function EsignCategoryUploadCard({

  category,

  dealId,

  files,

  onFilesSelected,

  onRemoveFile,

  onSaveTemplate,

  canUploadDocuments,

  uploading,

  savingTemplateId,

  dropboxSignConfigured,

}: {

  category: EsignEntityCategory

  dealId: string

  files: DealEsignTemplateFileRecord[]

  onFilesSelected: (categoryId: string, list: FileList | null) => void

  onRemoveFile: (categoryId: string, fileId: string) => void

  onSaveTemplate: (categoryId: string, file: DealEsignTemplateFileRecord) => void

  canUploadDocuments: boolean

  uploading: boolean

  savingTemplateId: string | null

  dropboxSignConfigured: boolean

}) {

  const inputId = useId()

  const fileInputRef = useRef<HTMLInputElement>(null)

  const [dropFocus, setDropFocus] = useState(false)



  const accept =

    ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"



  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {

    onFilesSelected(category.id, e.target.files)

    e.target.value = ""

  }



  function handleDrop(e: DragEvent) {

    e.preventDefault()

    setDropFocus(false)

    if (e.dataTransfer.files?.length)

      onFilesSelected(category.id, e.dataTransfer.files)

  }



  const openPicker = useCallback(() => {

    if (!uploading) fileInputRef.current?.click()

  }, [uploading])



  return (

    <section

      className="deal_esign_card"

      aria-labelledby={`${inputId}-title`}

    >

      <div className="deal_esign_card_head">

        <h3 id={`${inputId}-title`} className="deal_esign_card_title">

          {category.label}

        </h3>

      </div>

      <div className="deal_esign_card_body">

        {canUploadDocuments ? (

          <>

            <input

              ref={fileInputRef}

              id={inputId}

              type="file"

              className="visually_hidden"

              accept={accept}

              multiple

              disabled={uploading}

              aria-label={`Upload documents for ${category.label}`}

              data-deal-id={dealId}

              data-esign-folder={ESIGN_FOLDER_SLUG}

              data-esign-category={category.id}

              onChange={handleFileChange}

            />

            <div

              role="button"

              tabIndex={uploading ? -1 : 0}

              className={`deal_esign_dropzone${dropFocus ? " deal_esign_dropzone_focus" : ""}${uploading ? " deal_esign_dropzone_busy" : ""}`}

              aria-disabled={uploading}

              onClick={openPicker}

              onKeyDown={(e) => {

                if (uploading) return

                if (e.key === "Enter" || e.key === " ") {

                  e.preventDefault()

                  openPicker()

                }

              }}

              onDragOver={(e) => {

                if (uploading) return

                e.preventDefault()

                setDropFocus(true)

              }}

              onDragLeave={() => setDropFocus(false)}

              onDrop={(e) => {

                if (uploading) return

                handleDrop(e)

              }}

            >

              <Upload

                className="deal_esign_dropzone_lead"

                size={20}

                strokeWidth={1.75}

                aria-hidden

              />

              <div className="deal_esign_dropzone_text">

                <span className="deal_esign_dropzone_hint">

                  {uploading ? "Uploading…" : "Drop files or click to upload"}

                </span>

                <span className="deal_esign_dropzone_sub">

                  PDFs include W-9 at the end · Word stored locally

                </span>

              </div>

            </div>

          </>

        ) : (

          <p className="deal_esign_upload_restricted" role="status">

            Only the lead sponsor can upload documents for this category.

          </p>

        )}

        {files.length > 0 ? (

          <ul className="deal_esign_file_list" aria-label={`Files for ${category.label}`}>

            {files.map((f) => (

              <EsignTemplateFileRow

                key={f.id}

                dealId={dealId}

                file={f}

                canManageDocuments={canUploadDocuments}

                uploading={uploading}

                savingTemplate={savingTemplateId === f.id}

                dropboxSignConfigured={dropboxSignConfigured}

                onRemove={() => onRemoveFile(category.id, f.id)}

                onEditTemplate={() => onSaveTemplate(category.id, f)}

              />

            ))}

          </ul>

        ) : null}

      </div>

    </section>

  )

}



export function DealEsignTemplatesTab({

  dealId,

  canUploadDocuments = true,

}: DealEsignTemplatesTabProps) {

  const [filesByCategory, setFilesByCategory] = useState<

    Record<string, DealEsignTemplateFileRecord[]>

  >({})

  const [loading, setLoading] = useState(true)

  const [uploading, setUploading] = useState(false)

  const [savingTemplateId, setSavingTemplateId] = useState<string | null>(null)

  const [dropboxSignConfigured, setDropboxSignConfigured] = useState(false)

  const [embeddedSession, setEmbeddedSession] = useState<EmbeddedEditorSession | null>(

    null,

  )

  const [uploadModalCategory, setUploadModalCategory] =
    useState<EsignEntityCategory | null>(null)

  const [uploadModalFiles, setUploadModalFiles] = useState<File[]>([])

  const [deletePending, setDeletePending] = useState<{
    fileId: string
    displayName: string
  } | null>(null)

  const reload = useCallback(async () => {

    const result = await fetchDealEsignTemplates(dealId)

    if (result.ok) {

      setFilesByCategory(result.filesByCategory)

    } else {

      toast.error("Could not load eSign templates", result.message)

    }

    return result

  }, [dealId])



  useEffect(() => {

    let cancelled = false

    void (async () => {

      setLoading(true)

      const cfg = await fetchDealEsignDropboxSignConfig()

      if (!cancelled && cfg.ok) {

        setDropboxSignConfigured(cfg.configured)

      }

      await reload()

      if (!cancelled) setLoading(false)

    })()

    return () => {

      cancelled = true

    }

  }, [reload])



  const onFilesSelected = useCallback(

    (categoryId: string, list: FileList | null) => {

      if (!canUploadDocuments || !list?.length) return

      const category = ESIGN_ENTITY_CATEGORIES.find((c) => c.id === categoryId)

      if (!category) return

      setUploadModalCategory(category)

      setUploadModalFiles(Array.from(list))

    },

    [canUploadDocuments],

  )



  const closeUploadModal = useCallback(() => {

    if (uploading) return

    setUploadModalCategory(null)

    setUploadModalFiles([])

  }, [uploading])



  const onConfirmUpload = useCallback(

    async (drafts: EsignTemplateUploadDraft[]) => {

      if (!uploadModalCategory || drafts.length === 0) return

      setUploading(true)

      try {

        const result = await postDealEsignTemplateUploads(

          dealId,

          uploadModalCategory.id,

          drafts.map((d) => ({

            file: d.file,

            meta: {

              templateName: d.templateName,

              includeQuestionnaire: d.includeQuestionnaire,

            },

          })),

        )

        if (result.ok) {

          setFilesByCategory(result.filesByCategory)

          notifyDealEsignTemplatesChanged(dealId)

          toast.success("Documents uploaded")

          setUploadModalCategory(null)

          setUploadModalFiles([])

        } else {

          toast.error("Upload failed", result.message)

        }

      } finally {

        setUploading(false)

      }

    },

    [dealId, uploadModalCategory],

  )



  const onRequestRemoveFile = useCallback(
    (_categoryId: string, fileId: string) => {
      if (!canUploadDocuments) return
      const file = Object.values(filesByCategory)
        .flat()
        .find((f) => f.id === fileId)
      if (!file) return
      setDeletePending({
        fileId,
        displayName: esignTemplateDisplayName(file),
      })
    },
    [canUploadDocuments, filesByCategory],
  )

  const onConfirmRemoveFile = useCallback(() => {
    if (!deletePending) return
    void (async () => {
      setUploading(true)
      try {
        const result = await deleteDealEsignTemplateFile(
          dealId,
          deletePending.fileId,
        )
        if (result.ok) {
          setFilesByCategory(result.filesByCategory)
          notifyDealEsignTemplatesChanged(dealId)
          setDeletePending(null)
          toast.success("Template removed")
        } else {
          toast.error("Could not remove file", result.message)
        }
      } finally {
        setUploading(false)
      }
    })()
  }, [dealId, deletePending])



  const onSaveTemplate = useCallback(

    (_categoryId: string, file: DealEsignTemplateFileRecord) => {

      if (!canUploadDocuments) return

      void (async () => {

        setSavingTemplateId(file.id)

        try {

          const draft = await postDealEsignEmbeddedDraft(dealId, file.id, {

            title: esignTemplateDisplayName(file),

          })

          if (!draft.ok) {

            toast.error("Could not open template editor", draft.message)

            return

          }

          setFilesByCategory(draft.filesByCategory)

          setEmbeddedSession({

            fileId: file.id,

            categoryId: file.categoryId,

            editUrl: draft.editUrl,

            clientId: draft.clientId,

            testMode: draft.testMode,

            templateId: draft.templateId,

          })

        } finally {

          setSavingTemplateId(null)

        }

      })()

    },

    [canUploadDocuments, dealId],

  )



  const handleEmbeddedTemplateSaved = useCallback(

    (data: { templateId: string; templateInfo?: { title?: string } }) => {

      if (!embeddedSession) return

      void (async () => {

        const result = await postDealEsignCompleteEmbeddedTemplate(

          dealId,

          embeddedSession.fileId,

          {

            dropboxSignTemplateId: data.templateId,

            title: data.templateInfo?.title,

          },

        )

        setEmbeddedSession(null)

        if (result.ok) {

          setFilesByCategory(result.filesByCategory)

          notifyDealEsignTemplatesChanged(dealId)

          toast.success("Template saved", "Dropbox Sign template is ready for this deal.")

        } else {

          toast.error("Could not save template", result.message)

        }

      })()

    },

    [dealId, embeddedSession],

  )



  return (

    <div

      className={`deal_esign_root${loading ? " deal_esign_root_loading" : ""}`}

      aria-busy={loading || uploading}

    >

      {!canUploadDocuments ? (

        <p className="deal_esign_readonly_banner" role="note">

          You can view eSign templates on this deal. Upload, edit, and delete are
          restricted to the lead sponsor.

        </p>

      ) : null}

      {/* Dropbox Sign intro — hidden per product request
      ) : (
        <p className="deal_esign_intro" role="note">
          Upload a PDF, then click <strong>Save template</strong> to open the Dropbox Sign
          editor, place signature fields, and save the template for this deal.
        </p>
      )}
      */}



      <div className="deal_esign_cards">

        {ESIGN_ENTITY_CATEGORIES.map((cat) => (

          <EsignCategoryUploadCard

            key={cat.id}

            category={cat}

            dealId={dealId}

            files={filesByCategory[cat.id] ?? []}

            onFilesSelected={onFilesSelected}

            onRemoveFile={onRequestRemoveFile}

            onSaveTemplate={onSaveTemplate}

            canUploadDocuments={canUploadDocuments}

            uploading={uploading}

            savingTemplateId={savingTemplateId}

            dropboxSignConfigured={dropboxSignConfigured}

          />

        ))}

      </div>



      <EsignTemplateUploadModal
        open={uploadModalCategory != null && uploadModalFiles.length > 0}
        category={uploadModalCategory}
        pendingFiles={uploadModalFiles}
        uploading={uploading}
        onClose={closeUploadModal}
        onConfirm={onConfirmUpload}
      />

      <EsignTemplateDeleteConfirmModal
        open={deletePending != null}
        displayName={deletePending?.displayName ?? ""}
        busy={uploading}
        onCancel={() => {
          if (!uploading) setDeletePending(null)
        }}
        onConfirm={onConfirmRemoveFile}
      />

      {embeddedSession ? (

        <DropboxSignEmbeddedEditor

          key={`${embeddedSession.fileId}-${embeddedSession.editUrl}`}

          editUrl={embeddedSession.editUrl}

          clientId={embeddedSession.clientId}

          testMode={embeddedSession.testMode}

          onTemplateSaved={handleEmbeddedTemplateSaved}

          onCancel={() => setEmbeddedSession(null)}

          onError={(message) => {

            setEmbeddedSession(null)

            toast.error("Dropbox Sign", message)

          }}

        />

      ) : null}

    </div>

  )

}


