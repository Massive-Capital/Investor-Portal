import {
  accountStatusForUi,
  assignedDealCountFromRow,
  companyCellValue,
  formatMemberUsername,
  formatValue,
  memberRoleDisplayName,
  rowDisplayName,
  userStatusForUi,
} from "./memberAdminShared"

export function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function buildMembersCsv(
  rows: Record<string, unknown>[],
  showCompanyColumn: boolean,
): string {
  const headers = [
    "Name",
    "Username",
    "Email",
    ...(showCompanyColumn ? ["Company"] : []),
    "User role",
    "User Status",
    "Account status",
    "Assigned deals",
  ]
  const lines = [headers.map(escapeCsvCell).join(",")]
  for (const row of rows) {
    lines.push(
      [
        rowDisplayName(row),
        formatMemberUsername(row.username),
        formatValue(row.email),
        ...(showCompanyColumn ? [companyCellValue(row)] : []),
        memberRoleDisplayName(row.role),
        userStatusForUi(row).label,
        accountStatusForUi(row).label,
        String(assignedDealCountFromRow(row)),
      ]
        .map((c) => escapeCsvCell(c))
        .join(","),
    )
  }
  return `\uFEFF${lines.join("\r\n")}`
}

export function downloadMembersCsv(content: string, filename: string): void {
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

export function exportAuditLinesForMembers(
  rows: Record<string, unknown>[],
): string[] {
  return rows.map((row) => {
    const label = rowDisplayName(row)
    const em = formatValue(row.email).trim()
    const base = label && label !== "—" ? label : em || "—"
    if (em && em !== "—" && base !== em) return `${base} (${em})`
    if (em && em !== "—") return em
    return String(base)
  })
}

export function memberRowKey(row: Record<string, unknown>): string {
  const id = row.id
  if (typeof id === "string" && id.trim()) return id.trim()
  if (typeof id === "number" && Number.isFinite(id)) return String(id)
  const u = formatMemberUsername(row.username)
  const e = formatValue(row.email)
  return `k:${u}|${e}`
}
