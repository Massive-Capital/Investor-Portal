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
  Upload,
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
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"
import {
  FormTooltip,
  type FormTooltipPanelAlign,
} from "../../../../../common/components/form-tooltip/FormTooltip"
import { dealAssetRelativePathToUploadsUrl } from "../../../../../common/utils/apiBaseUrl"
import { formatDateDdMmmYyyy } from "../../../../../common/utils/formatDateDisplay"
import "../../deals-list.css"
import {
  fetchDealInvestorClasses,
  fetchDealInvestors,
  fetchDealMembers,
  isDealOfferingDocumentPdfFile,
  postDealOfferingDocumentUploads,
  type DealDetailApi,
} from "../../api/dealsApi"
import {
  buildSponsorUserPickerOptions,
  filterLpInvestorsForDocumentSharedWith,
  sponsorAudienceSearchBlob,
} from "../../utils/offeringPreviewDocumentAudience"
import type { DealInvestorClass } from "../../types/deal-investor-class.types"
import type { DealInvestorRow } from "../../types/deal-investors.types"
import {
  DocumentSharedWithPicker,
  sharedAudienceSearchBlob,
  toggleIdInList,
} from "./DocumentSharedWithPicker"
import {
  DEFAULT_DOCUMENT_SECTION_ID,
  effectiveDocumentSharedWithScope,
  ensureDefaultDocumentSectionInList,
  isDefaultDocumentSection,
  orderDocumentSectionsWithDefaultFirst,
  readOfferingPreviewSections,
  sectionDisplayLabel,
  sectionSharedWithDisplay,
  writeOfferingPreviewSections,
  type NestedPreviewDocument,
  type OfferingPreviewSection,
  type SectionSharedWithScope,
} from "../../utils/offeringPreviewDocSections"
import {
  applyOfferingInvestorPreviewJsonFromServer,
  scheduleOfferingInvestorPreviewServerSync,
} from "../../utils/offeringPreviewServerState"
import { isOfferingPreviewHydrated } from "../../utils/offeringPreviewRuntimeStore"

interface DocumentsSectionProps {
  dealId: string
  offeringInvestorPreviewJson?: string | null
  investorsListRefreshKey?: number
  onOfferingPreviewSynced?: (deal: DealDetailApi) => void
}

function DocumentsTableDocName({ name }: { name: string }) {
  const display = name.trim() || "—"
  if (display === "—")
    return <span className="deal_docs_ui_doc_name_text">{display}</span>

  return (
    <div className="deal_docs_ui_doc_name_wrap">
      <FormTooltip
        className="deal_docs_ui_doc_name_tooltip"
        label={display}
        content={<p className="deal_docs_ui_doc_name_tooltip_p">{display}</p>}
        placement="top"
        panelAlign="start"
        triggerMode="inline"
      >
        <span className="deal_docs_ui_doc_name_text">{display}</span>
      </FormTooltip>
    </div>
  )
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

function appendPdfFilesFromPicker(
  prev: File[],
  input: FileList | null,
): { next: File[]; rejectedNames: string[] } {
  const picked = input ? Array.from(input) : []
  if (picked.length === 0) return { next: prev, rejectedNames: [] }
  const rejectedNames: string[] = []
  const accepted: File[] = []
  for (const file of picked) {
    if (isDealOfferingDocumentPdfFile(file)) accepted.push(file)
    else rejectedNames.push(file.name)
  }
  return { next: [...prev, ...accepted], rejectedNames }
}

function ModalPendingDocumentFilesList({
  files,
  disabled,
  onRemove,
}: {
  files: File[]
  disabled?: boolean
  onRemove: (index: number) => void
}) {
  const previewUrlsRef = useRef(new Map<string, string>())

  useEffect(() => {
    return () => {
      for (const url of previewUrlsRef.current.values()) {
        try {
          URL.revokeObjectURL(url)
        } catch {
          /* ignore */
        }
      }
      previewUrlsRef.current.clear()
    }
  }, [])

  function filePreviewKey(file: File, index: number): string {
    return `${index}::${file.name}::${file.size}::${file.lastModified}`
  }

  function revokePreviewForKey(key: string): void {
    const url = previewUrlsRef.current.get(key)
    if (!url) return
    try {
      URL.revokeObjectURL(url)
    } catch {
      /* ignore */
    }
    previewUrlsRef.current.delete(key)
  }

  function viewFile(file: File, index: number): void {
    const key = filePreviewKey(file, index)
    let url = previewUrlsRef.current.get(key)
    if (!url) {
      url = URL.createObjectURL(file)
      previewUrlsRef.current.set(key, url)
    }
    window.open(url, "_blank", "noopener,noreferrer")
  }

  function removeFile(index: number): void {
    const file = files[index]
    if (file) revokePreviewForKey(filePreviewKey(file, index))
    onRemove(index)
  }

  if (files.length === 0) return null

  return (
    <ul className="deal_docs_modal_file_list" aria-label="Selected documents">
      {files.map((file, index) => (
        <li
          key={filePreviewKey(file, index)}
          className="deal_docs_modal_file_row"
        >
          <span className="deal_docs_modal_file_name" title={file.name}>
            {file.name}
          </span>
          <div
            className="deal_docs_modal_file_actions"
            role="group"
            aria-label={`${file.name} actions`}
          >
            <button
              type="button"
              className="deal_docs_modal_file_btn"
              disabled={disabled}
              aria-label={`View ${file.name}`}
              onClick={() => viewFile(file, index)}
            >
              <Eye size={16} strokeWidth={2} aria-hidden />
            </button>
            <button
              type="button"
              className="deal_docs_modal_file_btn deal_docs_modal_file_btn_danger"
              disabled={disabled}
              aria-label={`Remove ${file.name}`}
              onClick={() => removeFile(index)}
            >
              <Trash2 size={16} strokeWidth={2} aria-hidden />
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
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
  offeringInvestorPreviewJson,
  investorsListRefreshKey = 0,
  onOfferingPreviewSynced,
}: DocumentsSectionProps) {
  const addSectionTitleId = useId()
  const uploadDocsTitleId = useId()
  const quickUploadInputRef = useRef<HTMLInputElement>(null)
  const [previewHydrated, setPreviewHydrated] = useState(false)
  const [sections, setSections] = useState<OfferingPreviewSection[]>([])
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
  const [quickUploadError, setQuickUploadError] = useState<string | null>(null)
  const [quickUploadDropFocus, setQuickUploadDropFocus] = useState(false)
  const [documentUploadBusy, setDocumentUploadBusy] = useState(false)
  const [dealClasses, setDealClasses] = useState<DealInvestorClass[]>([])
  const [investorRows, setInvestorRows] = useState<DealInvestorRow[]>([])
  const [sponsorRosterRows, setSponsorRosterRows] = useState<DealInvestorRow[]>([])
  const onSyncedRef = useRef(onOfferingPreviewSynced)
  onSyncedRef.current = onOfferingPreviewSynced

  useEffect(() => {
    const id = dealId.trim()
    if (!id) {
      setPreviewHydrated(false)
      setSections([])
      return
    }
    applyOfferingInvestorPreviewJsonFromServer(id, offeringInvestorPreviewJson)
    setSections(
      orderDocumentSectionsWithDefaultFirst(readOfferingPreviewSections(id)),
    )
    setPreviewHydrated(isOfferingPreviewHydrated(id))
    setExpandedSections({})
    setCheckedDocsBySection({})
  }, [dealId, offeringInvestorPreviewJson])

  useEffect(() => {
    const id = dealId.trim()
    if (!id) {
      setDealClasses([])
      setInvestorRows([])
      setSponsorRosterRows([])
      return
    }
    let cancelled = false
    void (async () => {
      const [classes, payload, roster] = await Promise.all([
        fetchDealInvestorClasses(id),
        fetchDealInvestors(id, { lpInvestorsOnly: true }),
        fetchDealMembers(id),
      ])
      if (cancelled) return
      setDealClasses(classes)
      setInvestorRows(payload.investors)
      setSponsorRosterRows(roster)
    })()
    return () => {
      cancelled = true
    }
  }, [dealId, investorsListRefreshKey])

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
    if (!previewHydrated || !dealId.trim()) return
    writeOfferingPreviewSections(dealId, sections)
    scheduleOfferingInvestorPreviewServerSync(dealId, {
      onSuccess: (d) => {
        applyOfferingInvestorPreviewJsonFromServer(
          d.id,
          d.offeringInvestorPreviewJson,
          { notify: false },
        )
        onSyncedRef.current?.(d)
      },
    })
  }, [dealId, sections, previewHydrated])

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
      const { next, rejectedNames } = appendPdfFilesFromPicker(
        sectionFiles,
        e.currentTarget.files,
      )
      e.currentTarget.value = ""
      setSectionFiles(next)
      if (rejectedNames.length > 0) {
        setAddSectionError(
          rejectedNames.length === 1
            ? `"${rejectedNames[0]!}" is not a PDF. Only PDF files can be uploaded.`
            : `Only PDF files can be uploaded. Skipped: ${rejectedNames.join(", ")}.`,
        )
      } else {
        setAddSectionError(null)
      }
    },
    [sectionFiles],
  )

  const removeSectionFileAt = useCallback((index: number) => {
    setSectionFiles((prev) => prev.filter((_, i) => i !== index))
    setAddSectionError(null)
  }, [])

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
                sharedDealClassIds: [],
                sharedInvestorIds: [],
                sharedWithAllInvestors: false,
                sharedSponsorUserIds: [],
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

        setSections((prev) =>
          orderDocumentSectionsWithDefaultFirst([
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
          ]),
        )
        setShowAddSectionModal(false)
        setSectionName("")
        setSectionFiles([])
        setAddSectionError(null)
      })()
    },
    [dealId, sectionFiles, sectionName],
  )

  const appendUploadedFilesToSection = useCallback(
    async (
      targetSectionId: string,
      files: File[],
    ): Promise<string | null> => {
      if (files.length === 0) return "Select at least one PDF to upload."
      const nonPdf = files.filter((f) => !isDealOfferingDocumentPdfFile(f))
      if (nonPdf.length > 0) {
        return nonPdf.length === 1
          ? `"${nonPdf[0]!.name}" is not a PDF. Only PDF files can be uploaded.`
          : `Only PDF files can be uploaded. Remove: ${nonPdf.map((f) => f.name).join(", ")}.`
      }

      const idTrim = dealId.trim()
      if (!idTrim) return "Save the deal before uploading documents."

      const createdAt = Date.now()
      setDocumentUploadBusy(true)
      try {
        const up = await postDealOfferingDocumentUploads(idTrim, files)
        if (!up.ok) return up.message
        if (up.newPaths.length !== files.length) {
          return "Upload did not return a path for each selected file."
        }

        const newNestedBase = files.map((file, i) => {
          const stored = dealAssetRelativePathToUploadsUrl(up.newPaths[i]!)
          return {
            id: `upload-${createdAt}-${i}`,
            name: file.name,
            url: stored || null,
            dateAdded: formatDateAdded(),
            lpDisplaySectionId: targetSectionId,
            sharedDealClassIds: [] as string[],
            sharedInvestorIds: [] as string[],
            sharedWithAllInvestors: false,
            sharedSponsorUserIds: [] as string[],
          }
        })

        let resolvedSectionId = targetSectionId
        setSections((prev) => {
          let list = prev
          if (targetSectionId === DEFAULT_DOCUMENT_SECTION_ID) {
            const ensured = ensureDefaultDocumentSectionInList(list)
            list = ensured.sections
            resolvedSectionId = ensured.defaultSection.id
          } else if (!list.some((s) => s.id === targetSectionId)) {
            return prev
          }
          const newNested = newNestedBase.map((row) => ({
            ...row,
            lpDisplaySectionId: resolvedSectionId,
          }))
          return orderDocumentSectionsWithDefaultFirst(
            list.map((s) =>
              s.id !== resolvedSectionId
                ? s
                : {
                    ...s,
                    nestedDocuments: [...s.nestedDocuments, ...newNested],
                    dateAdded: formatDateAdded(),
                  },
            ),
          )
        })

        setExpandedSections((prev) => ({
          ...prev,
          [resolvedSectionId]: true,
        }))
        return null
      } catch (err) {
        return err instanceof Error ? err.message : "Document upload failed."
      } finally {
        setDocumentUploadBusy(false)
      }
    },
    [dealId],
  )

  const uploadFilesToDefaultSection = useCallback(
    async (files: File[]) => {
      setQuickUploadError(null)
      const err = await appendUploadedFilesToSection(
        DEFAULT_DOCUMENT_SECTION_ID,
        files,
      )
      if (err) setQuickUploadError(err)
    },
    [appendUploadedFilesToSection],
  )

  const onQuickUploadInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const picked = e.currentTarget.files
        ? Array.from(e.currentTarget.files)
        : []
      e.currentTarget.value = ""
      if (picked.length > 0) void uploadFilesToDefaultSection(picked)
    },
    [uploadFilesToDefaultSection],
  )

  const onQuickUploadDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setQuickUploadDropFocus(false)
      const dropped = e.dataTransfer.files
        ? Array.from(e.dataTransfer.files)
        : []
      if (dropped.length > 0) void uploadFilesToDefaultSection(dropped)
    },
    [uploadFilesToDefaultSection],
  )

  const onQuickUploadKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== "Enter" && e.key !== " ") return
      e.preventDefault()
      quickUploadInputRef.current?.click()
    },
    [],
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
      const { next, rejectedNames } = appendPdfFilesFromPicker(
        uploadFiles,
        e.currentTarget.files,
      )
      e.currentTarget.value = ""
      setUploadFiles(next)
      if (rejectedNames.length > 0) {
        setUploadDocsError(
          rejectedNames.length === 1
            ? `"${rejectedNames[0]!}" is not a PDF. Only PDF files can be uploaded.`
            : `Only PDF files can be uploaded. Skipped: ${rejectedNames.join(", ")}.`,
        )
      } else {
        setUploadDocsError(null)
      }
    },
    [uploadFiles],
  )

  const removeUploadFileAt = useCallback((index: number) => {
    setUploadFiles((prev) => prev.filter((_, i) => i !== index))
    setUploadDocsError(null)
  }, [])

  const onSubmitUploadDocuments = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      void (async () => {
        if (uploadFiles.length === 0) {
          setUploadDocsError("Upload at least one document.")
          return
        }
        const label = uploadTargetLabel.trim() || "Section"
        const target = sections.find((s) => sectionMatchesLabel(s, label))
        if (!target) {
          setUploadDocsError("Section not found.")
          return
        }
        setUploadDocsError(null)
        const err = await appendUploadedFilesToSection(target.id, uploadFiles)
        if (err) {
          setUploadDocsError(err)
          return
        }
        setShowUploadDocsModal(false)
        setUploadFiles([])
        setUploadDocsError(null)
      })()
    },
    [appendUploadedFilesToSection, sections, uploadFiles, uploadTargetLabel],
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
        sharedDealClassIds: [...doc.sharedDealClassIds],
        sharedInvestorIds: [...doc.sharedInvestorIds],
        sharedWithAllInvestors: doc.sharedWithAllInvestors,
        sharedSponsorUserIds: [...(doc.sharedSponsorUserIds ?? [])],
        ...(doc.sharedWithScope ? { sharedWithScope: doc.sharedWithScope } : {}),
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

  const lpInvestorRows = useMemo(
    () => filterLpInvestorsForDocumentSharedWith(investorRows),
    [investorRows],
  )

  const sponsorUserOptions = useMemo(
    () => buildSponsorUserPickerOptions(sponsorRosterRows, lpInvestorRows),
    [sponsorRosterRows, lpInvestorRows],
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
          return [
            d.name,
            sectionDisplayLabel(ref),
            sectionSharedWithDisplay(effectiveDocumentSharedWithScope(d, s)),
            [
              sharedAudienceSearchBlob(
                d.sharedDealClassIds,
                d.sharedInvestorIds,
                d.sharedWithAllInvestors,
                dealClasses,
                lpInvestorRows,
              ),
              sponsorAudienceSearchBlob(
                d.sharedSponsorUserIds ?? [],
                sponsorUserOptions,
              ),
            ].join(" "),
          ]
        }),
      ]
        .join(" ")
        .toLowerCase()
      return blob.includes(q)
    })
  }, [sections, query, dealClasses, lpInvestorRows, sponsorUserOptions])

  const emptySearchLabel = query.trim() ? "No sections match your search." : null

  const renderQuickUploadDropzone = (variant: "toolbar" | "panel") => (
    <div
      className={[
        variant === "panel" ? "deal_docs_empty_dropzone" : "",
        variant === "panel" && quickUploadDropFocus
          ? "deal_docs_empty_dropzone--focus"
          : "",
        variant === "panel" && documentUploadBusy
          ? "deal_docs_empty_dropzone--busy"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="button"
      tabIndex={0}
      aria-label="Upload PDF documents to the General section"
      aria-busy={documentUploadBusy}
      onClick={() => {
        if (!documentUploadBusy) quickUploadInputRef.current?.click()
      }}
      onKeyDown={onQuickUploadKeyDown}
      onDragEnter={(e) => {
        e.preventDefault()
        setQuickUploadDropFocus(true)
      }}
      onDragOver={(e) => {
        e.preventDefault()
        setQuickUploadDropFocus(true)
      }}
      onDragLeave={(e) => {
        e.preventDefault()
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setQuickUploadDropFocus(false)
        }
      }}
      onDrop={onQuickUploadDrop}
    >
      {documentUploadBusy ? (
        <Loader2
          size={variant === "panel" ? 22 : 16}
          strokeWidth={2}
          className="deals_deal_view_spinner"
          aria-hidden
        />
      ) : (
        <Upload
          size={variant === "panel" ? 22 : 16}
          strokeWidth={2}
          aria-hidden
        />
      )}
      {variant === "panel" ? (
        <>
          {/* <span className="deal_docs_empty_dropzone_title">Drop PDFs here</span> */}
          <span className="deal_docs_empty_dropzone_title">Click or drag PDFs</span>
          {/* <span className="deal_docs_empty_dropzone_hint">
            Files are saved in the <strong>General</strong> section below
          </span> */}
        </>
      ) : null}
    </div>
  )

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
          <div className="um_toolbar_actions deal_docs_toolbar_actions">
            <input
              ref={quickUploadInputRef}
              type="file"
              className="deal_docs_file_input"
              multiple
              accept="application/pdf,.pdf"
              onChange={onQuickUploadInputChange}
              aria-hidden
              tabIndex={-1}
            />
            {/* <div
              className={[
                "deal_docs_toolbar_dropzone",
                quickUploadDropFocus ? "deal_docs_toolbar_dropzone--focus" : "",
                documentUploadBusy ? "deal_docs_toolbar_dropzone--busy" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              role="button"
              tabIndex={0}
              aria-label="Upload PDF documents to the General section"
              aria-busy={documentUploadBusy}
              onClick={() => {
                if (!documentUploadBusy) quickUploadInputRef.current?.click()
              }}
              onKeyDown={onQuickUploadKeyDown}
              onDragEnter={(e) => {
                e.preventDefault()
                setQuickUploadDropFocus(true)
              }}
              onDragOver={(e) => {
                e.preventDefault()
                setQuickUploadDropFocus(true)
              }}
              onDragLeave={(e) => {
                e.preventDefault()
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                  setQuickUploadDropFocus(false)
                }
              }}
              onDrop={onQuickUploadDrop}
            >
              {documentUploadBusy ? (
                <Loader2
                  size={16}
                  strokeWidth={2}
                  className="deals_deal_view_spinner"
                  aria-hidden
                />
              ) : (
                <Upload size={16} strokeWidth={2} aria-hidden />
              )}
              <span className="deal_docs_toolbar_dropzone_label">
                Click or drag PDFs
              </span>
            </div> */}
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
        {quickUploadError ? (
          <p className="deals_create_error deal_docs_quick_upload_error" role="alert">
            {quickUploadError}
          </p>
        ) : null}

        <div className="deal_docs_ui_root">
          <div className="deal_docs_ui_empty_zone">
            {renderQuickUploadDropzone("panel")}
          </div>
          {emptySearchLabel ? (
            <p className="deal_docs_ui_empty">{emptySearchLabel}</p>
          ) : null}
          {filteredSections.map((section) => {
              const isOpen = expandedSections[section.id] ?? true
              const n = section.nestedDocuments.length
              const panelId = `${section.id}-docs-panel`
              const isDefaultSection = isDefaultDocumentSection(section)
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
                      {!isDefaultSection ? (
                        <button
                          type="button"
                          className="deal_docs_ui_banner_icon_btn deal_docs_ui_banner_icon_btn_danger"
                          aria-label={`Delete section ${section.sectionLabel}`}
                          onClick={() => {
                            setSections((prev) => {
                              const victim = prev.find((s) => s.id === section.id)
                              const next = orderDocumentSectionsWithDefaultFirst(
                                prev.filter((s) => s.id !== section.id),
                              )
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
                      ) : null}
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
                              <th
                                className="deal_docs_ui_th deal_docs_ui_th_shared_entities"
                                scope="col"
                              >
                                <DocumentsTableColumnHeader
                                  label="Shared With"
                                  hint={
                                    <p className="deals_table_header_tooltip_p">
                                      Pick deal classes, <strong>Sponsor user investors</strong>{" "}
                                      (all LPs that sponsor added), individual investors, or{" "}
                                      <strong>All Investors</strong>.
                                      Selected audiences only see the file in the LP portal and
                                      shared link when signed in. Leave everything unchecked for all
                                      viewers allowed by the section&apos;s visibility. Use the mail
                                      icon to email those investors.
                                    </p>
                                  }
                                />
                              </th>
                              <th className="deal_docs_ui_th deal_docs_ui_th_shared" scope="col">
                                <DocumentsTableColumnHeader
                                  label="Visibility"
                                  hint={
                                    <p className="deals_table_header_tooltip_p">
                                      <strong>Offering link</strong>: file appears on
                                      Preview offering and the no-login shared investor
                                      link (and for signed-in LPs). <strong>LP portal
                                      only</strong>: signed-in LPs only — not on the
                                      public offering link or preview.
                                    </p>
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
                                      <DocumentsTableDocName name={d.name} />
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
                                  <td className="deal_docs_ui_td deal_docs_ui_td_shared_entities">
                                    <DocumentSharedWithPicker
                                      dealId={dealId}
                                      idPrefix={`${section.id}-${d.id}`}
                                      classIds={d.sharedDealClassIds}
                                      investorIds={d.sharedInvestorIds}
                                      sponsorUserIds={d.sharedSponsorUserIds ?? []}
                                      allInvestors={d.sharedWithAllInvestors}
                                      dealClasses={dealClasses}
                                      investors={lpInvestorRows}
                                      sponsorUserOptions={sponsorUserOptions}
                                      docName={d.name}
                                      onClassChange={(classId, checked) => {
                                        setSections((prev) =>
                                          prev.map((s) =>
                                            s.id !== section.id
                                              ? s
                                              : {
                                                  ...s,
                                                  nestedDocuments: s.nestedDocuments.map(
                                                    (n) =>
                                                      n.id !== d.id
                                                        ? n
                                                        : {
                                                            ...n,
                                                            sharedDealClassIds: toggleIdInList(
                                                              n.sharedDealClassIds,
                                                              classId,
                                                              checked,
                                                            ),
                                                          },
                                                  ),
                                                },
                                          ),
                                        )
                                      }}
                                      onInvestorChange={(investorRowId, checked) => {
                                        setSections((prev) =>
                                          prev.map((s) =>
                                            s.id !== section.id
                                              ? s
                                              : {
                                                  ...s,
                                                  nestedDocuments: s.nestedDocuments.map(
                                                    (n) =>
                                                      n.id !== d.id
                                                        ? n
                                                        : {
                                                            ...n,
                                                            sharedWithAllInvestors: false,
                                                            sharedInvestorIds: toggleIdInList(
                                                              n.sharedInvestorIds,
                                                              investorRowId,
                                                              checked,
                                                            ),
                                                          },
                                                  ),
                                                },
                                          ),
                                        )
                                      }}
                                      onAllInvestorsChange={(checked) => {
                                        setSections((prev) =>
                                          prev.map((s) =>
                                            s.id !== section.id
                                              ? s
                                              : {
                                                  ...s,
                                                  nestedDocuments: s.nestedDocuments.map(
                                                    (n) =>
                                                      n.id !== d.id
                                                        ? n
                                                        : {
                                                            ...n,
                                                            sharedWithAllInvestors: checked,
                                                            sharedInvestorIds: checked
                                                              ? []
                                                              : n.sharedInvestorIds,
                                                            sharedSponsorUserIds: checked
                                                              ? []
                                                              : (n.sharedSponsorUserIds ?? []),
                                                          },
                                                  ),
                                                },
                                          ),
                                        )
                                      }}
                                      onSponsorUserChange={(sponsorUserId, checked) => {
                                        setSections((prev) =>
                                          prev.map((s) =>
                                            s.id !== section.id
                                              ? s
                                              : {
                                                  ...s,
                                                  nestedDocuments: s.nestedDocuments.map(
                                                    (n) =>
                                                      n.id !== d.id
                                                        ? n
                                                        : {
                                                            ...n,
                                                            sharedWithAllInvestors: false,
                                                            sharedSponsorUserIds: toggleIdInList(
                                                              n.sharedSponsorUserIds ?? [],
                                                              sponsorUserId,
                                                              checked,
                                                            ),
                                                          },
                                                  ),
                                                },
                                          ),
                                        )
                                      }}
                                    />
                                  </td>
                                  <td className="deal_docs_ui_td deal_docs_ui_td_shared">
                                    <div className="deal_docs_ui_shared">
                                      <div className="deal_docs_ui_shared_body">
                                        <select
                                          className="deal_docs_ui_pill_select deal_docs_ui_shared_select"
                                          aria-label={`Visibility for ${d.name}`}
                                          value={effectiveDocumentSharedWithScope(
                                            d,
                                            section,
                                          )}
                                          onChange={(e) => {
                                            const v =
                                              e.target.value as SectionSharedWithScope
                                            setSections((prev) =>
                                              prev.map((s) =>
                                                s.id !== section.id
                                                  ? s
                                                  : {
                                                      ...s,
                                                      nestedDocuments:
                                                        s.nestedDocuments.map((n) =>
                                                          n.id !== d.id
                                                            ? n
                                                            : {
                                                                ...n,
                                                                sharedWithScope: v,
                                                              },
                                                        ),
                                                    },
                                              ),
                                            )
                                          }}
                                        >
                                          <option value="offering_page">
                                            Offering link
                                          </option>
                                          <option value="lp_investor">
                                            LP portal only
                                          </option>
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
            })}
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
                        accept="application/pdf,.pdf"
                        onChange={onSectionFilesChange}
                        aria-invalid={false}
                      />
                    </label>
                    <ModalPendingDocumentFilesList
                      files={sectionFiles}
                      disabled={documentUploadBusy}
                      onRemove={removeSectionFileAt}
                    />
                    {sectionFiles.length > 0 ? (
                      <p className="deal_offering_muted">
                        {sectionFiles.length}{" "}
                        {sectionFiles.length === 1 ? "file" : "files"} will be
                        added to this section when you save.
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
                        accept="application/pdf,.pdf"
                        onChange={onUploadFilesChange}
                        aria-invalid={uploadFiles.length === 0 && uploadDocsError != null}
                      />
                    </label>
                    <ModalPendingDocumentFilesList
                      files={uploadFiles}
                      disabled={documentUploadBusy}
                      onRemove={removeUploadFileAt}
                    />
                    {uploadFiles.length > 0 ? (
                      <p className="deal_offering_muted">
                        {uploadFiles.length}{" "}
                        {uploadFiles.length === 1 ? "file" : "files"} will be
                        uploaded to this section.
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
