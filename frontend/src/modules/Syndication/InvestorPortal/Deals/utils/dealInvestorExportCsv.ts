import { formatMemberUsername } from "../../../../usermanagement/memberAdminShared"
import { investorRoleLabel } from "../constants/investor-profile"
import type { DealInvestorRow } from "../types/deal-investors.types"
import {
  displayInvestorCommittedAmount,
  formatMoneyFieldDisplay,
} from "../utils/offeringMoneyFormat"
import { dealInvestorStatusForTable } from "./dealInvestorTableDisplay"

export function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function dealInvestorRowExportKey(row: DealInvestorRow): string {
  const id = row.id?.trim()
  if (id) return id
  const e = String(row.userEmail ?? "").trim()
  const n = String(row.displayName ?? "").trim()
  return `k:${n}|${e}`
}

export function exportAuditLinesForDealInvestorRows(
  rows: DealInvestorRow[],
): string[] {
  return rows.map((row) => {
    const name = String(row.displayName ?? "").trim()
    const em = String(row.userEmail ?? "").trim()
    if (name && name !== "—" && em && em !== "—") return `${name} (${em})`
    if (em && em !== "—") return em
    return name && name !== "—" ? name : "—"
  })
}

export function buildDealInvestorsExportCsv(
  rows: DealInvestorRow[],
  dealAllClassNamesLine: string,
): string {
  const headers = [
    "Member name",
    "Profile",
    "Role",
    "Investor class",
    "Status",
    "Committed",
    "Signed",
    "Funded",
    "Self accredited",
    "Verified accreditation",
    "Username",
    "Email",
  ]
  const lines = [headers.map(escapeCsvCell).join(",")]
  for (const row of rows) {
    const invClass =
      (row.investorClass ?? "").trim() ||
      dealAllClassNamesLine.trim() ||
      "—"
    const roleForCsv = investorRoleLabel(row.investorRole ?? "")
    const line = [
      row.displayName,
      row.entitySubtitle,
      roleForCsv,
      invClass,
      dealInvestorStatusForTable(row),
      formatMoneyFieldDisplay(displayInvestorCommittedAmount(row)),
      row.signedDate,
      row.fundedDate,
      row.selfAccredited,
      row.verifiedAccLabel,
      row.userDisplayName,
      row.userEmail,
    ]
    lines.push(line.map((c) => escapeCsvCell(String(c ?? ""))).join(","))
  }
  return `\uFEFF${lines.join("\r\n")}`
}

export function buildDealMembersTableExportCsv(rows: DealInvestorRow[]): string {
  const headers = [
    "User",
    "Role",
    "Class",
    "Status",
    "Added by",
    "Username",
    "Email",
  ]
  const lines = [headers.map(escapeCsvCell).join(",")]
  for (const row of rows) {
    const line = [
      row.displayName,
      investorRoleLabel(row.investorRole ?? ""),
      row.investorClass,
      dealInvestorStatusForTable(row),
      row.addedByDisplayName,
      formatMemberUsername(row.userDisplayName),
      row.userEmail,
    ]
    lines.push(line.map((c) => escapeCsvCell(String(c ?? ""))).join(","))
  }
  return `\uFEFF${lines.join("\r\n")}`
}

export function downloadDealExportCsv(content: string, filename: string): void {
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
