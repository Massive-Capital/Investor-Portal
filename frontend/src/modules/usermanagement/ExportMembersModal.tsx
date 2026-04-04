import { Search, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import "../Syndication/InvestorPortal/Deals/components/export-deals-modal.css"
import {
  accountStatusLabel,
  formatMemberUsername,
  formatValue,
  memberRoleDisplayName,
  rowDisplayName,
} from "./memberAdminShared"
import {
  buildMembersCsv,
  downloadMembersCsv,
  exportAuditLinesForMembers,
  memberRowKey,
} from "./memberCsv"
import { notifyMembersExportAudit } from "./membersExportNotifyApi"

interface ExportMembersModalProps {
  open: boolean
  onClose: () => void
  members: Record<string, unknown>[]
  showCompanyColumn: boolean
}

function memberDisplayLabel(row: Record<string, unknown>): string {
  const n = rowDisplayName(row).trim()
  if (n && n !== "—") return n
  const e = formatValue(row.email).trim()
  if (e && e !== "—") return e
  const u = formatMemberUsername(row.username)
  return u && u !== "—" ? u : "—"
}

export function ExportMembersModal({
  open,
  onClose,
  members,
  showCompanyColumn,
}: ExportMembersModalProps) {
  const [modalQuery, setModalQuery] = useState("")
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set())
  const selectAllRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setModalQuery("")
    setSelectedKeys(new Set())
  }, [open])

  const visibleMembers = useMemo(() => {
    const q = modalQuery.trim().toLowerCase()
    let list = [...members]
    if (q) {
      list = list.filter((r) => {
        const hay = [
          rowDisplayName(r),
          formatValue(r.email),
          formatMemberUsername(r.username),
          formatValue(r.companyName),
          formatValue(r.company_name),
          formatValue(r.phone),
          formatValue(r.role),
          memberRoleDisplayName(r.role),
          formatValue(r.userStatus),
          accountStatusLabel(r),
        ]
          .join(" ")
          .toLowerCase()
        return hay.includes(q)
      })
    }
    list.sort((a, b) =>
      memberDisplayLabel(a).localeCompare(memberDisplayLabel(b)),
    )
    return list
  }, [members, modalQuery])

  const keyForRow = useCallback(
    (row: Record<string, unknown>) => memberRowKey(row),
    [],
  )

  const visibleKeys = useMemo(
    () => visibleMembers.map((r) => keyForRow(r)),
    [visibleMembers, keyForRow],
  )

  const allVisibleSelected =
    visibleKeys.length > 0 && visibleKeys.every((k) => selectedKeys.has(k))
  const someVisibleSelected = visibleKeys.some((k) => selectedKeys.has(k))

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

  const toggleKey = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const toggleSelectAllVisible = useCallback(() => {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) for (const k of visibleKeys) next.delete(k)
      else for (const k of visibleKeys) next.add(k)
      return next
    })
  }, [allVisibleSelected, visibleKeys])

  function handleExportExcel() {
    const keySet = selectedKeys
    const chosen = members.filter((r) => keySet.has(keyForRow(r)))
    if (chosen.length === 0) return
    const csv = buildMembersCsv(chosen, showCompanyColumn)
    const stamp = new Date().toISOString().slice(0, 10)
    downloadMembersCsv(csv, `members-export-${stamp}.csv`)
    void notifyMembersExportAudit({
      rowCount: chosen.length,
      exportedMemberLines: exportAuditLinesForMembers(chosen),
    })
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
        aria-labelledby="members-export-modal-title"
      >
        <header className="deals_export_modal_head">
          <h2 id="members-export-modal-title" className="deals_export_modal_title">
            Export members
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
          Search and select members, then export to Excel (CSV format).
        </p>

        <div className="deals_export_modal_search">
          <input
            type="search"
            className="deals_export_modal_search_input"
            placeholder="Search members…"
            value={modalQuery}
            onChange={(e) => setModalQuery(e.target.value)}
            aria-label="Search members in export list"
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
            aria-label={`Select all ${visibleMembers.length} member${visibleMembers.length === 1 ? "" : "s"} shown`}
          />
          <span>
            Select all
            {visibleMembers.length !== members.length ? (
              <span className="deals_export_modal_select_all_meta">
                {" "}
                ({visibleMembers.length} shown)
              </span>
            ) : null}
          </span>
        </label>

        <ul
          className="deals_export_modal_list"
          aria-label="Members to export"
        >
          {visibleMembers.length === 0 ? (
            <li className="deals_export_modal_empty">
              No members match your search.
            </li>
          ) : (
            visibleMembers.map((row) => {
              const k = keyForRow(row)
              return (
                <li key={k} className="deals_export_modal_row">
                  <label className="deals_export_modal_row_label">
                    <input
                      type="checkbox"
                      checked={selectedKeys.has(k)}
                      onChange={() => toggleKey(k)}
                      aria-label={`Select ${memberDisplayLabel(row)}`}
                    />
                    <span className="deals_export_modal_row_name">
                      {memberDisplayLabel(row)}
                    </span>
                    <span className="deals_export_modal_row_meta">
                      {formatValue(row.email) !== "—"
                        ? formatValue(row.email)
                        : formatMemberUsername(row.username)}
                    </span>
                  </label>
                </li>
              )
            })
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
            disabled={selectedKeys.size === 0}
          >
            Export to Excel
          </button>
        </footer>
      </div>
    </div>
  )
}
