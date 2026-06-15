import { downloadTableExportCsv } from "../../../../common/utils/tableExportFilename"
import { dealStageLabel } from "../../dealsDashboardUtils"
import {
  DEAL_FORM_TYPE_OPTIONS,
  DEAL_TYPE_LABELS,
  type DealListRow,
  type DealTypeOption,
} from "../types/deals.types"

function dealTypeLabel(code: string): string {
  if (code === "—" || !code) return "—"
  const fromForm = DEAL_FORM_TYPE_OPTIONS.find((o) => o.value === code)
  if (fromForm) return fromForm.label
  const k = code as DealTypeOption
  return DEAL_TYPE_LABELS[k] ?? code
}

export function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value))
    return `"${value.replace(/"/g, '""')}"`
  return value
}

export function buildDealsListExportCsv(rows: DealListRow[]): string {
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

export function downloadDealsListExportCsv(
  content: string,
  filename: string,
): void {
  downloadTableExportCsv(content, filename)
}

export function exportAuditLinesForDealListRows(rows: DealListRow[]): string[] {
  return rows.map((r) => r.dealName?.trim() || "—")
}
