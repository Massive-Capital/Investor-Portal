/**
 * Investments list: server-backed rows (deals the user has committed on) plus
 * any localStorage rows from deal flows, merged by deal id.
 */
import { loadInvestmentListRowsFromDeals } from "./investmentsListFromDeals"
import type { InvestmentDetailRecord, InvestmentListRow } from "./investments.types"
import {
  readRuntimeInvestmentRowById,
  readRuntimeInvestmentRows,
} from "./investmentsRuntimeStore"

function dealKeyForRow(r: InvestmentListRow): string {
  const d = (r.dealId ?? "").trim()
  if (d) return d
  return r.id.trim()
}

/**
 * API rows fill the list when the server shows a commitment. Rows from
 * `upsertRuntimeInvestmentRow` (deal “add investment” / LP invest flow) take
 * precedence for invested amount and related fields so the amount stays what
 * that flow wrote.
 */
function mergeInvestmentLists(
  fromApi: InvestmentListRow[],
  fromLocal: InvestmentListRow[],
): InvestmentListRow[] {
  const byKey = new Map<string, InvestmentListRow>()
  for (const a of fromApi) {
    const k = dealKeyForRow(a)
    if (k) byKey.set(k, { ...a, dealId: a.dealId ?? k })
  }
  for (const l of fromLocal) {
    const k = dealKeyForRow(l)
    if (!k) continue
    const existing = byKey.get(k)
    if (!existing) {
      byKey.set(k, { ...l, dealId: l.dealId ?? k })
      continue
    }
    byKey.set(k, {
      ...existing,
      id: l.id,
      dealId: k,
      investedAmount: l.investedAmount,
      investmentName: l.investmentName,
      offeringName: l.offeringName,
      investmentProfile: l.investmentProfile,
      dealCloseDate: l.dealCloseDate,
      status: l.status,
      distributedAmount: Math.max(
        existing.distributedAmount,
        l.distributedAmount,
      ),
      currentValuation:
        l.currentValuation && l.currentValuation !== "—"
          ? l.currentValuation
          : existing.currentValuation,
      actionRequired: l.actionRequired || existing.actionRequired,
    })
  }
  return Array.from(byKey.values()).sort((a, b) =>
    (a.investmentName || "").localeCompare(b.investmentName || "", "en"),
  )
}

export async function getMergedInvestmentListRows(): Promise<InvestmentListRow[]> {
  const [fromApi, fromLocal] = await Promise.all([
    loadInvestmentListRowsFromDeals(),
    Promise.resolve(readRuntimeInvestmentRows()),
  ])
  return mergeInvestmentLists(fromApi, fromLocal)
}

function buildDetailRecordFromListRow(list: InvestmentListRow): InvestmentDetailRecord {
  return {
    id: list.id,
    list,
    propertyName: list.investmentName || "—",
    propertyType: "Other",
    propertyStatus: "Other",
    city: "—",
    state: "—",
    numberOfUnits: "—",
    occupancyPct: "—",
    ownedSince: "—",
    yearBuilt: "—",
    investedAs: "Limited partner",
    ownershipPct: "—",
    generalComments: "",
    overallAssetValue: "0",
    netOperatingIncome: "0",
    outstandingLoans: "0",
    debtService: "0",
    loanType: "Other",
    ioOrAmortizing: "Amortizing",
    maturityDate: "—",
    lender: "—",
    interestRatePct: "—",
  }
}

export function getInvestmentDetail(
  id: string,
): InvestmentDetailRecord | undefined {
  const row = readRuntimeInvestmentRowById(id)
  if (!row) return undefined
  return buildDetailRecordFromListRow(row)
}

export { readRuntimeInvestmentRowById, readRuntimeInvestmentRows }
