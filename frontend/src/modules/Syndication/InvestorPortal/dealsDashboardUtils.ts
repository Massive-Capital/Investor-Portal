/**
 * Deal dashboard & card helpers — maps API (`DealListRow`, `DealDetailApi`) to `DealRecord` and metrics.
 * (Renamed from `deals-mock-data.ts`; contains no static mock deals.)
 */
import type { DealCardMetric } from "../../../common/components/deal-card/DealCard"
import { assetImagePathToUrl } from "../../../common/utils/apiBaseUrl"
import type { DealDetailApi } from "./Deals/api/dealsApi"
import {
  dealTypeDisplayLabel,
  formatInvestorCountDisplay,
  secTypeDisplayLabel,
} from "./Deals/dealsListDisplay"
import {
  acceptedAmountForPayload,
  formatUsdDashboardAmount,
  fundedAmountForPayload,
  targetAmountNumberForDeal,
} from "./Deals/dealsDashboardMoney"
import { parseMoneyDigits } from "./Deals/utils/offeringMoneyFormat"
import type { DealInvestorClass } from "./Deals/types/deal-investor-class.types"
import type { DealInvestorsPayload } from "./Deals/types/deal-investors.types"
import type { DealListRow } from "./Deals/types/deals.types"
import { DEAL_STAGE_CHOICES } from "./Deals/types/deals.types"
import { collectDealGalleryUrls } from "./Deals/utils/offeringGalleryUrls"

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
  /** Raw `dealStage` from API (same as deals list) — drives stage chip colors on cards. */
  dealStage: string
  dealType?: string
  /** Wizard / legacy deal type → label for cards */
  dealTypeLabel?: string
  /** SEC registration type → label */
  secTypeDisplay?: string
  investmentTypeDisplay?: string
  propertyTypeDisplay?: string
  /** Smallest minimum investment across investor classes (investing dashboard cards). */
  minimumInvestmentDisplay?: string
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

function parseInvestorClassAdvancedJson(json: string): {
  investmentType: string
  propertyType: string
} {
  try {
    const o = JSON.parse(json || "{}") as Record<string, unknown>
    const investmentType =
      typeof o.investmentType === "string" ? o.investmentType.trim() : ""
    const tags = Array.isArray(o.assetTags)
      ? o.assetTags.filter((x): x is string => typeof x === "string")
      : []
    const propertyType = tags[0]?.trim() ?? ""
    return { investmentType, propertyType }
  } catch {
    return { investmentType: "", propertyType: "" }
  }
}

function displayLabelOrDash(raw: string | undefined): string {
  const t = String(raw ?? "").trim()
  if (t === "" || t === "—") return "—"
  return t
}

/**
 * Syndicating dashboard deal cards — financial KPIs + close date.
 */
export function dealRecordToCardMetrics(deal: DealRecord): DealCardMetric[] {
  return [
    { label: "Target amount", value: displayLabelOrDash(deal.targetAmount) },
    { label: "Total accepted", value: displayLabelOrDash(deal.totalAccepted) },
    { label: "Total funded", value: displayLabelOrDash(deal.totalFunded) },
    { label: "Total distributions", value: displayLabelOrDash(deal.totalDistributions) },
    { label: "# of investors", value: displayLabelOrDash(deal.investorCount) },
    {
      label: "Close date",
      value: displayLabelOrDash(deal.closeDateDisplay ?? deal.closeDate),
    },
  ]
}

/**
 * Investing dashboard deal cards (`includeParticipantDeals`) — offering / structure fields.
 */
export function dealRecordToInvestingCardMetrics(deal: DealRecord): DealCardMetric[] {
  return [
    {
      label: "Minimum investment",
      value: displayLabelOrDash(deal.minimumInvestmentDisplay),
    },
    { label: "Offering size", value: displayLabelOrDash(deal.targetAmount) },
    { label: "SEC type", value: displayLabelOrDash(deal.secTypeDisplay) },
    {
      label: "Deal type",
      value: displayLabelOrDash(deal.dealTypeLabel ?? deal.dealType),
    },
    {
      label: "Investment type",
      value: displayLabelOrDash(deal.investmentTypeDisplay),
    },
    {
      label: "Property type",
      value: displayLabelOrDash(deal.propertyTypeDisplay),
    },
  ]
}

function minimumInvestmentDisplayFromClasses(
  classes: DealInvestorClass[],
): string {
  let minVal = Infinity
  for (const c of classes) {
    const n = parseMoneyDigits(String(c.minimumInvestment ?? "").trim())
    if (Number.isFinite(n) && n >= 0 && n < minVal) minVal = n
  }
  if (minVal === Infinity) return "—"
  return formatUsdDashboardAmount(minVal)
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
  const targetAmount =
    targetNum === 0 ? "$0" : formatUsdDashboardAmount(targetNum)

  let investmentTypeDisplay = base.investmentTypeDisplay ?? "—"
  let propertyTypeDisplay = base.propertyTypeDisplay ?? "—"
  if (cls.length > 0) {
    const adv = parseInvestorClassAdvancedJson(cls[0]!.advancedOptionsJson)
    if (investmentTypeDisplay === "—" && adv.investmentType)
      investmentTypeDisplay = adv.investmentType
    if (propertyTypeDisplay === "—" && adv.propertyType)
      propertyTypeDisplay = adv.propertyType
  }

  const minimumInvestmentDisplay = minimumInvestmentDisplayFromClasses(cls)

  if (!payload) {
    return {
      ...base,
      targetAmount,
      totalAccepted: formatUsdDashboardAmount(0),
      totalFunded: formatUsdDashboardAmount(0),
      totalDistributions: formatUsdDashboardAmount(0),
      investorCount: formatInvestorCountDisplay("0"),
      investmentTypeDisplay,
      propertyTypeDisplay,
      minimumInvestmentDisplay,
      totalInProgress: base.totalInProgress,
    }
  }

  const acceptedNum = acceptedAmountForPayload(payload)
  const fundedNum = fundedAmountForPayload(payload)
  const remaining = Math.max(0, targetNum - acceptedNum)
  const totalInProgress = remaining === 0 ? "$0" : formatUsdDashboardAmount(remaining)

  const rawInv = String(listRow.investors ?? "").trim()
  const countFromList =
    rawInv && rawInv !== "—"
      ? rawInv.replace(/[^\d]/g, "")
      : ""
  const investorCountDisplay = formatInvestorCountDisplay(
    countFromList !== "" ? countFromList : String(payload.investors.length),
  )

  return {
    ...base,
    targetAmount,
    totalAccepted: formatUsdDashboardAmount(acceptedNum),
    totalFunded: formatUsdDashboardAmount(fundedNum),
    totalDistributions: formatUsdDashboardAmount(acceptedNum),
    investorCount: investorCountDisplay,
    totalInProgress,
    investmentTypeDisplay,
    propertyTypeDisplay,
    minimumInvestmentDisplay,
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

function listRowInvestmentPropertyLabels(row: DealListRow): {
  investmentTypeDisplay: string
  propertyTypeDisplay: string
} {
  const inv = String(row.investmentType ?? "").trim()
  const prop = String(row.propertyType ?? "").trim()
  return {
    investmentTypeDisplay: inv && inv !== "—" ? inv : "—",
    propertyTypeDisplay: prop && prop !== "—" ? prop : "—",
  }
}

export function dealListRowToDealRecord(row: DealListRow): DealRecord {
  const loc = row.locationDisplay?.trim()
  const coverFromPick = row.galleryCoverImageUrl?.trim()
  const cover =
    coverFromPick || assetImagePathToUrl(row.assetImagePath ?? null)
  const { investmentTypeDisplay, propertyTypeDisplay } =
    listRowInvestmentPropertyLabels(row)
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
    dealStage: String(row.dealStage ?? "").trim(),
    dealType: row.dealType,
    dealTypeLabel: dealTypeDisplayLabel(row.dealType ?? ""),
    secTypeDisplay: secTypeDisplayLabel(row.secType ?? ""),
    investmentTypeDisplay,
    propertyTypeDisplay,
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
    dealStage: String(d.dealStage ?? d.listRow.dealStage ?? "").trim(),
    dealType: d.dealType,
    dealTypeLabel: dealTypeDisplayLabel(d.dealType ?? ""),
    secTypeDisplay: secTypeDisplayLabel(d.secType ?? ""),
    investmentTypeDisplay: "—",
    propertyTypeDisplay: "—",
    totalInProgress: "—",
    createdDateDisplay: d.listRow.createdDateDisplay,
    closeDateDisplay: d.listRow.closeDateDisplay,
    createdAt: d.createdAt,
    ...(cover ? { coverImageUrl: cover } : {}),
  }
}
