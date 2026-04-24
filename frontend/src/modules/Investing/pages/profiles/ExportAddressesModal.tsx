import { Download, Search, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "@/common/components/Toast"
import { formatSavedAddressLabel, type SavedAddress } from "./address.types"
import { COUNTRY_OPTIONS, US_STATE_OPTIONS } from "./usStates"
import {
  buildAddressesExportCsv,
  downloadExportCsv,
} from "./investingProfileBookExport"
import "@/modules/Syndication/InvestorPortal/Deals/components/export-deals-modal.css"

interface ExportAddressesModalProps {
  open: boolean
  onClose: () => void
  addresses: SavedAddress[]
}

export function ExportAddressesModal({
  open,
  onClose,
  addresses,
}: ExportAddressesModalProps) {
  const [modalQuery, setModalQuery] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const selectAllRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setModalQuery("")
    setSelectedIds(new Set())
  }, [open])

  const visibleRows = useMemo(() => {
    const q = modalQuery.trim().toLowerCase()
    let list = [...addresses]
    if (q) {
      list = list.filter((a) => {
        const stateLabel =
          US_STATE_OPTIONS.find((s) => s.value === a.state)?.label ?? a.state
        const countryLabel =
          COUNTRY_OPTIONS.find((c) => c.value === a.country)?.label ?? a.country
        const line = [
          a.fullNameOrCompany,
          a.street1,
          a.street2,
          a.city,
          stateLabel,
          a.zip,
          countryLabel,
          a.checkMemo,
          a.distributionNote,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
        return line.includes(q) || formatSavedAddressLabel(a).toLowerCase().includes(q)
      })
    }
    list.sort((a, b) =>
      (a.fullNameOrCompany ?? "").localeCompare(b.fullNameOrCompany ?? "", undefined, {
        sensitivity: "base",
      }),
    )
    return list
  }, [addresses, modalQuery])

  const visibleIds = useMemo(() => visibleRows.map((r) => r.id), [visibleRows])

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
      panelRef.current
        ?.querySelector<HTMLInputElement>("input[type='search']")
        ?.focus()
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
      if (allVisibleSelected) for (const id of visibleIds) next.delete(id)
      else for (const id of visibleIds) next.add(id)
      return next
    })
  }, [allVisibleSelected, visibleIds])

  function handleExportExcel() {
    const chosen = addresses.filter((r) => selectedIds.has(r.id))
    if (chosen.length === 0) return
    const csv = buildAddressesExportCsv(chosen)
    const stamp = new Date().toISOString().slice(0, 10)
    const filename = `saved-addresses-export-${stamp}.csv`
    downloadExportCsv(csv, filename, true)
    toast.success("Addresses exported", `Saved as ${filename}`)
    onClose()
  }

  if (!open) return null

  return (
    <div className="deals_export_modal_overlay" role="presentation">
      <div
        ref={panelRef}
        className="deals_export_modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="addresses-export-modal-title"
      >
        <header className="deals_export_modal_head">
          <h2
            id="addresses-export-modal-title"
            className="deals_export_modal_title"
          >
            Export addresses
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
          Search and select addresses, then export to Excel (CSV format).
        </p>

        <div className="deals_export_modal_search">
          <input
            type="search"
            className="deals_export_modal_search_input"
            placeholder="Search addresses…"
            value={modalQuery}
            onChange={(e) => setModalQuery(e.target.value)}
            aria-label="Search addresses in export list"
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
            aria-label={`Select all ${visibleRows.length} ${
              visibleRows.length === 1 ? "address" : "addresses"
            } shown`}
          />
          <span>
            Select all
            {visibleRows.length !== addresses.length ? (
              <span className="deals_export_modal_select_all_meta">
                {" "}
                ({visibleRows.length} shown)
              </span>
            ) : null}
          </span>
        </label>

        <ul className="deals_export_modal_list" aria-label="Addresses to export">
          {visibleRows.length === 0 ? (
            <li className="deals_export_modal_empty">
              No addresses match your search.
            </li>
          ) : (
            visibleRows.map((row) => (
              <li key={row.id} className="deals_export_modal_row">
                <label className="deals_export_modal_row_label">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(row.id)}
                    onChange={() => toggleId(row.id)}
                    aria-label={`Select ${row.fullNameOrCompany || "address"}`}
                  />
                  <span className="deals_export_modal_row_name">
                    {row.fullNameOrCompany || "—"}
                  </span>
                  <span className="deals_export_modal_row_meta">
                    {formatSavedAddressLabel(row)}
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
            <X size={16} strokeWidth={2} aria-hidden />
            Cancel
          </button>
          <button
            type="button"
            className="deals_export_modal_btn_primary"
            onClick={handleExportExcel}
            disabled={selectedIds.size === 0}
          >
            <Download size={16} strokeWidth={2} aria-hidden />
            Export to Excel
          </button>
        </footer>
      </div>
    </div>
  )
}
