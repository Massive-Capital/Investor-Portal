import { Trash2, Upload } from "lucide-react"
import {
  useCallback,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react"
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
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function EsignCategoryUploadCard({
  category,
  dealId,
  files,
  onAddFiles,
  onRemoveFile,
}: {
  category: EsignEntityCategory
  dealId: string
  files: File[]
  onAddFiles: (categoryId: string, list: FileList | null) => void
  onRemoveFile: (categoryId: string, index: number) => void
}) {
  const inputId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dropFocus, setDropFocus] = useState(false)

  const accept =
    ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    onAddFiles(category.id, e.target.files)
    e.target.value = ""
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setDropFocus(false)
    if (e.dataTransfer.files?.length)
      onAddFiles(category.id, e.dataTransfer.files)
  }

  const openPicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

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
        <input
          ref={fileInputRef}
          id={inputId}
          type="file"
          className="visually_hidden"
          accept={accept}
          multiple
          aria-label={`Upload documents for ${category.label}`}
          data-deal-id={dealId}
          data-esign-folder={ESIGN_FOLDER_SLUG}
          data-esign-category={category.id}
          onChange={handleFileChange}
        />
        <div
          role="button"
          tabIndex={0}
          className={`deal_esign_dropzone${dropFocus ? " deal_esign_dropzone_focus" : ""}`}
          onClick={openPicker}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              openPicker()
            }
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setDropFocus(true)
          }}
          onDragLeave={() => setDropFocus(false)}
          onDrop={handleDrop}
        >
          <Upload
            className="deal_esign_dropzone_lead"
            size={20}
            strokeWidth={1.75}
            aria-hidden
          />
          <div className="deal_esign_dropzone_text">
            <span className="deal_esign_dropzone_hint">
              Drop files or click to upload
            </span>
            <span className="deal_esign_dropzone_sub">
              PDF or Word · stored under {ESIGN_FOLDER_SLUG}/{category.id}
            </span>
          </div>
        </div>
        {files.length > 0 ? (
          <ul className="deal_esign_file_list" aria-label={`Files for ${category.label}`}>
            {files.map((f, idx) => (
              <li key={`${f.name}-${f.size}-${idx}`} className="deal_esign_file_row">
                <span className="deal_esign_file_name" title={f.name}>
                  {f.name}
                  <span className="visually_hidden">
                    , {formatBytes(f.size)}
                  </span>
                </span>
                <button
                  type="button"
                  className="deal_esign_file_remove"
                  aria-label={`Remove ${f.name}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemoveFile(category.id, idx)
                  }}
                >
                  <Trash2 size={14} strokeWidth={2} aria-hidden />
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  )
}

export function DealEsignTemplatesTab({ dealId }: DealEsignTemplatesTabProps) {
  const [filesByCategory, setFilesByCategory] = useState<
    Record<string, File[]>
  >({})

  const onAddFiles = useCallback((categoryId: string, list: FileList | null) => {
    if (!list?.length) return
    const next = Array.from(list)
    setFilesByCategory((prev) => ({
      ...prev,
      [categoryId]: [...(prev[categoryId] ?? []), ...next],
    }))
  }, [])

  const onRemoveFile = useCallback((categoryId: string, index: number) => {
    setFilesByCategory((prev) => {
      const cur = prev[categoryId] ?? []
      const filtered = cur.filter((_, i) => i !== index)
      const next = { ...prev }
      if (filtered.length) next[categoryId] = filtered
      else delete next[categoryId]
      return next
    })
  }, [])

  return (
    <div className="deal_esign_root">
      {/* <header className="deal_esign_header">
        <h2 className="deal_esign_title">eSign document uploads</h2>
        <p className="deal_esign_intro">
          Upload templates or signed documents for each investor or entity type.
          Files are grouped under the{" "}
          <strong>{ESIGN_FOLDER_SLUG}</strong> folder for this deal (shown in
          paths below for reference when connecting storage).
        </p>
        <div className="deal_esign_folder_pill">
          <FolderOpen
            className="deal_esign_folder_pill_icon"
            size={14}
            strokeWidth={2}
            aria-hidden
          />
          Folder: {ESIGN_FOLDER_SLUG}
        </div>
      </header> */}

      <div className="deal_esign_cards">
        {ESIGN_ENTITY_CATEGORIES.map((cat) => (
          <EsignCategoryUploadCard
            key={cat.id}
            category={cat}
            dealId={dealId}
            files={filesByCategory[cat.id] ?? []}
            onAddFiles={onAddFiles}
            onRemoveFile={onRemoveFile}
          />
        ))}
      </div>
    </div>
  )
}
