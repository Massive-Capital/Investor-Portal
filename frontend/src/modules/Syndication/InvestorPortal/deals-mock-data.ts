import { assetImagePathToUrl } from "../../../common/utils/apiBaseUrl"
import type { DealDetailApi } from "./Deals/api/dealsApi"
import { collectDealGalleryUrls } from "./Deals/utils/offeringGalleryUrls"
import {
  acceptedAmountForPayload,
  formatUsdDashboardAmount,
  fundedAmountForPayload,
  targetAmountNumberForDeal,
} from "./Deals/dealsDashboardMoney"
import type { DealInvestorClass } from "./Deals/types/deal-investor-class.types"
import type { DealInvestorsPayload } from "./Deals/types/deal-investors.types"
import type { DealListRow } from "./Deals/types/deals.types"
import { DEAL_STAGE_CHOICES } from "./Deals/types/deals.types"
import { formatInvestorCountDisplay } from "./Deals/dealsListDisplay"

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

export function dealStageLabel(code: string): string {
  const raw = String(code ?? "").trim()
  if (!raw) return ""
  const normalized =
    raw === "raising_capital"
      ? "capital_raising"
      : raw === "asset_managing"
        ? "managing_asset"
        : raw.toLowerCase() === "draft"
          ? "Draft"
          : raw
  const found = DEAL_STAGE_CHOICES.find((c) => c.value === normalized)
  return found?.label ?? normalized
}

/**
 * Merge investors payload + optional investor classes into a dashboard deal row.
 * Target = sum of class offering sizes, else list raise target. Distributions = accepted sum.
 */
export function mergeDealRecordWithInvestorsAndClasses(
  listRow: DealListRow,
  base: DealRecord,
  payload: DealInvestorsPayload | undefined | null,
  classes: DealInvestorClass[] | undefined | null,
): DealRecord {
  const cls = classes ?? []
  const targetNum = targetAmountNumberForDeal(listRow, cls)
  const targetAmount = formatUsdDashboardAmount(targetNum)

  if (!payload) {
    return {
      ...base,
      targetAmount,
      totalAccepted: formatUsdDashboardAmount(0),
      totalFunded: formatUsdDashboardAmount(0),
      totalDistributions: formatUsdDashboardAmount(0),
      investorCount: formatInvestorCountDisplay("0"),
    }
  }

  const acceptedNum = acceptedAmountForPayload(payload)
  const fundedNum = fundedAmountForPayload(payload)

  return {
    ...base,
    targetAmount,
    totalAccepted: formatUsdDashboardAmount(acceptedNum),
    totalFunded: formatUsdDashboardAmount(fundedNum),
    totalDistributions: formatUsdDashboardAmount(acceptedNum),
    investorCount: formatInvestorCountDisplay(String(payload.investors.length)),
  }
}

/** Merge without investor classes (raise target only). Prefer mergeDealRecordWithInvestorsAndClasses when you have classes. */
export function mergeDealRecordWithInvestorsPayload(
  base: DealRecord,
  payload: DealInvestorsPayload | undefined | null,
): DealRecord {
  const listRow = { id: base.id, raiseTarget: base.targetAmount } as DealListRow
  return mergeDealRecordWithInvestorsAndClasses(listRow, base, payload, [])
}

export function dealListRowToDealRecord(row: DealListRow): DealRecord {
  const loc = row.locationDisplay?.trim()
  const coverFromPick = row.galleryCoverImageUrl?.trim()
  const cover =
    coverFromPick || assetImagePathToUrl(row.assetImagePath ?? null)
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
  const galleryFirst = collectDealGalleryUrls(d)[0]
  const coverPick = d.galleryCoverImageUrl?.trim()
  const cover =
    coverPick || galleryFirst || assetImagePathToUrl(d.assetImagePath ?? null)
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
    ...(cover ? { coverImageUrl: cover } : {}),
  }
}
