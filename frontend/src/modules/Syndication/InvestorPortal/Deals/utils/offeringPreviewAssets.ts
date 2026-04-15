import type { DealDetailApi } from "../api/dealsApi"
import {
  assetTypeFromAttributes,
  computeDealAssetRowsFromClientStorage,
  formatAddressFromAssetDraft,
  formatAttributeValue,
  getDealAssetPersisted,
  type AssetAttributeRow,
  type DealAssetRow,
} from "../types/deal-asset.types"
import { normalizeDealGallerySrc } from "../../../../../common/utils/apiBaseUrl"
import { formatMoneyFieldDisplay } from "./offeringMoneyFormat"

export type OfferingPreviewAssetBlock = {
  id: string
  name: string
  address: string
  assetType: string
  yearBuilt: string
  numberOfUnits: string
  acquisitionPrice: string
  viewImagesCount: number
  galleryUrls: string[]
}

function dedupeNormalizedUrls(urls: readonly string[] | undefined): string[] {
  if (!urls?.length) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of urls) {
    const u = normalizeDealGallerySrc(raw).trim()
    if (!u) continue
    const key = u.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(u)
  }
  return out
}

function attrDisplay(
  rows: AssetAttributeRow[] | undefined,
  attrId: string,
): string {
  if (!rows?.length) return ""
  const r = rows.find((x) => x.id === attrId)
  if (!r) return ""
  const s = formatAttributeValue(r)
  return s.trim()
}

function acquisitionPriceDisplay(
  rows: AssetAttributeRow[] | undefined,
): string {
  const raw = attrDisplay(rows, "attr-acq-price")
  if (!raw) return "—"
  const formatted = formatMoneyFieldDisplay(raw)
  return formatted !== "—" ? formatted : raw
}

function addressFromDeal(detail: DealDetailApi): string {
  const street = [detail.addressLine1, detail.addressLine2]
    .map((x) => (x ?? "").trim())
    .filter(Boolean)
    .join(", ")
  const locality = [detail.city, detail.state, detail.zipCode]
    .map((x) => (x ?? "").trim())
    .filter(Boolean)
    .join(", ")
  const country = (detail.country ?? "").trim()
  const parts = [street, locality, country].filter(Boolean)
  if (parts.length) return parts.join(", ")
  return [detail.city, detail.country].filter((x) => x?.trim()).join(", ") || "—"
}

function orderedPreviewAssetRows(detail: DealDetailApi): DealAssetRow[] {
  const rows = computeDealAssetRowsFromClientStorage(detail).filter(
    (r) => !r.archived,
  )
  const ids = detail.offeringOverviewAssetIds?.filter(Boolean) ?? []
  const ordered: DealAssetRow[] = []
  if (ids.length > 0) {
    for (const id of ids) {
      const row = rows.find((r) => r.id === id)
      if (row) ordered.push(row)
    }
  }
  if (ordered.length === 0 && rows.length > 0) ordered.push(rows[0]!)
  return ordered
}

/**
 * Data for the offering preview “Assets” block (browser localStorage + deal fields).
 * LPs on a shared link only see persisted offering gallery + deal fields unless they
 * have the same origin storage as the sponsor.
 */
export function buildOfferingPreviewAssetBlocks(
  detail: DealDetailApi,
  galleryUrls: readonly string[],
): OfferingPreviewAssetBlock[] {
  const ordered = orderedPreviewAssetRows(detail)
  const galleryUrlCount = galleryUrls.length
  const singleAssetDeal = ordered.length <= 1
  if (ordered.length === 0) {
    return [
      {
        id: `fallback-${detail.id}`,
        name: detail.propertyName?.trim() || "—",
        address: addressFromDeal(detail),
        assetType: "—",
        yearBuilt: "—",
        numberOfUnits: "—",
        acquisitionPrice: "—",
        viewImagesCount: Math.max(0, galleryUrlCount),
        galleryUrls: dedupeNormalizedUrls(galleryUrls),
      },
    ]
  }

  return ordered.map((row) => {
    const persisted = getDealAssetPersisted(detail.id, row.id)
    const attrs = persisted?.attrRows
    const address =
      persisted?.draft != null
        ? formatAddressFromAssetDraft(persisted.draft).trim() ||
          row.address?.trim() ||
          addressFromDeal(detail)
        : row.address?.trim() || addressFromDeal(detail)

    const assetType =
      row.assetType && row.assetType !== "—"
        ? row.assetType.trim()
        : attrs
          ? assetTypeFromAttributes(attrs)
          : "—"

    const yearRaw = attrDisplay(attrs, "attr-year-built")
    const unitsRaw = attrDisplay(attrs, "attr-num-units")

    const rowGalleryUrls = dedupeNormalizedUrls(persisted?.imagePreviewDataUrls)
    const effectiveGalleryUrls =
      rowGalleryUrls.length > 0
        ? rowGalleryUrls
        : singleAssetDeal
          ? dedupeNormalizedUrls(galleryUrls)
          : []

    let viewImagesCount = Math.max(row.imageCount ?? 0, effectiveGalleryUrls.length)
    if (viewImagesCount === 0 && singleAssetDeal) viewImagesCount = galleryUrlCount

    return {
      id: row.id,
      name: row.name?.trim() || detail.propertyName?.trim() || "—",
      address: address || "—",
      assetType: assetType && assetType !== "—" ? assetType : "—",
      yearBuilt: yearRaw || "—",
      numberOfUnits: unitsRaw || "—",
      acquisitionPrice: acquisitionPriceDisplay(attrs),
      viewImagesCount,
      galleryUrls: effectiveGalleryUrls,
    }
  })
}
