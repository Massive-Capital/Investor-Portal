/**
 * Minimal offering documents shown on the investor-facing preview.
 * Written from the deal Documents tab; read on the offering preview page (same browser).
 */

const STORAGE_PREFIX = "ip_offering_preview_docs:v1:"

/** Mirrors section “Shared with”; drives who sees the doc on Preview offering + shared link. */
export type OfferingPreviewDocSharedWithScope = "lp_investor" | "offering_page"

export type OfferingPreviewDocument = {
  id: string
  name: string
  url: string | null
  /** Optional; shown in sponsor workspace table */
  dateAdded?: string
  /**
   * `offering_page` (default): Preview offering, shared preview link, and portal LPs.
   * `lp_investor`: deal workspace / LP portal only — omitted from Preview offering
   * and the no-login shared link.
   */
  sharedWithScope?: OfferingPreviewDocSharedWithScope
}

function storageKey(dealId: string): string {
  return `${STORAGE_PREFIX}${dealId.trim()}`
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v)
}

function normalizeDoc(raw: unknown): OfferingPreviewDocument | null {
  if (!isRecord(raw)) return null
  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : ""
  const name =
    typeof raw.name === "string" && raw.name.trim()
      ? raw.name.trim()
      : typeof raw.documentName === "string" && raw.documentName.trim()
        ? raw.documentName.trim()
        : ""
  if (!id || !name) return null
  const urlRaw = raw.url
  const url =
    typeof urlRaw === "string" && urlRaw.trim()
      ? urlRaw.trim()
      : urlRaw === null
        ? null
        : null
  const dateAdded =
    typeof raw.dateAdded === "string" && raw.dateAdded.trim()
      ? raw.dateAdded.trim()
      : undefined
  const sw = raw.sharedWithScope
  const sharedWithScope: OfferingPreviewDocSharedWithScope | undefined =
    sw === "lp_investor"
      ? "lp_investor"
      : sw === "offering_page"
        ? "offering_page"
        : undefined
  return {
    id,
    name,
    url,
    ...(dateAdded ? { dateAdded } : {}),
    ...(sharedWithScope ? { sharedWithScope } : {}),
  }
}

export function readOfferingPreviewDocuments(
  dealId: string,
): OfferingPreviewDocument[] {
  const id = dealId.trim()
  if (!id || typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(storageKey(id))
    if (!raw?.trim()) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const out: OfferingPreviewDocument[] = []
    for (const item of parsed) {
      const d = normalizeDoc(item)
      if (d) out.push(d)
    }
    return out
  } catch {
    return []
  }
}

export function writeOfferingPreviewDocuments(
  dealId: string,
  docs: OfferingPreviewDocument[],
): void {
  const id = dealId.trim()
  if (!id || typeof window === "undefined") return
  try {
    window.localStorage.setItem(storageKey(id), JSON.stringify(docs))
  } catch {
    /* quota / private mode */
  }
}
