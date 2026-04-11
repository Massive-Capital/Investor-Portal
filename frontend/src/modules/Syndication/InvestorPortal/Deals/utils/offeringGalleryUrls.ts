import {
  assetImagePathsToUrls,
  getUploadsPublicOrigin,
  normalizeDealGallerySrc,
} from "../../../../../common/utils/apiBaseUrl"
import type { DealDetailApi } from "../api/dealsApi"
import { readDealAssetsFullMap } from "../types/deal-asset.types"

/**
 * True when two gallery `src` values point at the same asset (strict match, or
 * same pathname/search across origins e.g. localhost vs 127.0.0.1, or absolute vs `/uploads/...`).
 */
export function galleryUrlsReferToSameAsset(a: string, b: string): boolean {
  const x = a.trim()
  const y = b.trim()
  if (x === y) return true
  if (!x || !y) return false

  const fromAbsolute = (s: string): string | null => {
    try {
      const u = new URL(s)
      if (u.protocol !== "http:" && u.protocol !== "https:") return null
      const p = decodeURIComponent(u.pathname.replace(/\/$/, ""))
      return p + u.search
    } catch {
      return null
    }
  }

  const fromRootRelative = (s: string): string | null => {
    const t = s.trim()
    if (!t.startsWith("/")) return null
    try {
      const u = new URL(t, "http://placeholder.local")
      const p = decodeURIComponent(u.pathname.replace(/\/$/, ""))
      return p + u.search
    } catch {
      return null
    }
  }

  const key = (s: string) =>
    /^https?:\/\//i.test(s) ? fromAbsolute(s) : fromRootRelative(s)

  const kx = key(x)
  const ky = key(y)
  return kx != null && ky != null && kx === ky
}

function pushUniqueGalleryUrl(out: string[], raw: string): void {
  const s = normalizeDealGallerySrc(raw).trim()
  if (!s) return
  if (out.some((e) => galleryUrlsReferToSameAsset(e, s))) return
  out.push(s)
}

/** Ordered unique upload-relative segments: persisted gallery first, then `assetImagePath`. */
function mergeOfferingGalleryPathSegments(
  persisted: string[] | undefined,
  assetImagePath: string | null | undefined,
): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const add = (raw: string) => {
    const t = raw.trim().replace(/^\/+/, "")
    if (!t) return
    const key = t.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push(t)
  }
  for (const p of persisted ?? []) add(p)
  if (assetImagePath) {
    for (const s of String(assetImagePath).split(";")) add(s)
  }
  return out
}

/**
 * From displayed gallery URLs, extract upload-relative paths (for persisting to the API).
 * Skips `data:` URLs and non-`/uploads/` absolute links.
 */
export function uploadRelativePathsFromGalleryUrls(urls: string[]): string[] {
  const origin = getUploadsPublicOrigin().replace(/\/$/, "")
  const uploadPrefix = "/uploads/"
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of urls) {
    const s = raw.trim()
    if (!s || s.startsWith("data:")) continue
    let rel: string | null = null
    if (s.startsWith(uploadPrefix)) {
      rel = s.slice(uploadPrefix.length).replace(/^\/+/, "")
    } else if (origin) {
      const prefix = `${origin}${uploadPrefix}`
      if (s.startsWith(prefix)) {
        try {
          rel = decodeURIComponent(s.slice(prefix.length).replace(/^\/+/, ""))
        } catch {
          rel = s.slice(prefix.length).replace(/^\/+/, "")
        }
      }
    }
    if (!rel) {
      try {
        const u = new URL(s)
        const idx = u.pathname.indexOf("/uploads/")
        if (idx >= 0) {
          const slice = u.pathname
            .slice(idx + uploadPrefix.length)
            .replace(/^\/+/, "")
          try {
            rel = decodeURIComponent(slice)
          } catch {
            rel = slice
          }
        }
      } catch {
        /* ignore */
      }
    }
    if (!rel || rel.includes("..")) continue
    if (!/^[\w./-]+$/.test(rel)) continue
    if (seen.has(rel)) continue
    seen.add(rel)
    out.push(rel)
  }
  return out
}

/** Upload-relative paths referenced anywhere in persisted deal asset maps (localStorage). */
export function collectUploadRelativePathsFromDealAssetsMap(
  dealId: string,
): string[] {
  const urls: string[] = []
  try {
    const map = readDealAssetsFullMap(dealId)
    for (const e of Object.values(map)) {
      for (const u of e.imagePreviewDataUrls ?? []) {
        if (typeof u === "string" && u.trim()) urls.push(u)
      }
    }
  } catch {
    /* ignore */
  }
  return uploadRelativePathsFromGalleryUrls(urls)
}

/**
 * Ordered unique path segments to persist: parsed from gallery URLs, asset map, and raw `assetImagePath`.
 */
export function mergePathSegmentsForOfferingGalleryPersist(
  detail: DealDetailApi,
  urlsFromCollect: string[],
): string[] {
  const fromUrls = uploadRelativePathsFromGalleryUrls(urlsFromCollect)
  const fromMap = collectUploadRelativePathsFromDealAssetsMap(detail.id)
  const fromAsset =
    detail.assetImagePath?.split(";").map((s) => s.trim().replace(/^\/+/, "")) ??
    []
  const fromAssetOk = fromAsset.filter(
    (t) =>
      Boolean(t) &&
      !t.includes("..") &&
      /^[\w./-]+$/.test(t),
  )
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of [...fromUrls, ...fromMap, ...fromAssetOk]) {
    const key = p.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(p)
  }
  return out
}

/**
 * URLs for offering gallery / preview: persisted `offeringGalleryPaths`, API `assetImagePath`,
 * saved `galleryCoverImageUrl` (https, data URL, or `/uploads/...`),
 * plus any `imagePreviewDataUrls` persisted in local asset maps for this deal.
 *
 * When the deal already has server `/uploads/...` gallery URLs, we skip `data:` previews from
 * the asset map — they are the same photos kept for the asset editor and would otherwise show
 * twice (data URL + file URL) because `galleryUrlsReferToSameAsset` cannot match blob URLs to
 * upload paths.
 */
export function collectDealGalleryUrls(detail: DealDetailApi): string[] {
  const merged = mergeOfferingGalleryPathSegments(
    detail.offeringGalleryPaths,
    detail.assetImagePath,
  )
  const fromApi = assetImagePathsToUrls(
    merged.length ? merged.join(";") : null,
  )
  const fromAssets: string[] = []
  try {
    const map = readDealAssetsFullMap(detail.id)
    for (const entry of Object.values(map)) {
      const previews = entry.imagePreviewDataUrls
      if (previews?.length) fromAssets.push(...previews)
    }
  } catch {
    /* ignore */
  }
  const out: string[] = []
  for (const u of fromApi) pushUniqueGalleryUrl(out, u)
  const skipLocalDataPreviews = fromApi.length > 0
  for (const u of fromAssets) {
    if (skipLocalDataPreviews && u.trim().toLowerCase().startsWith("data:"))
      continue
    pushUniqueGalleryUrl(out, u)
  }
  const cover = detail.galleryCoverImageUrl?.trim() ?? ""
  if (cover) pushUniqueGalleryUrl(out, cover)
  return out
}

/** Puts the saved cover URL first so the offering hero matches the dashboard card. */
export function orderedGalleryUrlsForOffering(detail: DealDetailApi): string[] {
  const all = collectDealGalleryUrls(detail)
  const pickRaw = detail.galleryCoverImageUrl?.trim()
  const pick = pickRaw ? normalizeDealGallerySrc(pickRaw).trim() : ""
  if (!pick) return all
  if (all.length === 0) return [pick]
  const idx = all.findIndex((u) => galleryUrlsReferToSameAsset(u, pick))
  if (idx < 0) return [pick, ...all]
  if (idx === 0) return all
  const next = [...all]
  const [c] = next.splice(idx, 1)
  return [c, ...next]
}
