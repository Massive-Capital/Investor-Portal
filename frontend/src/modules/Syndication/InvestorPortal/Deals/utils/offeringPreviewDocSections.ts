/**
 * Deal Documents tab: sections with nested files.
 * Flat offering preview docs are derived for investor preview + legacy storage.
 */

import { formatDateDdMmmYyyy } from "../../../../../common/utils/formatDateDisplay"
import type {
  OfferingPreviewDocSharedWithScope,
  OfferingPreviewDocument,
} from "./offeringPreviewDocuments"
import {
  readOfferingPreviewDocuments,
  writeOfferingPreviewDocuments,
} from "./offeringPreviewDocuments"

const SECTIONS_STORAGE_PREFIX = "ip_offering_preview_sections:v1:"

/** Who can see documents in this section (documents table + preview context). */
export type SectionSharedWithScope = OfferingPreviewDocSharedWithScope

export function sectionSharedWithDisplay(scope: SectionSharedWithScope): string {
  return scope === "lp_investor" ? "LP Investor" : "Offering page"
}

function parseSharedWithScope(
  rawScope: unknown,
  legacyVisibility: string,
): SectionSharedWithScope {
  if (rawScope === "lp_investor") return "lp_investor"
  if (rawScope === "offering_page") return "offering_page"
  const vis = legacyVisibility.trim().toLowerCase()
  if (vis.includes("lp") && vis.includes("investor")) return "lp_investor"
  return "offering_page"
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

function sectionsStorageKey(dealId: string): string {
  return `${SECTIONS_STORAGE_PREFIX}${dealId.trim()}`
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v)
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
  return { id, name, url, dateAdded, lpDisplaySectionId }
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
  return list.map((s) => {
    const sharedWithScope: OfferingPreviewDocSharedWithScope =
      s.sharedWithScope === "lp_investor" ? "lp_investor" : "offering_page"
    return {
      ...s,
      sharedWithScope,
      visibility: sectionSharedWithDisplay(sharedWithScope),
      nestedDocuments: s.nestedDocuments.map((d) => ({
        ...d,
        lpDisplaySectionId: ids.has(d.lpDisplaySectionId) ? d.lpDisplaySectionId : s.id,
      })),
    }
  })
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

function migrateFlatToSections(flat: OfferingPreviewDocument[]): OfferingPreviewSection[] {
  if (flat.length === 0) return []
  const sectionId = `migrated-${Date.now()}`
  const nestedDocuments: NestedPreviewDocument[] = flat.map((d) => ({
    id: d.id,
    name: d.name,
    url: d.url,
    dateAdded: d.dateAdded?.trim() || "—",
    lpDisplaySectionId: sectionId,
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
        sharedWithScope: s.sharedWithScope,
        ...(d.dateAdded && d.dateAdded !== "—" ? { dateAdded: d.dateAdded } : {}),
      })
    }
  }
  return out
}

export function readOfferingPreviewSections(dealId: string): OfferingPreviewSection[] {
  const id = dealId.trim()
  if (!id || typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(sectionsStorageKey(id))
    if (raw != null) {
      const parsed = JSON.parse(raw) as unknown
      return sanitizeSections(normalizeSectionsArray(parsed))
    }
  } catch {
    /* ignore */
  }
  const flat = readOfferingPreviewDocuments(id)
  if (flat.length === 0) return []
  const migrated = migrateFlatToSections(flat)
  const sanitized = sanitizeSections(migrated)
  try {
    window.localStorage.setItem(sectionsStorageKey(id), JSON.stringify(sanitized))
  } catch {
    /* quota */
  }
  return sanitized
}

export function writeOfferingPreviewSections(
  dealId: string,
  sections: OfferingPreviewSection[],
): void {
  const id = dealId.trim()
  if (!id || typeof window === "undefined") return
  const sanitized = sanitizeSections(sections)
  try {
    window.localStorage.setItem(sectionsStorageKey(id), JSON.stringify(sanitized))
  } catch {
    /* quota */
  }
  writeOfferingPreviewDocuments(id, flattenSectionsToPreviewDocs(sanitized))
}

/** Parse `sections` JSON from the server (same shape as localStorage). */
export function parseOfferingPreviewSectionsJson(
  raw: unknown,
): OfferingPreviewSection[] {
  return sanitizeSections(normalizeSectionsArray(raw))
}
