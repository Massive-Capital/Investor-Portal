/**
 * Deal Documents tab: sections with nested files.
 * Flat offering preview docs are derived for investor preview + legacy storage.
 */

import { formatDateDdMmmYyyy } from "../../../../common/utils/formatDateDisplay"
import type {
  OfferingPreviewDocSharedWithScope,
  OfferingPreviewDocument,
} from "./offeringPreviewDocuments"
import {
  parseOfferingPreviewDocumentsJson,
  readOfferingPreviewDocuments,
  writeOfferingPreviewDocuments,
} from "./offeringPreviewDocuments"
import {
  getRuntimeOfferingPreviewSections,
  setRuntimeOfferingPreviewSections,
} from "./offeringPreviewRuntimeStore"
import { readLegacyOfferingPreviewDocumentsFromLocalStorage } from "./offeringPreviewLegacyLocalStorage"

/** Fired after `writeOfferingPreviewSections` (same tab + other tabs via storage). */
export const OFFERING_PREVIEW_SECTIONS_CHANGED_EVENT =
  "ip-offering-preview-sections-changed"

/** Stable id for cross-tab custom events (no longer a localStorage key). */
export function offeringPreviewSectionsStorageKey(dealId: string): string {
  return `ip_offering_preview_sections:v1:${dealId.trim()}`
}

export type OfferingPreviewDisplayDocument = {
  id: string
  name: string
  url: string | null
}

/**
 * Which document scopes appear on a given surface.
 * - Offering link + Preview offering: `offering_page` only.
 * - LP portal (signed-in LP on the deal): `offering_page` and `lp_investor`.
 */
export function sectionVisibleOnOfferingPreview(
  scope: SectionSharedWithScope,
  ctx: { isPublicAnonymousOffering: boolean; isLpDealWorkspace: boolean },
): boolean {
  if (ctx.isLpDealWorkspace) {
    return scope === "offering_page" || scope === "lp_investor"
  }
  return scope === "offering_page"
}

/**
 * Documents from the deal Documents tab (workspace sections) for offering preview.
 * Replaces the removed Offering details → Documents section.
 */
export function listWorkspaceDocumentsForOfferingPreview(
  dealId: string,
  ctx: { isPublicAnonymousOffering: boolean; isLpDealWorkspace: boolean },
): OfferingPreviewDisplayDocument[] {
  const id = dealId.trim()
  if (!id) return []
  const out: OfferingPreviewDisplayDocument[] = []
  for (const sec of readOfferingPreviewSections(id)) {
    for (const d of sec.nestedDocuments) {
      const scope = effectiveDocumentSharedWithScope(d, sec)
      if (!sectionVisibleOnOfferingPreview(scope, ctx)) continue
      out.push({ id: d.id, name: d.name, url: d.url })
    }
  }
  if (out.length > 0) return out
  const flat = readOfferingPreviewDocuments(id)
  for (const d of flat) {
    const scope: SectionSharedWithScope =
      d.sharedWithScope === "lp_investor" ? "lp_investor" : "offering_page"
    if (!sectionVisibleOnOfferingPreview(scope, ctx)) continue
    out.push({ id: d.id, name: d.name, url: d.url })
  }
  return out
}

/** Who can see documents in this section (documents table + preview context). */
export type SectionSharedWithScope = OfferingPreviewDocSharedWithScope

export function sectionSharedWithDisplay(scope: SectionSharedWithScope): string {
  return scope === "lp_investor" ? "LP portal only" : "Offering link"
}

/** Per-document scope when set; otherwise the section default. */
export function effectiveDocumentSharedWithScope(
  doc: NestedPreviewDocument,
  section: OfferingPreviewSection,
): SectionSharedWithScope {
  return doc.sharedWithScope ?? section.sharedWithScope
}

function parseSharedWithScope(
  rawScope: unknown,
  legacyVisibility: string,
): SectionSharedWithScope {
  if (rawScope === "lp_investor") return "lp_investor"
  if (rawScope === "offering_page") return "offering_page"
  const vis = legacyVisibility.trim().toLowerCase()
  if (vis.includes("lp") && vis.includes("investor")) return "lp_investor"
  if (vis.includes("offering") && (vis.includes("link") || vis.includes("page")))
    return "offering_page"
  return "offering_page"
}

function parseDocumentSharedWithScope(raw: unknown): SectionSharedWithScope | undefined {
  if (raw === "lp_investor") return "lp_investor"
  if (raw === "offering_page") return "offering_page"
  return undefined
}

export type NestedPreviewDocument = {
  id: string
  name: string
  url: string | null
  dateAdded: string
  /**
   * Which user-added section supplies the LP-visible label for this file.
   * Preview shows: "{that section's label} — {filename}".
   */
  lpDisplaySectionId: string
  /**
   * Optional LP audience: deal investor-class ids. Empty means no class-specific selection.
   */
  sharedDealClassIds: string[]
  /**
   * Optional LP audience: deal investor row ids. Empty means no investor-specific selection.
   */
  sharedInvestorIds: string[]
  /**
   * When true, the document is intended for every investor on the deal (deal members and
   * contacts from the Investors list). Individual `sharedInvestorIds` are ignored.
   */
  sharedWithAllInvestors: boolean
  /** Sponsor team members (deal members) who may access this file in the workspace. */
  sharedSponsorUserIds: string[]
  /**
   * Overrides the section scope for this file when set.
   * `offering_page`: offering link + preview (+ LPs when signed in).
   * `lp_investor`: LP portal only.
   */
  sharedWithScope?: SectionSharedWithScope
}

export type OfferingPreviewSection = {
  id: string
  sectionLabel: string
  documentLabel: string
  /** Kept in sync with `sharedWithScope` for search / legacy fields. */
  visibility: string
  sharedWithScope: SectionSharedWithScope
  requireLpReview: boolean
  dateAdded: string
  nestedDocuments: NestedPreviewDocument[]
}

export function sectionDisplayLabel(s: OfferingPreviewSection): string {
  const a = s.sectionLabel.trim()
  if (a) return a
  const b = s.documentLabel.trim()
  return b && b !== "—" ? b : "Section"
}

/** Stable id for quick uploads (click / drag) when no section is chosen. */
export const DEFAULT_DOCUMENT_SECTION_ID = "default-documents-section"

/** Label shown in the Documents tab for the default section. */
export const DEFAULT_DOCUMENT_SECTION_LABEL = "General"

export function isDefaultDocumentSection(s: OfferingPreviewSection): boolean {
  if (s.id === DEFAULT_DOCUMENT_SECTION_ID) return true
  return (
    s.sectionLabel.trim().toLowerCase() ===
    DEFAULT_DOCUMENT_SECTION_LABEL.toLowerCase()
  )
}

export function findDefaultDocumentSection(
  sections: OfferingPreviewSection[],
): OfferingPreviewSection | undefined {
  return sections.find(isDefaultDocumentSection)
}

/** Ensures the default section exists; returns updated list + that section row. */
export function ensureDefaultDocumentSectionInList(
  sections: OfferingPreviewSection[],
): {
  sections: OfferingPreviewSection[]
  defaultSection: OfferingPreviewSection
} {
  const existing = findDefaultDocumentSection(sections)
  if (existing) {
    return { sections, defaultSection: existing }
  }
  const defaultSection: OfferingPreviewSection = {
    id: DEFAULT_DOCUMENT_SECTION_ID,
    sectionLabel: DEFAULT_DOCUMENT_SECTION_LABEL,
    documentLabel: DEFAULT_DOCUMENT_SECTION_LABEL,
    visibility: sectionSharedWithDisplay("offering_page"),
    sharedWithScope: "offering_page",
    requireLpReview: false,
    dateAdded: formatDateDdMmmYyyy(new Date()),
    nestedDocuments: [],
  }
  return { sections: [...sections, defaultSection], defaultSection }
}

/** Default **General** section first; all other sections follow. */
export function orderDocumentSectionsWithDefaultFirst(
  sections: OfferingPreviewSection[],
): OfferingPreviewSection[] {
  const { sections: withDefault, defaultSection } =
    ensureDefaultDocumentSectionInList(sections)
  const others = withDefault.filter((s) => s.id !== defaultSection.id)
  return [defaultSection, ...others]
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v)
}

function parseIdListField(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((s) => s.trim())
}

function normalizeNested(
  raw: unknown,
  parentSectionId: string,
): NestedPreviewDocument | null {
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
      : "—"
  const refRaw = raw.lpDisplaySectionId
  const lpDisplaySectionId =
    typeof refRaw === "string" && refRaw.trim() ? refRaw.trim() : parentSectionId
  const sharedDealClassIds = parseIdListField(raw.sharedDealClassIds)
  const sharedWithAllInvestors = Boolean(raw.sharedWithAllInvestors)
  const sharedInvestorIds = sharedWithAllInvestors
    ? []
    : parseIdListField(raw.sharedInvestorIds)
  const sharedSponsorUserIds = parseIdListField(raw.sharedSponsorUserIds)
  const sharedWithScope = parseDocumentSharedWithScope(raw.sharedWithScope)
  return {
    id,
    name,
    url,
    dateAdded,
    lpDisplaySectionId,
    sharedDealClassIds,
    sharedInvestorIds,
    sharedWithAllInvestors,
    sharedSponsorUserIds,
    ...(sharedWithScope ? { sharedWithScope } : {}),
  }
}

function normalizeSection(raw: unknown): OfferingPreviewSection | null {
  if (!isRecord(raw)) return null
  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : ""
  const sectionLabel =
    typeof raw.sectionLabel === "string" && raw.sectionLabel.trim()
      ? raw.sectionLabel.trim()
      : typeof raw.label === "string" && raw.label.trim()
        ? raw.label.trim()
        : ""
  const documentLabel =
    typeof raw.documentLabel === "string" && raw.documentLabel.trim()
      ? raw.documentLabel.trim()
      : sectionLabel || "—"
  if (!id || !sectionLabel) return null
  const legacyVisibility =
    typeof raw.visibility === "string" && raw.visibility.trim()
      ? raw.visibility.trim()
      : "Offering page"
  const sharedWithScope = parseSharedWithScope(raw.sharedWithScope, legacyVisibility)
  const visibility = sectionSharedWithDisplay(sharedWithScope)
  const requireLpReview = Boolean(raw.requireLpReview)
  const dateAdded =
    typeof raw.dateAdded === "string" && raw.dateAdded.trim()
      ? raw.dateAdded.trim()
      : "—"
  const nestedRaw = raw.nestedDocuments
  const nestedDocuments: NestedPreviewDocument[] = []
  if (Array.isArray(nestedRaw)) {
    for (const item of nestedRaw) {
      const n = normalizeNested(item, id)
      if (n) nestedDocuments.push(n)
    }
  }
  return {
    id,
    sectionLabel,
    documentLabel,
    visibility,
    sharedWithScope,
    requireLpReview,
    dateAdded,
    nestedDocuments,
  }
}

function normalizeSectionsArray(parsed: unknown): OfferingPreviewSection[] {
  if (!Array.isArray(parsed)) return []
  const out: OfferingPreviewSection[] = []
  for (const item of parsed) {
    const s = normalizeSection(item)
    if (s) out.push(s)
  }
  return out
}

/** Ensure each nested doc’s lpDisplaySectionId points at a real section on this deal. */
function sanitizeSections(list: OfferingPreviewSection[]): OfferingPreviewSection[] {
  const ids = new Set(list.map((s) => s.id))
  const mapped = list.map((s) => {
    const sharedWithScope: OfferingPreviewDocSharedWithScope =
      s.sharedWithScope === "lp_investor" ? "lp_investor" : "offering_page"
    return {
      ...s,
      sharedWithScope,
      visibility: sectionSharedWithDisplay(sharedWithScope),
      nestedDocuments: s.nestedDocuments.map((d) => {
        const sharedWithAllInvestors = Boolean(d.sharedWithAllInvestors)
        const docScope = parseDocumentSharedWithScope(d.sharedWithScope)
        return {
          ...d,
          lpDisplaySectionId: ids.has(d.lpDisplaySectionId) ? d.lpDisplaySectionId : s.id,
          sharedDealClassIds: parseIdListField(d.sharedDealClassIds),
          sharedInvestorIds: sharedWithAllInvestors
            ? []
            : parseIdListField(d.sharedInvestorIds),
          sharedWithAllInvestors,
          sharedSponsorUserIds: parseIdListField(d.sharedSponsorUserIds),
          ...(docScope ? { sharedWithScope: docScope } : {}),
        }
      }),
    }
  })
  return orderDocumentSectionsWithDefaultFirst(mapped)
}

function maxDateString(dates: string[]): string {
  let best = 0
  let bestStr = "—"
  for (const d of dates) {
    const t = Date.parse(d)
    if (Number.isFinite(t) && t >= best) {
      best = t
      bestStr = d
    }
  }
  return bestStr
}

export function migrateFlatDocumentsToSections(
  flat: OfferingPreviewDocument[],
): OfferingPreviewSection[] {
  return sanitizeSections(migrateFlatToSections(flat))
}

function migrateFlatToSections(flat: OfferingPreviewDocument[]): OfferingPreviewSection[] {
  if (flat.length === 0) return []
  const sectionId = `migrated-${Date.now()}`
  const nestedDocuments: NestedPreviewDocument[] = flat.map((d) => ({
    id: d.id,
    name: d.name,
    url: d.url,
    dateAdded: d.dateAdded?.trim() || "—",
    lpDisplaySectionId: sectionId,
    sharedDealClassIds: [],
    sharedInvestorIds: [],
    sharedWithAllInvestors: false,
    sharedSponsorUserIds: [],
    ...(d.sharedWithScope ? { sharedWithScope: d.sharedWithScope } : {}),
  }))
  const datePool = nestedDocuments.map((d) => d.dateAdded).filter((d) => d !== "—")
  const dateAdded =
    datePool.length > 0 ? maxDateString(datePool) : formatDateDdMmmYyyy(new Date())
  return [
    {
      id: sectionId,
      sectionLabel: "Documents",
      documentLabel: "Documents",
      visibility: sectionSharedWithDisplay("offering_page"),
      sharedWithScope: "offering_page",
      requireLpReview: false,
      dateAdded,
      nestedDocuments,
    },
  ]
}

function previewDocDisplayName(
  sections: OfferingPreviewSection[],
  parent: OfferingPreviewSection,
  d: NestedPreviewDocument,
): string {
  const ref =
    sections.find((sec) => sec.id === d.lpDisplaySectionId) ?? parent
  const labelPart = sectionDisplayLabel(ref)
  const nm = d.name.trim()
  return `${labelPart} — ${nm}`
}

/** Parse composite flat name `{sectionLabel} — {fileName}` from preview flattening. */
export function parseFlatDocumentDisplayName(name: string): {
  sectionLabel: string
  fileName: string
} {
  const sep = " — "
  const idx = name.indexOf(sep)
  if (idx > 0) {
    const sectionLabel = name.slice(0, idx).trim()
    const fileName = name.slice(idx + sep.length).trim()
    return {
      sectionLabel,
      fileName: fileName || name.trim() || "Document",
    }
  }
  return { sectionLabel: "", fileName: name.trim() || "Document" }
}

/**
 * When flat preview docs exist but are missing from section nested lists, attach
 * them to the matching section (by label) so investors see every sponsor upload.
 */
export function reconcileFlatDocumentsIntoSections(
  sections: OfferingPreviewSection[],
  flat: OfferingPreviewDocument[],
): OfferingPreviewSection[] {
  const nestedIds = new Set(
    sections.flatMap((s) => s.nestedDocuments.map((d) => d.id)),
  )
  const orphanFlat = flat.filter((d) => d.id.trim() && !nestedIds.has(d.id.trim()))
  if (orphanFlat.length === 0) return sections

  const next = sections.map((s) => ({
    ...s,
    nestedDocuments: [...s.nestedDocuments],
  }))

  for (const fd of orphanFlat) {
    const { sectionLabel, fileName } = parseFlatDocumentDisplayName(fd.name)
    let section =
      sectionLabel.trim().length > 0
        ? next.find((s) => sectionDisplayLabel(s) === sectionLabel.trim())
        : undefined

    if (!section && sectionLabel.trim()) {
      const recoveredId = `recovered-${sectionLabel.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${fd.id.trim()}`
      section = {
        id: recoveredId,
        sectionLabel: sectionLabel.trim(),
        documentLabel: sectionLabel.trim(),
        visibility: sectionSharedWithDisplay("offering_page"),
        sharedWithScope: "offering_page",
        requireLpReview: false,
        dateAdded: fd.dateAdded?.trim() || "—",
        nestedDocuments: [],
      }
      next.push(section)
    }

    if (!section) continue

    section.nestedDocuments.push({
      id: fd.id.trim(),
      name: fileName,
      url: fd.url,
      dateAdded: fd.dateAdded?.trim() || "—",
      lpDisplaySectionId: section.id,
      sharedDealClassIds: [],
      sharedInvestorIds: [],
      sharedWithAllInvestors: false,
      sharedSponsorUserIds: [],
      ...(fd.sharedWithScope ? { sharedWithScope: fd.sharedWithScope } : {}),
    })
  }

  return next
}

export function flattenSectionsToPreviewDocs(
  sections: OfferingPreviewSection[],
): OfferingPreviewDocument[] {
  const out: OfferingPreviewDocument[] = []
  for (const s of sections) {
    for (const d of s.nestedDocuments) {
      out.push({
        id: d.id,
        name: previewDocDisplayName(sections, s, d),
        url: d.url,
        sharedWithScope: effectiveDocumentSharedWithScope(d, s),
        ...(d.dateAdded && d.dateAdded !== "—" ? { dateAdded: d.dateAdded } : {}),
      })
    }
  }
  return out
}

export function readOfferingPreviewSections(dealId: string | null | undefined): OfferingPreviewSection[] {
  const id = dealId?.trim() ?? ""
  if (!id) return []
  const flat = readOfferingPreviewDocuments(id)
  const cached = getRuntimeOfferingPreviewSections(id)
  if (cached) {
    return sanitizeSections(reconcileFlatDocumentsIntoSections(cached, flat))
  }
  if (flat.length === 0) return sanitizeSections([])
  const migrated = sanitizeSections(migrateFlatToSections(flat))
  setRuntimeOfferingPreviewSections(id, migrated)
  writeOfferingPreviewDocuments(id, flattenSectionsToPreviewDocs(migrated))
  return migrated
}

/**
 * Deal-scoped document sections for the syndication Documents tab (and eSign picker).
 * Only reads `offering_investor_preview_json` / runtime state keyed by this `dealId`.
 */
export function readDealDocumentSectionsForWorkspace(
  dealId: string | null | undefined,
): OfferingPreviewSection[] {
  const id = dealId?.trim() ?? ""
  if (!id) return []
  return orderDocumentSectionsWithDefaultFirst(
    reconcileFlatDocumentsIntoSections(
      readOfferingPreviewSections(id),
      readOfferingPreviewDocuments(id),
    ),
  )
}

export function writeOfferingPreviewSections(
  dealId: string,
  sections: OfferingPreviewSection[],
  opts?: { notify?: boolean },
): void {
  const id = dealId.trim()
  if (!id) return
  const sanitized = sanitizeSections(sections)
  setRuntimeOfferingPreviewSections(id, sanitized)
  writeOfferingPreviewDocuments(id, flattenSectionsToPreviewDocs(sanitized))
  if (typeof window !== "undefined" && opts?.notify !== false) {
    window.dispatchEvent(
      new CustomEvent(OFFERING_PREVIEW_SECTIONS_CHANGED_EVENT, {
        detail: { dealId: id },
      }),
    )
  }
}

/** Parse flat docs from legacy localStorage for one-time migration to the database. */
export function parseLegacyFlatDocumentsFromLocalStorage(
  dealId: string,
): OfferingPreviewDocument[] {
  return parseOfferingPreviewDocumentsJson(
    readLegacyOfferingPreviewDocumentsFromLocalStorage(dealId),
  )
}

/** Parse `sections` JSON from the server (same shape as localStorage). */
export function parseOfferingPreviewSectionsJson(
  raw: unknown,
): OfferingPreviewSection[] {
  return sanitizeSections(normalizeSectionsArray(raw))
}
