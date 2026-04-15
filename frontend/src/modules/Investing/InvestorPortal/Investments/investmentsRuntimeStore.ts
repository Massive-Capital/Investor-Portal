import type { InvestmentListRow } from "./investments.types"

const STORAGE_KEY = "ip_investing_runtime_rows_v1"

type StoredRow = InvestmentListRow & {
  dealId: string
  updatedAtIso: string
}

function readStoredRows(): StoredRow[] {
  if (typeof localStorage === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const out: StoredRow[] = []
    for (const x of parsed) {
      if (!x || typeof x !== "object") continue
      const row = x as Partial<StoredRow>
      const id = String(row.id ?? "").trim()
      const dealId = String(row.dealId ?? "").trim()
      if (!id || !dealId) continue
      out.push({
        id,
        dealId,
        investmentName: String(row.investmentName ?? "").trim() || "—",
        offeringName: String(row.offeringName ?? "").trim() || "—",
        investmentProfile: String(row.investmentProfile ?? "").trim() || "—",
        investedAmount: Number(row.investedAmount ?? 0) || 0,
        distributedAmount: Number(row.distributedAmount ?? 0) || 0,
        currentValuation: String(row.currentValuation ?? "").trim() || "—",
        dealCloseDate: String(row.dealCloseDate ?? "").trim() || "—",
        status: String(row.status ?? "").trim() || "Active",
        actionRequired: String(row.actionRequired ?? "").trim() || "None",
        archived: Boolean(row.archived),
        updatedAtIso: String(row.updatedAtIso ?? "").trim() || "",
      })
    }
    return out
  } catch {
    return []
  }
}

function writeStoredRows(rows: StoredRow[]): void {
  if (typeof localStorage === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
  } catch {
    /* ignore */
  }
}

function runtimeIdForDeal(dealId: string): string {
  const safe = dealId.replace(/[^a-zA-Z0-9_-]/g, "_")
  return `runtime-${safe}`
}

export function upsertRuntimeInvestmentRow(input: {
  dealId: string
  investmentName: string
  offeringName: string
  investmentProfile: string
  investedAmount: number
  distributedAmount?: number
  currentValuation?: string
  dealCloseDate?: string
  status?: string
  actionRequired?: string
}): void {
  const dealId = input.dealId.trim()
  if (!dealId) return
  const id = runtimeIdForDeal(dealId)
  const rows = readStoredRows()
  const next: StoredRow = {
    id,
    dealId,
    investmentName: input.investmentName.trim() || "—",
    offeringName: input.offeringName.trim() || "—",
    investmentProfile: input.investmentProfile.trim() || "—",
    investedAmount: Number.isFinite(input.investedAmount) ? input.investedAmount : 0,
    distributedAmount: Number.isFinite(input.distributedAmount)
      ? Number(input.distributedAmount)
      : 0,
    currentValuation: input.currentValuation?.trim() || "—",
    dealCloseDate: input.dealCloseDate?.trim() || "—",
    status: input.status?.trim() || "Active",
    actionRequired: input.actionRequired?.trim() || "None",
    archived: false,
    updatedAtIso: new Date().toISOString(),
  }
  const idx = rows.findIndex((r) => r.id === id)
  if (idx >= 0) rows[idx] = next
  else rows.unshift(next)
  writeStoredRows(rows)
}

export function readRuntimeInvestmentRows(): InvestmentListRow[] {
  return readStoredRows().map(({ updatedAtIso: _drop, dealId: _dealId, ...row }) => row)
}

export function readRuntimeInvestmentRowById(
  id: string,
): InvestmentListRow | undefined {
  const key = id.trim()
  if (!key) return undefined
  const found = readStoredRows().find((r) => r.id === key)
  if (!found) return undefined
  const { updatedAtIso: _drop, dealId: _dealId, ...row } = found
  return row
}
