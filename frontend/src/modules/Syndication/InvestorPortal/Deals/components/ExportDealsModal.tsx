import { Search, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { dealStageLabel } from "../../deals-mock-data"
import {
  DEAL_FORM_TYPE_OPTIONS,
  DEAL_TYPE_LABELS,
  type DealListRow,
  type DealTypeOption,
} from "../types/deals.types"
import "./export-deals-modal.css"

interface ExportDealsModalProps {
  open: boolean
  onClose: () => void
  deals: DealListRow[]
}

function dealTypeLabel(code: string): string {
  if (code === "—" || !code) return "—"
  const fromForm = DEAL_FORM_TYPE_OPTIONS.find((o) => o.value === code)
  if (fromForm) return fromForm.label
  const k = code as DealTypeOption
  return DEAL_TYPE_LABELS[k] ?? code
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value))
    return `"${value.replace(/"/g, '""')}"`
  return value
}

function buildDealsCsv(rows: DealListRow[]): string {
  const headers = [
    "Deal name",
    "Deal type",
    "Deal stage",
    "Total in progress",
    "Total accepted",
    "Raise target",
    "Distributions",
    "Investors",
    "Close date",
    "Created date",
  ]
  const lines = [headers.map(escapeCsvCell).join(",")]
  for (const row of rows) {
    lines.push(
      [
        row.dealName,
        dealTypeLabel(row.dealType),
        dealStageLabel(row.dealStage),
        row.totalInProgress,
        row.totalAccepted,
        row.raiseTarget,
        row.distributions,
        row.investors,
        row.closeDateDisplay,
        row.createdDateDisplay,
      ]
        .map(escapeCsvCell)
        .join(","),
    )
  }
  return `\uFEFF${lines.join("\r\n")}`
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], {
    type: "text/csv;charset=utf-8;",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.rel = "noopener"
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function ExportDealsModal({
  open,
  onClose,
  deals,
}: ExportDealsModalProps) {
  const [modalQuery, setModalQuery] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const selectAllRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setModalQuery("")
    setSelectedIds(new Set())
  }, [open])

  const visibleDeals = useMemo(() => {
    const q = modalQuery.trim().toLowerCase()
    let list = [...deals]
    if (q)
      list = list.filter((r) => r.dealName.toLowerCase().includes(q))
    list.sort((a, b) => a.dealName.localeCompare(b.dealName))
    return list
  }, [deals, modalQuery])

  const visibleIds = useMemo(
    () => visibleDeals.map((r) => r.id),
    [visibleDeals],
  )

  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id))
  const someVisibleSelected = visibleIds.some((id) => selectedIds.has(id))

  useEffect(() => {
    const el = selectAllRef.current
    if (!el) return
    el.indeterminate = someVisibleSelected && !allVisibleSelected
  }, [someVisibleSelected, allVisibleSelected])

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLInputElement>("input[type='search']")?.focus()
    }, 0)
    return () => window.clearTimeout(t)
  }, [open])

  const toggleId = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAllVisible = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected)
        for (const id of visibleIds) next.delete(id)
      else for (const id of visibleIds) next.add(id)
      return next
    })
  }, [allVisibleSelected, visibleIds])

  function handleExportExcel() {
    const chosen = deals.filter((r) => selectedIds.has(r.id))
    if (chosen.length === 0) return
    const csv = buildDealsCsv(chosen)
    const stamp = new Date().toISOString().slice(0, 10)
    downloadCsv(csv, `deals-export-${stamp}.csv`)
    onClose()
  }

  if (!open) return null

  return (
    <div
      className="deals_export_modal_overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        className="deals_export_modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="deals-export-modal-title"
      >
        <header className="deals_export_modal_head">
          <h2 id="deals-export-modal-title" className="deals_export_modal_title">
            Export deals
          </h2>
          <button
            type="button"
            className="deals_export_modal_close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} strokeWidth={2} aria-hidden />
          </button>
        </header>

        <p className="deals_export_modal_hint">
          Search and select deals, then export to Excel (CSV format).
        </p>

        <div className="deals_export_modal_search">
          <input
            type="search"
            className="deals_export_modal_search_input"
            placeholder="Search deals…"
            value={modalQuery}
            onChange={(e) => setModalQuery(e.target.value)}
            aria-label="Search deals in export list"
          />
          <Search
            className="deals_export_modal_search_icon"
            size={18}
            strokeWidth={2}
            aria-hidden
          />
        </div>

        <label className="deals_export_modal_select_all">
          <input
            ref={selectAllRef}
            type="checkbox"
            checked={allVisibleSelected}
            onChange={toggleSelectAllVisible}
            aria-label={`Select all ${visibleDeals.length} deal${visibleDeals.length === 1 ? "" : "s"} shown`}
          />
          <span>
            Select all
            {visibleDeals.length !== deals.length ? (
              <span className="deals_export_modal_select_all_meta">
                {" "}
                ({visibleDeals.length} shown)
              </span>
            ) : null}
          </span>
        </label>

        <ul
          className="deals_export_modal_list"
          aria-label="Deals to export"
        >
          {visibleDeals.length === 0 ? (
            <li className="deals_export_modal_empty">No deals match your search.</li>
          ) : (
            visibleDeals.map((row) => (
              <li key={row.id} className="deals_export_modal_row">
                <label className="deals_export_modal_row_label">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(row.id)}
                    onChange={() => toggleId(row.id)}
                    aria-label={`Select ${row.dealName}`}
                  />
                  <span className="deals_export_modal_row_name">{row.dealName}</span>
                  <span className="deals_export_modal_row_meta">
                    {row.dealStage}
                  </span>
                </label>
              </li>
            ))
          )}
        </ul>

        <footer className="deals_export_modal_footer">
          <button
            type="button"
            className="deals_export_modal_btn_secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="deals_export_modal_btn_primary"
            onClick={handleExportExcel}
            disabled={selectedIds.size === 0}
          >
            Export to Excel
          </button>
        </footer>
      </div>
    </div>
  )
}
