import type { DealAssetRow } from "../types/deal-asset.types"
import type { DealInvestorClass } from "../types/deal-investor-class.types"
import { escapeCsvCell, downloadDealExportCsv } from "./dealInvestorExportCsv"

function exportFilenameStamp(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
}

export function buildDealAssetsExportCsv(rows: DealAssetRow[]): string {
  const headers = ["Name", "Address", "Asset type", "Images", "Status"]
  const lines = [headers.map(escapeCsvCell).join(",")]
  for (const row of rows) {
    lines.push(
      [
        row.name,
        row.address,
        row.assetType,
        String(row.imageCount),
        row.archived ? "Archived" : "Active",
      ]
        .map((c) => escapeCsvCell(String(c ?? "")))
        .join(","),
    )
  }
  return `\uFEFF${lines.join("\r\n")}`
}

export function buildInvestorClassesExportCsv(
  rows: DealInvestorClass[],
  dealStatusLabel: string,
  dealVisibilityLabel: string,
): string {
  const headers = [
    "Class name",
    "Subscription type",
    "Entity name",
    "Start date",
    "Offering size",
    "Distribution raise",
    "Minimum investment",
    "Deal status",
    "Visibility",
  ]
  const lines = [headers.map(escapeCsvCell).join(",")]
  for (const row of rows) {
    lines.push(
      [
        row.name,
        row.subscriptionType,
        row.entityName,
        row.startDate,
        row.offeringSize,
        row.raiseAmountDistributions,
        row.minimumInvestment,
        dealStatusLabel,
        dealVisibilityLabel,
      ]
        .map((c) => escapeCsvCell(String(c ?? "")))
        .join(","),
    )
  }
  return `\uFEFF${lines.join("\r\n")}`
}

export function downloadDealAssetsExportCsv(dealId: string, rows: DealAssetRow[]): string {
  const safeDeal = dealId.trim().replace(/[^\w-]+/g, "-") || "deal"
  const filename = `deal-assets-${safeDeal}-${exportFilenameStamp()}.csv`
  downloadDealExportCsv(buildDealAssetsExportCsv(rows), filename)
  return filename
}

export function downloadInvestorClassesExportCsv(
  dealId: string,
  rows: DealInvestorClass[],
  dealStatusLabel: string,
  dealVisibilityLabel: string,
): string {
  const safeDeal = dealId.trim().replace(/[^\w-]+/g, "-") || "deal"
  const filename = `deal-investor-classes-${safeDeal}-${exportFilenameStamp()}.csv`
  downloadDealExportCsv(
    buildInvestorClassesExportCsv(rows, dealStatusLabel, dealVisibilityLabel),
    filename,
  )
  return filename
}
