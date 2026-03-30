import { assetImagePathToUrl } from "../../../common/utils/apiBaseUrl"
import type { DealDetailApi } from "./Deals/api/dealsApi"
import type { DealListRow } from "./Deals/types/deals.types"
import { DEAL_STAGE_CHOICES } from "./Deals/types/deals.types"

export interface DealRecord {
  id: string
  title: string
  location?: string
  targetAmount: string
  totalAccepted: string
  totalFunded: string
  totalDistributions: string
  investorCount: string
  closeDate: string
  statusLabel: string
  dealType?: string
  totalInProgress?: string
  createdDateDisplay?: string
  closeDateDisplay?: string
  createdAt?: string
  /** Resolved `/uploads/...` URL for dashboard card cover */
  coverImageUrl?: string
}

export const dealsDashboardMetrics = {
  reviewCount: "2",
  billingQuota: "$51MM",
  totalTarget: "$75.28MM",
  totalDistributions: "$3.49MM",
  investmentCount: "864",
  contactCount: "1,584",
}

export function dealStageLabel(code: string): string {
  const found = DEAL_STAGE_CHOICES.find((c) => c.value === code)
  return found?.label ?? code
}

export function dealListRowToDealRecord(row: DealListRow): DealRecord {
  const loc = row.locationDisplay?.trim()
  const cover = assetImagePathToUrl(row.assetImagePath ?? null)
  return {
    id: row.id,
    title: row.dealName ?? "",
    location: loc && loc !== "—" ? loc : undefined,
    targetAmount: row.raiseTarget,
    totalAccepted: row.totalAccepted,
    totalFunded: "—",
    totalDistributions: row.distributions,
    investorCount: row.investors,
    closeDate: row.closeDateDisplay,
    statusLabel: dealStageLabel(row.dealStage),
    dealType: row.dealType,
    totalInProgress: row.totalInProgress,
    createdDateDisplay: row.createdDateDisplay,
    closeDateDisplay: row.closeDateDisplay,
    createdAt: row.createdAt,
    ...(cover ? { coverImageUrl: cover } : {}),
  }
}

export function dealDetailApiToRecord(d: DealDetailApi): DealRecord {
  const loc = [d.city, d.country].filter((x) => x?.trim()).join(", ")
  return {
    id: d.id,
    title: d.dealName,
    location: loc || undefined,
    targetAmount: "—",
    totalAccepted: d.listRow.totalAccepted,
    totalFunded: "—",
    totalDistributions: "—",
    investorCount: d.listRow.investors,
    closeDate: d.closeDate ?? d.listRow.closeDateDisplay,
    statusLabel: dealStageLabel(d.dealStage),
    dealType: d.dealType,
    totalInProgress: "—",
    createdDateDisplay: d.listRow.createdDateDisplay,
    closeDateDisplay: d.listRow.closeDateDisplay,
    createdAt: d.createdAt,
  }
}
