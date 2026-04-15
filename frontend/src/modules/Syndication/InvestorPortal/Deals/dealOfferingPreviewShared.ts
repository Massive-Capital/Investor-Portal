import { matchPath } from "react-router-dom"
import { formatDateDdMmmYyyy } from "../../../../common/utils/formatDateDisplay"
import type { DealDetailApi } from "./api/dealsApi"
import {
  acceptedAmountForPayload,
  formatUsdDashboardAmount,
  fundedAmountForPayload,
  targetAmountNumberForDeal,
} from "./dealsDashboardMoney"
import type { DealInvestorsPayload } from "./types/deal-investors.types"
import type { DealInvestorClass } from "./types/deal-investor-class.types"

/** Matches backend `offeringPreviewCrypto` UUID check for legacy `preview=` links. */
export const DEAL_OFFERING_PREVIEW_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isDealUuidForOfferingPreview(id: string | undefined): boolean {
  return Boolean(id?.trim() && DEAL_OFFERING_PREVIEW_UUID_RE.test(id.trim()))
}

export function dealIdFromOfferingPortfolioPathname(
  pathname: string,
): string | undefined {
  const normalized = pathname.replace(/\/+$/, "") || "/"
  const m = matchPath(
    { path: "/deals/:dealId/offering-portfolio", end: true },
    normalized,
  )
  const id = m?.params.dealId
  return typeof id === "string" && id.trim() ? id.trim() : undefined
}

export const EMPTY_INVESTORS_PAYLOAD: DealInvestorsPayload = {
  kpis: {
    offeringSize: "—",
    committed: "—",
    remaining: "—",
    totalApproved: "—",
    totalPending: "—",
    totalFunded: "—",
    approvedCount: "—",
    pendingCount: "—",
    waitlistCount: "—",
    averageApproved: "—",
    nonAccreditedCount: "—",
  },
  investors: [],
}

export function previewTargetDisplay(
  detail: DealDetailApi,
  classes: DealInvestorClass[],
): string {
  const n = targetAmountNumberForDeal(detail.listRow, classes)
  if (Number.isFinite(n) && n > 0) return formatUsdDashboardAmount(n)
  const raw =
    detail.offeringSize?.trim() ||
    detail.listRow.raiseTarget?.trim() ||
    ""
  if (raw && raw !== "—") return raw
  return "—"
}

export function previewAcceptedDisplay(
  detail: DealDetailApi,
  payload: DealInvestorsPayload,
): string {
  const num = acceptedAmountForPayload(payload)
  if (Number.isFinite(num) && num > 0) return formatUsdDashboardAmount(num)
  const kpi = payload.kpis.committed?.trim()
  if (kpi && kpi !== "—") return kpi
  const lr = detail.listRow.totalAccepted?.trim()
  if (lr && lr !== "—") return lr
  return "—"
}

export function previewFundedDisplay(payload: DealInvestorsPayload): string {
  const n = fundedAmountForPayload(payload)
  if (Number.isFinite(n) && n > 0) return formatUsdDashboardAmount(n)
  const kpi = payload.kpis.totalFunded?.trim()
  if (kpi && kpi !== "—") return kpi
  return "—"
}

export function buildSummaryBits(
  detail: DealDetailApi,
  classes: DealInvestorClass[],
  payload: DealInvestorsPayload,
): string[] {
  const bits: string[] = []
  const target = previewTargetDisplay(detail, classes)
  if (target !== "—") bits.push(`Offering target: ${target}`)

  const accepted = previewAcceptedDisplay(detail, payload)
  if (accepted !== "—") bits.push(`Total accepted: ${accepted}`)

  const funded = previewFundedDisplay(payload)
  if (funded !== "—") bits.push(`Total funded: ${funded}`)

  const inv = detail.listRow.investors?.trim()
  if (inv && inv !== "—") bits.push(`Investors: ${inv}`)

  if (detail.dealType?.trim())
    bits.push(`Deal type: ${detail.dealType.trim()}`)
  if (detail.secType?.trim())
    bits.push(`Security type: ${detail.secType.trim()}`)
  const close = formatDateDdMmmYyyy(detail.closeDate?.trim())
  if (close !== "—") bits.push(`Target close: ${close}`)
  return bits
}

export type KeyHighlightPreviewRow = { metric: string; newClass: string }

export function keyHighlightRowsFromJson(
  raw: string | null | undefined,
): KeyHighlightPreviewRow[] {
  const t = raw?.trim()
  if (!t) return []
  try {
    const parsed = JSON.parse(t) as unknown
    if (!Array.isArray(parsed)) return []
    const out: KeyHighlightPreviewRow[] = []
    for (const item of parsed) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue
      const o = item as Record<string, unknown>
      const metric = typeof o.metric === "string" ? o.metric.trim() : ""
      const nc = typeof o.newClass === "string" ? o.newClass.trim() : ""
      if (!metric && !nc) continue
      out.push({ metric: metric || "—", newClass: nc || "—" })
    }
    return out
  } catch {
    return []
  }
}
