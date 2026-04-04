import { HelpCircle, MoreHorizontal, Plus } from "lucide-react"
import { useCallback, useRef, useState } from "react"
import { formatDateDdMmmYyyy } from "../../../../../common/utils/formatDateDisplay"

interface OfferingDocumentRow {
  id: string
  documentName: string
  visibility: string
  requireLpReview: boolean
  documentLabel: string
  dateAdded: string
}

const INTRO_COPY =
  "Add documents to be shown (only) on the offering page. Typically GPs upload their subscription docs here for LPs to preview, as well as their webinar deck and recording. Please use PDF format or provide a link to your content."

const REQUIRE_LP_HELP =
  "When enabled, limited partners must review or acknowledge this document according to your workflow before it counts as complete."

function formatDateAdded(): string {
  return formatDateDdMmmYyyy(new Date())
}

export function DocumentsSection() {
  const [rows, setRows] = useState<OfferingDocumentRow[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const onAddDocumentLink = useCallback(() => {
    const url = window.prompt("Document URL", "https://")
    if (url == null || !url.trim()) return
    const name =
      window.prompt("Document name", "Linked document")?.trim() || "Linked document"
    setRows((prev) => [
      ...prev,
      {
        id: `link-${Date.now()}`,
        documentName: name,
        visibility: "Offering page",
        requireLpReview: false,
        documentLabel: "—",
        dateAdded: formatDateAdded(),
      },
    ])
  }, [])

  const onUploadClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const onFilesSelected = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files?.length) return
      setRows((prev) => {
        const next = [...prev]
        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          next.push({
            id: `file-${Date.now()}-${i}`,
            documentName: file.name,
            visibility: "Offering page",
            requireLpReview: false,
            documentLabel: "—",
            dateAdded: formatDateAdded(),
          })
        }
        return next
      })
      e.target.value = ""
    },
    [],
  )

  return (
    <div className="deal_docs">
      <div className="deal_docs_top">
        <p className="deal_docs_intro">{INTRO_COPY}</p>
        <div className="deal_docs_toolbar">
          <button
            type="button"
            className="deal_docs_outline_btn"
            onClick={onAddDocumentLink}
          >
            <Plus size={16} strokeWidth={2} aria-hidden />
            Add document link
          </button>
          <button
            type="button"
            className="deal_docs_outline_btn"
            onClick={onUploadClick}
          >
            <Plus size={16} strokeWidth={2} aria-hidden />
            Upload document
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="deal_docs_file_input"
            accept=".pdf,application/pdf"
            multiple
            onChange={onFilesSelected}
            aria-hidden
            tabIndex={-1}
          />
        </div>
      </div>

      <div className="deal_docs_table_wrap" role="region" aria-label="Offering documents">
        <div className="deal_docs_table" role="table">
          <div className="deal_docs_thead" role="rowgroup">
            <div className="deal_docs_tr deal_docs_tr_head" role="row">
              <div className="deal_docs_th deal_docs_th_handle" role="columnheader" aria-hidden />
              <div className="deal_docs_th" role="columnheader">
                Document name
              </div>
              <div className="deal_docs_th" role="columnheader">
                Visibility
              </div>
              <div
                className="deal_docs_th deal_docs_th_lp"
                role="columnheader"
              >
                <span>Require LP review</span>
                <button
                  type="button"
                  className="deal_docs_help_btn"
                  title={REQUIRE_LP_HELP}
                  aria-label={REQUIRE_LP_HELP}
                >
                  <HelpCircle size={15} strokeWidth={2} aria-hidden />
                </button>
              </div>
              <div className="deal_docs_th" role="columnheader">
                Document label
              </div>
              <div className="deal_docs_th" role="columnheader">
                Date added
              </div>
              <div className="deal_docs_th deal_docs_th_actions" role="columnheader">
                Actions
              </div>
            </div>
          </div>
          <div className="deal_docs_tbody" role="rowgroup">
            {rows.length === 0 ? (
              <div className="deal_docs_empty" role="status">
                No documents
              </div>
            ) : (
              rows.map((row) => (
                <div
                  key={row.id}
                  className="deal_docs_tr deal_docs_tr_body"
                  role="row"
                >
                  <div className="deal_docs_td deal_docs_td_handle" role="cell" aria-hidden />
                  <div className="deal_docs_td" role="cell">
                    {row.documentName}
                  </div>
                  <div className="deal_docs_td" role="cell">
                    {row.visibility}
                  </div>
                  <div className="deal_docs_td" role="cell">
                    {row.requireLpReview ? "Yes" : "No"}
                  </div>
                  <div className="deal_docs_td" role="cell">
                    {row.documentLabel}
                  </div>
                  <div className="deal_docs_td" role="cell">
                    {row.dateAdded}
                  </div>
                  <div
                    className="deal_docs_td deal_docs_td_actions"
                    role="cell"
                  >
                    <button
                      type="button"
                      className="deal_docs_row_menu"
                      aria-label={`Actions for ${row.documentName}`}
                    >
                      <MoreHorizontal size={18} strokeWidth={2} aria-hidden />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
