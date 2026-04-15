import {
  ChevronDown,
  Copy,
  Download,
  Eye,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react"
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"
import {
  FormTooltip,
  type FormTooltipPanelAlign,
} from "../../../../../common/components/form-tooltip/FormTooltip"
import { dealAssetRelativePathToUploadsUrl } from "../../../../../common/utils/apiBaseUrl"
import { formatDateDdMmmYyyy } from "../../../../../common/utils/formatDateDisplay"
import "../deals-list.css"
import {
  postDealOfferingDocumentUploads,
  type DealDetailApi,
} from "../api/dealsApi"
import {
  readOfferingPreviewSections,
  sectionDisplayLabel,
  sectionSharedWithDisplay,
  writeOfferingPreviewSections,
  type NestedPreviewDocument,
  type OfferingPreviewSection,
  type SectionSharedWithScope,
} from "../utils/offeringPreviewDocSections"
import { scheduleOfferingInvestorPreviewServerSync } from "../utils/offeringPreviewServerState"

interface DocumentsSectionProps {
  dealId: string
  onOfferingPreviewSynced?: (deal: DealDetailApi) => void
}

function DocumentsTableColumnHeader({
  label,
  hint,
  headerAlign = "left",
  tooltipPlacement = "bottom",
  tooltipPanelAlign,
}: {
  label: string
  hint: ReactNode
  headerAlign?: "left" | "center" | "right"
  tooltipPlacement?: "top" | "bottom"
  tooltipPanelAlign?: FormTooltipPanelAlign
}) {
  const headerAlignClass =
    headerAlign === "right"
      ? " deals_table_col_header_end"
      : headerAlign === "center"
        ? " deals_table_col_header_center"
        : ""
  const panelAlign: FormTooltipPanelAlign =
    tooltipPanelAlign ??
    (headerAlign === "right"
      ? "end"
      : headerAlign === "center"
        ? "center"
        : "start")
  return (
    <span className={`deals_table_col_header${headerAlignClass}`}>
      <span>{label}</span>
      <span
        className="deals_table_header_tooltip_anchor"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <FormTooltip
          label={`More information: ${label}`}
          content={
            typeof hint === "string" ? (
              <p className="deals_table_header_tooltip_p">{hint}</p>
            ) : (
              <div className="deals_table_header_tooltip_stack">{hint}</div>
            )
          }
          placement={tooltipPlacement}
          panelAlign={panelAlign}
          nativeButtonTrigger={false}
        />
      </span>
    </span>
  )
}

function formatDateAdded(): string {
  return formatDateDdMmmYyyy(new Date())
}

function sectionMatchesLabel(s: OfferingPreviewSection, label: string): boolean {
  const t = label.trim().toLowerCase()
  return (
    s.sectionLabel.trim().toLowerCase() === t ||
    s.documentLabel.trim().toLowerCase() === t
  )
}

function safeDownloadFilename(name: string): string {
  const base = name.trim() || "document"
  return base.replace(/[/\\?%*:|"<>]/g, "-").slice(0, 200)
}

function revokeBlobUrlIfOrphaned(
  removedUrl: string | null | undefined,
  sectionsAfter: OfferingPreviewSection[],
): void {
  const u = removedUrl?.trim()
  if (!u || !u.startsWith("blob:")) return
  const stillUsed = sectionsAfter.some((s) =>
    s.nestedDocuments.some((d) => d.url === u),
  )
  if (stillUsed) return
  try {
    URL.revokeObjectURL(u)
  } catch {
    /* ignore */
  }
}

export function DocumentsSection({
  dealId,
  onOfferingPreviewSynced,
}: DocumentsSectionProps) {
  const addSectionTitleId = useId()
  const uploadDocsTitleId = useId()
  const [sections, setSections] = useState<OfferingPreviewSection[]>(() =>
    readOfferingPreviewSections(dealId),
  )
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(
    {},
  )
  const [checkedDocsBySection, setCheckedDocsBySection] = useState<
    Record<string, Record<string, boolean>>
  >({})
  const [query, setQuery] = useState("")
  const [showAddSectionModal, setShowAddSectionModal] = useState(false)
  const [sectionName, setSectionName] = useState("")
  const [sectionFiles, setSectionFiles] = useState<File[]>([])
  const [addSectionError, setAddSectionError] = useState<string | null>(null)
  const [showUploadDocsModal, setShowUploadDocsModal] = useState(false)
  const [uploadTargetLabel, setUploadTargetLabel] = useState("")
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [uploadDocsError, setUploadDocsError] = useState<string | null>(null)
  const [documentUploadBusy, setDocumentUploadBusy] = useState(false)
  const onSyncedRef = useRef(onOfferingPreviewSynced)
  onSyncedRef.current = onOfferingPreviewSynced

  useEffect(() => {
    setSections(readOfferingPreviewSections(dealId))
    setExpandedSections({})
    setCheckedDocsBySection({})
  }, [dealId])

  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !(prev[sectionId] ?? true),
    }))
  }, [])

  const checkAllInSection = useCallback((sectionId: string, docIds: string[]) => {
    setCheckedDocsBySection((prev) => ({
      ...prev,
      [sectionId]: Object.fromEntries(docIds.map((id) => [id, true] as const)),
    }))
  }, [])

  const clearChecksInSection = useCallback((sectionId: string) => {
    setCheckedDocsBySection((prev) => {
      if (!prev[sectionId]) return prev
      const next = { ...prev }
      delete next[sectionId]
      return next
    })
  }, [])

  const copyDocLink = useCallback((url: string) => {
    if (!url.trim()) return
    void (async () => {
      try {
        await navigator.clipboard.writeText(url.trim())
      } catch {
        /* ignore */
      }
    })()
  }, [])

  useEffect(() => {
    if (!dealId.trim()) return
    writeOfferingPreviewSections(dealId, sections)
    scheduleOfferingInvestorPreviewServerSync(dealId, {
      onSuccess: (d) => onSyncedRef.current?.(d),
    })
  }, [dealId, sections])

  const onAddSection = useCallback(() => {
    setSectionName("")
    setSectionFiles([])
    setAddSectionError(null)
    setShowAddSectionModal(true)
  }, [])

  const closeAddSectionModal = useCallback(() => {
    if (documentUploadBusy) return
    setShowAddSectionModal(false)
    setAddSectionError(null)
  }, [documentUploadBusy])

  const onSectionFilesChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.currentTarget.files
      setSectionFiles(files ? Array.from(files) : [])
      setAddSectionError(null)
    },
    [],
  )

  const onSubmitAddSection = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      void (async () => {
        const name = sectionName.trim()
        if (!name) {
          setAddSectionError("Section name is required.")
          return
        }

        const createdAt = Date.now()
        const newSectionId = `section-${createdAt}`
        let nestedDocuments: NestedPreviewDocument[] = []

        if (sectionFiles.length > 0) {
          const idTrim = dealId.trim()
          if (!idTrim) {
            setAddSectionError("Save the deal before uploading documents.")
            return
          }
          setDocumentUploadBusy(true)
          setAddSectionError(null)
          try {
            const up = await postDealOfferingDocumentUploads(
              idTrim,
              sectionFiles,
            )
            if (!up.ok) {
              setAddSectionError(up.message)
              return
            }
            if (up.newPaths.length !== sectionFiles.length) {
              setAddSectionError(
                "Upload did not return a path for each selected file.",
              )
              return
            }
            nestedDocuments = sectionFiles.map((file, i) => {
              const stored = dealAssetRelativePathToUploadsUrl(up.newPaths[i]!)
              return {
                id: `${newSectionId}-nest-${i}`,
                name: file.name,
                url: stored || null,
                dateAdded: formatDateAdded(),
                lpDisplaySectionId: newSectionId,
              }
            })
          } catch (err) {
            setAddSectionError(
              err instanceof Error ? err.message : "Document upload failed.",
            )
            return
          } finally {
            setDocumentUploadBusy(false)
          }
        }

        setSections((prev) => [
          ...prev,
          {
            id: newSectionId,
            sectionLabel: name,
            documentLabel: name,
            visibility: sectionSharedWithDisplay("offering_page"),
            sharedWithScope: "offering_page",
            requireLpReview: false,
            dateAdded: formatDateAdded(),
            nestedDocuments,
          },
        ])
        setShowAddSectionModal(false)
        setSectionName("")
        setSectionFiles([])
        setAddSectionError(null)
      })()
    },
    [dealId, sectionFiles, sectionName],
  )

  const openUploadDocumentsModal = useCallback((row: OfferingPreviewSection) => {
    const label =
      row.documentLabel?.trim() && row.documentLabel.trim() !== "—"
        ? row.documentLabel.trim()
        : row.sectionLabel.trim() || "Section"
    setUploadTargetLabel(label)
    setUploadFiles([])
    setUploadDocsError(null)
    setShowUploadDocsModal(true)
  }, [])

  const closeUploadDocsModal = useCallback(() => {
    if (documentUploadBusy) return
    setShowUploadDocsModal(false)
    setUploadDocsError(null)
  }, [documentUploadBusy])

  const onUploadFilesChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.currentTarget.files
      setUploadFiles(files ? Array.from(files) : [])
      setUploadDocsError(null)
    },
    [],
  )

  const onSubmitUploadDocuments = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      void (async () => {
        if (uploadFiles.length === 0) {
          setUploadDocsError("Upload at least one document.")
          return
        }
        const idTrim = dealId.trim()
        if (!idTrim) {
          setUploadDocsError("Save the deal before uploading documents.")
          return
        }
        const label = uploadTargetLabel.trim() || "Section"
        const createdAt = Date.now()

        setDocumentUploadBusy(true)
        setUploadDocsError(null)
        let newNested: NestedPreviewDocument[] = []
        try {
          const up = await postDealOfferingDocumentUploads(idTrim, uploadFiles)
          if (!up.ok) {
            setUploadDocsError(up.message)
            return
          }
          if (up.newPaths.length !== uploadFiles.length) {
            setUploadDocsError(
              "Upload did not return a path for each selected file.",
            )
            return
          }
          newNested = uploadFiles.map((file, i) => {
            const stored = dealAssetRelativePathToUploadsUrl(up.newPaths[i]!)
            return {
              id: `upload-${createdAt}-${i}`,
              name: file.name,
              url: stored || null,
              dateAdded: formatDateAdded(),
              lpDisplaySectionId: "",
            }
          })
        } catch (err) {
          setUploadDocsError(
            err instanceof Error ? err.message : "Document upload failed.",
          )
          return
        } finally {
          setDocumentUploadBusy(false)
        }

        setSections((prev) =>
          prev.map((s) => {
            if (!sectionMatchesLabel(s, label)) return s
            const withIds = newNested.map((row) => ({
              ...row,
              lpDisplaySectionId: s.id,
            }))
            return {
              ...s,
              nestedDocuments: [...s.nestedDocuments, ...withIds],
              dateAdded: formatDateAdded(),
            }
          }),
        )
        setShowUploadDocsModal(false)
        setUploadFiles([])
        setUploadDocsError(null)
      })()
    },
    [dealId, uploadFiles, uploadTargetLabel],
  )

  const removeNestedDocument = useCallback((sectionId: string, docId: string) => {
    setSections((prev) => {
      let removedUrl: string | null | undefined
      const next = prev.map((s) => {
        if (s.id !== sectionId) return s
        const target = s.nestedDocuments.find((d) => d.id === docId)
        if (target) removedUrl = target.url
        return {
          ...s,
          nestedDocuments: s.nestedDocuments.filter((d) => d.id !== docId),
        }
      })
      revokeBlobUrlIfOrphaned(removedUrl, next)
      return next
    })
    setCheckedDocsBySection((prev) => {
      const sec = prev[sectionId]
      if (!sec || !(docId in sec)) return prev
      const nextSec = { ...sec }
      delete nextSec[docId]
      const next = { ...prev }
      if (Object.keys(nextSec).length === 0) delete next[sectionId]
      else next[sectionId] = nextSec
      return next
    })
  }, [])

  const duplicateNestedDocument = useCallback(
    (sectionId: string, doc: NestedPreviewDocument) => {
      const nid = `dup-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      const copy: NestedPreviewDocument = {
        ...doc,
        id: nid,
        name: `${doc.name.replace(/\s*\(copy\)\s*$/i, "")} (copy)`,
      }
      setSections((prev) =>
        prev.map((s) =>
          s.id !== sectionId
            ? s
            : { ...s, nestedDocuments: [...s.nestedDocuments, copy] },
        ),
      )
    },
    [],
  )

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sections
    return sections.filter((s) => {
      const blob = [
        s.sectionLabel,
        s.documentLabel,
        s.visibility,
        sectionSharedWithDisplay(s.sharedWithScope),
        s.dateAdded,
        ...s.nestedDocuments.flatMap((d) => {
          const ref =
            sections.find((sec) => sec.id === d.lpDisplaySectionId) ?? s
          return [d.name, sectionDisplayLabel(ref)]
        }),
      ]
        .join(" ")
        .toLowerCase()
      return blob.includes(q)
    })
  }, [sections, query])

  const emptyLabel =
    sections.length === 0
      ? "No documents yet. Use Add section to upload documents."
      : query.trim()
        ? "No sections match your search."
        : "No sections to display."

  return (
    <div className="deal_docs">
      <div className="um_panel um_members_tab_panel deals_list_table_panel deals_list_card_surface deal_inv_table_panel deal_assets_datatable_panel">
        <div className="um_toolbar deal_docs_toolbar" role="toolbar" aria-label="Document actions">
          <div className="um_search_wrap">
            <Search className="um_search_icon" size={16} strokeWidth={2} aria-hidden />
            <input
              type="search"
              className="um_search_input"
              placeholder="Search documents…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search documents"
              autoComplete="off"
            />
          </div>
          <div className="um_toolbar_actions">
            <button
              type="button"
              className="deal_docs_toolbar_btn"
              onClick={onAddSection}
            >
              <Plus size={16} strokeWidth={2} aria-hidden />
              Add section
            </button>
          </div>
        </div>

        <div className="deal_docs_ui_root">
          {filteredSections.length === 0 ? (
            <p className="deal_docs_ui_empty">{emptyLabel}</p>
          ) : (
            filteredSections.map((section) => {
              const isOpen = expandedSections[section.id] ?? true
              const n = section.nestedDocuments.length
              const panelId = `${section.id}-docs-panel`
              return (
                <div key={section.id} className="deal_docs_ui_bundle">
                  <div className="deal_docs_ui_banner" role="region" aria-label={section.sectionLabel}>
                    <div className="deal_docs_ui_banner_left">
                      <button
                        type="button"
                        className="deal_docs_ui_banner_chevron_btn"
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        onClick={() => toggleSection(section.id)}
                        aria-label={isOpen ? "Collapse section" : "Expand section"}
                      >
                        <ChevronDown
                          size={14}
                          strokeWidth={2.75}
                          aria-hidden
                          className={`deal_docs_ui_banner_chevron${isOpen ? " deal_docs_ui_banner_chevron_open" : ""}`}
                        />
                      </button>
                      <button
                        type="button"
                        className="deal_docs_ui_banner_link_btn"
                        onClick={() =>
                          checkAllInSection(
                            section.id,
                            section.nestedDocuments.map((d) => d.id),
                          )
                        }
                        disabled={n === 0}
                      >
                        Select all
                      </button>
                      <span className="deal_docs_ui_banner_title">{section.sectionLabel}</span>
                    </div>
                    <div className="deal_docs_ui_banner_right">
                      <button
                        type="button"
                        className="deal_docs_ui_banner_icon_btn"
                        aria-label={`Add documents to ${section.sectionLabel}`}
                        onClick={() => openUploadDocumentsModal(section)}
                      >
                        <Plus size={18} strokeWidth={2} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="deal_docs_ui_banner_icon_btn deal_docs_ui_banner_icon_btn_danger"
                        aria-label={`Delete section ${section.sectionLabel}`}
                        onClick={() => {
                          setSections((prev) => {
                            const victim = prev.find((s) => s.id === section.id)
                            const next = prev.filter((s) => s.id !== section.id)
                            if (victim) {
                              for (const d of victim.nestedDocuments) {
                                revokeBlobUrlIfOrphaned(d.url, next)
                              }
                            }
                            return next
                          })
                          setCheckedDocsBySection((c) => {
                            if (!c[section.id]) return c
                            const next = { ...c }
                            delete next[section.id]
                            return next
                          })
                        }}
                      >
                        <Trash2 size={18} strokeWidth={2} aria-hidden />
                      </button>
                      <span className="deal_docs_ui_banner_count" aria-live="polite">
                        {n} document{n === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>

                  <div
                    id={panelId}
                    className="deal_docs_ui_panel"
                    hidden={!isOpen}
                  >
                    {n === 0 ? (
                      <p className="deal_docs_ui_panel_empty">No documents yet.</p>
                    ) : (
                      <div className="deal_docs_ui_table_scroll">
                        <table className="deal_docs_ui_table">
                          <thead>
                            <tr>
                              <th className="deal_docs_ui_th deal_docs_ui_th_check" scope="col">
                                <span className="deal_docs_ui_sr">Select</span>
                              </th>
                              <th className="deal_docs_ui_th deal_docs_ui_th_doc" scope="col">
                                Document
                              </th>
                              <th className="deal_docs_ui_th deal_docs_ui_th_date" scope="col">
                                Date added
                              </th>
                              <th className="deal_docs_ui_th deal_docs_ui_th_shared" scope="col">
                                <DocumentsTableColumnHeader
                                  label="Shared with"
                                  hint={
                                    <>
                                      <p className="deals_table_header_tooltip_p">
                                        Offering page: documents appear on Preview
                                        offering, the shared preview link, and for deal LP
                                        investors in the portal. LP Investor: deal workspace
                                        / portal only for LPs — not on Preview offering or
                                        the no-login shared link.
                                      </p>
                                      <p className="deals_table_header_tooltip_p">
                                        Fund of funds: when the deal is any type of fund of
                                        funds, you can share a document with one of the deal
                                        classes; investors who invested in that class can
                                        access the document.
                                      </p>
                                    </>
                                  }
                                />
                              </th>
                              <th className="deal_docs_ui_th deal_docs_ui_th_label" scope="col">
                                Label (Visible to LPs)
                              </th>
                              <th className="deal_docs_ui_th deal_docs_ui_th_actions" scope="col">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {section.nestedDocuments.map((d) => {
                              const url = d.url?.trim()
                              const checked = Boolean(
                                checkedDocsBySection[section.id]?.[d.id],
                              )
                              const checkId = `${section.id}-check-${d.id}`
                              return (
                                <tr key={d.id} className="deal_docs_ui_tr">
                                  <td className="deal_docs_ui_td deal_docs_ui_td_check">
                                    <input
                                      id={checkId}
                                      type="checkbox"
                                      className="deal_docs_ui_row_checkbox"
                                      checked={checked}
                                      aria-label={`Select ${d.name}`}
                                      onChange={(e) => {
                                        setCheckedDocsBySection((prev) => ({
                                          ...prev,
                                          [section.id]: {
                                            ...prev[section.id],
                                            [d.id]: e.target.checked,
                                          },
                                        }))
                                      }}
                                    />
                                  </td>
                                  <td className="deal_docs_ui_td deal_docs_ui_td_doc">
                                    <div className="deal_docs_ui_doc_cell">
                                      <span className="deal_docs_ui_doc_name" title={d.name}>
                                        {d.name}
                                      </span>
                                      <div className="deal_docs_ui_doc_quick">
                                        <button
                                          type="button"
                                          className="deal_docs_ui_doc_icon_btn"
                                          title="Copy link"
                                          aria-label={`Copy link for ${d.name}`}
                                          disabled={!url}
                                          onClick={() => url && copyDocLink(url)}
                                        >
                                          <Link2 size={16} strokeWidth={2} aria-hidden />
                                        </button>
                                        {url ? (
                                          <a
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="deal_docs_ui_doc_icon_btn deal_docs_ui_doc_icon_link"
                                            title="View"
                                            aria-label={`View ${d.name}`}
                                          >
                                            <Eye size={16} strokeWidth={2} aria-hidden />
                                          </a>
                                        ) : (
                                          <span
                                            className="deal_docs_ui_doc_icon_btn deal_docs_ui_doc_icon_btn_disabled"
                                            aria-hidden
                                          >
                                            <Eye size={16} strokeWidth={2} />
                                          </span>
                                        )}
                                        {url ? (
                                          <a
                                            href={url}
                                            download={safeDownloadFilename(d.name)}
                                            rel="noopener noreferrer"
                                            className="deal_docs_ui_doc_icon_btn deal_docs_ui_doc_icon_link"
                                            title="Download"
                                            aria-label={`Download ${d.name}`}
                                          >
                                            <Download size={16} strokeWidth={2} aria-hidden />
                                          </a>
                                        ) : (
                                          <span
                                            className="deal_docs_ui_doc_icon_btn deal_docs_ui_doc_icon_btn_disabled"
                                            aria-hidden
                                          >
                                            <Download size={16} strokeWidth={2} />
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="deal_docs_ui_td deal_docs_ui_td_date">
                                    {d.dateAdded}
                                  </td>
                                  <td className="deal_docs_ui_td deal_docs_ui_td_shared">
                                    <div className="deal_docs_ui_shared">
                                      <div className="deal_docs_ui_shared_body">
                                        <select
                                          className="deal_docs_ui_pill_select deal_docs_ui_shared_select"
                                          aria-label={`Shared with for ${section.sectionLabel}`}
                                          value={section.sharedWithScope}
                                          onChange={(e) => {
                                            const v = e.target.value as SectionSharedWithScope
                                            setSections((prev) =>
                                              prev.map((s) =>
                                                s.id !== section.id
                                                  ? s
                                                  : {
                                                      ...s,
                                                      sharedWithScope: v,
                                                      visibility:
                                                        sectionSharedWithDisplay(v),
                                                    },
                                              ),
                                            )
                                          }}
                                        >
                                          <option value="offering_page">
                                            Offering page
                                          </option>
                                          <option value="lp_investor">LP Investor</option>
                                        </select>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="deal_docs_ui_td deal_docs_ui_td_label">
                                    <select
                                      className="deal_docs_ui_pill_select"
                                      aria-label={`LP-visible section label for ${d.name}`}
                                      value={
                                        sections.some((x) => x.id === d.lpDisplaySectionId)
                                          ? d.lpDisplaySectionId
                                          : section.id
                                      }
                                      onChange={(e) => {
                                        const sectionId = e.target.value
                                        setSections((prev) =>
                                          prev.map((s) =>
                                            s.id !== section.id
                                              ? s
                                              : {
                                                  ...s,
                                                  nestedDocuments: s.nestedDocuments.map(
                                                    (n) =>
                                                      n.id === d.id
                                                        ? {
                                                            ...n,
                                                            lpDisplaySectionId:
                                                              sectionId,
                                                          }
                                                        : n,
                                                  ),
                                                },
                                          ),
                                        )
                                      }}
                                    >
                                      {sections.map((opt) => (
                                        <option key={opt.id} value={opt.id}>
                                          {sectionDisplayLabel(opt)}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="deal_docs_ui_td deal_docs_ui_td_actions">
                                    <div className="deal_docs_ui_row_actions">
                                      <button
                                        type="button"
                                        className="deal_docs_ui_row_icon_btn"
                                        title="Edit (coming soon)"
                                        aria-label={`Edit ${d.name}`}
                                        disabled
                                      >
                                        <Pencil size={16} strokeWidth={2} aria-hidden />
                                      </button>
                                      <button
                                        type="button"
                                        className="deal_docs_ui_row_icon_btn"
                                        title="Duplicate"
                                        aria-label={`Duplicate ${d.name}`}
                                        onClick={() =>
                                          duplicateNestedDocument(section.id, d)
                                        }
                                      >
                                        <Copy size={16} strokeWidth={2} aria-hidden />
                                      </button>
                                      <button
                                        type="button"
                                        className="deal_docs_ui_row_icon_btn deal_docs_ui_row_icon_btn_danger"
                                        title="Remove document"
                                        aria-label={`Remove ${d.name}`}
                                        onClick={() =>
                                          removeNestedDocument(section.id, d.id)
                                        }
                                      >
                                        <Trash2 size={16} strokeWidth={2} aria-hidden />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {n > 0 ? (
                      <div className="deal_docs_ui_panel_footer">
                        <button
                          type="button"
                          className="deal_docs_ui_banner_link_btn"
                          onClick={() => clearChecksInSection(section.id)}
                        >
                          Clear selection
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
      {showAddSectionModal
        ? createPortal(
            <div
              className="um_modal_overlay deals_add_inv_modal_overlay portal_modal_z_boost"
              role="presentation"
            >
              <div
                className="um_modal deals_add_inv_modal_panel add_contact_panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby={addSectionTitleId}
              >
                <div className="um_modal_head add_contact_modal_head">
                  <h3
                    id={addSectionTitleId}
                    className="um_modal_title add_contact_modal_title"
                  >
                    Add section
                  </h3>
                  <button
                    type="button"
                    className="um_modal_close"
                    aria-label="Close"
                    disabled={documentUploadBusy}
                    onClick={closeAddSectionModal}
                  >
                    <X size={20} strokeWidth={2} aria-hidden />
                  </button>
                </div>
                <form onSubmit={onSubmitAddSection} noValidate>
                  <div className="deals_add_inv_modal_scroll">
                    <label className="deals_create_label">
                      Section name
                      <input
                        className="deals_create_input"
                        value={sectionName}
                        onChange={(e) => {
                          setSectionName(e.target.value)
                          setAddSectionError(null)
                        }}
                        placeholder="e.g. Offering Memorandum"
                        aria-invalid={!sectionName.trim() && addSectionError != null}
                        required
                      />
                    </label>
                    <label className="deals_create_label">
                      Upload documents
                      <input
                        type="file"
                        className="deals_create_input"
                        multiple
                        onChange={onSectionFilesChange}
                        aria-invalid={false}
                      />
                    </label>
                    {sectionFiles.length > 0 ? (
                      <p className="deal_offering_muted">
                        {sectionFiles.length}{" "}
                        {sectionFiles.length === 1 ? "file selected" : "files selected"}{" "}
                        — files are added to this section’s document list.
                      </p>
                    ) : null}
                    {addSectionError ? (
                      <p className="deals_create_error" role="alert">
                        {addSectionError}
                      </p>
                    ) : null}
                  </div>
                  <div className="um_modal_actions">
                    <button
                      type="button"
                      className="um_btn_secondary"
                      disabled={documentUploadBusy}
                      onClick={closeAddSectionModal}
                    >
                      <X size={16} strokeWidth={2} aria-hidden />
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="um_btn_primary"
                      disabled={documentUploadBusy}
                    >
                      {documentUploadBusy ? (
                        <>
                          <Loader2
                            size={16}
                            strokeWidth={2}
                            className="deals_deal_view_spinner"
                            aria-hidden
                          />
                          Uploading…
                        </>
                      ) : (
                        <>
                          <Save size={16} strokeWidth={2} aria-hidden />
                          Save
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body,
          )
        : null}
      {showUploadDocsModal
        ? createPortal(
            <div
              className="um_modal_overlay deals_add_inv_modal_overlay portal_modal_z_boost"
              role="presentation"
            >
              <div
                className="um_modal deals_add_inv_modal_panel add_contact_panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby={uploadDocsTitleId}
              >
                <div className="um_modal_head add_contact_modal_head">
                  <h3
                    id={uploadDocsTitleId}
                    className="um_modal_title add_contact_modal_title"
                  >
                    Upload documents
                  </h3>
                  <button
                    type="button"
                    className="um_modal_close"
                    aria-label="Close"
                    disabled={documentUploadBusy}
                    onClick={closeUploadDocsModal}
                  >
                    <X size={20} strokeWidth={2} aria-hidden />
                  </button>
                </div>
                <form onSubmit={onSubmitUploadDocuments} noValidate>
                  <div className="deals_add_inv_modal_scroll">
                    <p className="deal_offering_muted">
                      Section: <strong>{uploadTargetLabel || "Section"}</strong>
                    </p>
                    <p className="deal_offering_muted">
                      Uploaded files are added to this section’s document list.
                    </p>
                    <label className="deals_create_label">
                      Upload documents
                      <input
                        type="file"
                        className="deals_create_input"
                        multiple
                        onChange={onUploadFilesChange}
                        required
                        aria-invalid={uploadFiles.length === 0 && uploadDocsError != null}
                      />
                    </label>
                    {uploadFiles.length > 0 ? (
                      <p className="deal_offering_muted">
                        {uploadFiles.length}{" "}
                        {uploadFiles.length === 1 ? "file selected" : "files selected"}
                      </p>
                    ) : null}
                    {uploadDocsError ? (
                      <p className="deals_create_error" role="alert">
                        {uploadDocsError}
                      </p>
                    ) : null}
                  </div>
                  <div className="um_modal_actions">
                    <button
                      type="button"
                      className="um_btn_secondary"
                      disabled={documentUploadBusy}
                      onClick={closeUploadDocsModal}
                    >
                      <X size={16} strokeWidth={2} aria-hidden />
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="um_btn_primary"
                      disabled={documentUploadBusy}
                    >
                      {documentUploadBusy ? (
                        <>
                          <Loader2
                            size={16}
                            strokeWidth={2}
                            className="deals_deal_view_spinner"
                            aria-hidden
                          />
                          Uploading…
                        </>
                      ) : (
                        <>
                          <Save size={16} strokeWidth={2} aria-hidden />
                          Save
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
