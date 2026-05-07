/**
 * Per-section visibility for “Make it visible to Investors” (Offering details accordions).
 * Stored in localStorage in the sponsor browser. Used on the offering preview page
 * (`/deals/:id/offering-portfolio` and `/offering_portfolio?preview=`) so the preview
 * matches what is enabled for the shared investor link.
 */

const STORAGE_PREFIX = "ip_offering_investor_preview_visibility:v1:"

export type OfferingDetailsSectionId =
  | "make_announcement"
  | "overview"
  | "offering_information"
  | "gallery"
  | "summary"
  | "documents"
  | "assets"
  | "key_highlights"
  | "funding_instructions"

export const OFFERING_DETAILS_SECTION_ORDER: {
  id: OfferingDetailsSectionId
  label: string
}[] = [
  { id: "make_announcement", label: "Make announcement" },
  { id: "overview", label: "Overview" },
  { id: "offering_information", label: "Classes" },
  { id: "gallery", label: "Gallery" },
  { id: "summary", label: "Summary" },
  { id: "documents", label: "Documents" },
  { id: "assets", label: "Assets" },
  { id: "key_highlights", label: "Key Highlights" },
  { id: "funding_instructions", label: "Funding Info" },
]

/** Offering Details tab accordion only (documents live under the deal Documents tab). */
export const OFFERING_DETAILS_ACCORDION_SECTION_ORDER =
  OFFERING_DETAILS_SECTION_ORDER.filter((s) => s.id !== "documents")

/** Sections that currently have matching blocks on the offering preview page. */
export function offeringSectionHasInvestorPreviewTarget(
  id: OfferingDetailsSectionId,
): boolean {
  return Boolean(id)
}

function storageKey(dealId: string): string {
  return `${STORAGE_PREFIX}${dealId.trim()}`
}

/** For `storage` event listeners when another tab updates visibility. */
export function offeringPreviewInvestorVisibilityStorageKey(
  dealId: string,
): string {
  return storageKey(dealId)
}

function allTrue(): Record<OfferingDetailsSectionId, boolean> {
  return Object.fromEntries(
    OFFERING_DETAILS_SECTION_ORDER.map(({ id }) => [id, true]),
  ) as Record<OfferingDetailsSectionId, boolean>
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v)
}

export function readOfferingPreviewInvestorVisibility(
  dealId: string,
): Record<OfferingDetailsSectionId, boolean> {
  const defaults = allTrue()
  const id = dealId.trim()
  if (!id || typeof window === "undefined") return defaults
  try {
    const raw = window.localStorage.getItem(storageKey(id))
    if (!raw?.trim()) return defaults
    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed)) return defaults
    const sections = parsed.sections
    if (!isRecord(sections)) return defaults
    const out = { ...defaults }
    for (const k of OFFERING_DETAILS_SECTION_ORDER) {
      const v = sections[k.id]
      if (typeof v === "boolean") out[k.id] = v
    }
    return out
  } catch {
    return defaults
  }
}

export function writeOfferingPreviewInvestorVisibility(
  dealId: string,
  flags: Record<OfferingDetailsSectionId, boolean>,
): void {
  const id = dealId.trim()
  if (!id || typeof window === "undefined") return
  try {
    const sections: Record<string, boolean> = {}
    for (const { id: sid } of OFFERING_DETAILS_SECTION_ORDER) {
      sections[sid] = Boolean(flags[sid])
    }
    window.localStorage.setItem(
      storageKey(id),
      JSON.stringify({ v: 1, sections }),
    )
  } catch {
    /* quota / private mode */
  }
}
