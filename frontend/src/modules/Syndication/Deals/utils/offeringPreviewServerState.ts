import { patchDealOfferingInvestorPreview, type DealDetailApi } from "../api/dealsApi"
import {
  parseOfferingPreviewSectionsJson,
  parseLegacyFlatDocumentsFromLocalStorage,
  readOfferingPreviewSections,
  writeOfferingPreviewSections,
  migrateFlatDocumentsToSections,
} from "./offeringPreviewDocSections"
import {
  OFFERING_DETAILS_SECTION_ORDER,
  readOfferingPreviewInvestorVisibility,
  writeOfferingPreviewInvestorVisibility,
  type OfferingDetailsSectionId,
} from "./offeringPreviewInvestorVisibility"
import {
  clearLegacyOfferingPreviewLocalStorage,
  readLegacyOfferingPreviewSectionsFromLocalStorage,
  readLegacyOfferingPreviewVisibilityFromLocalStorage,
} from "./offeringPreviewLegacyLocalStorage"
import {
  isOfferingPreviewHydrated,
  markOfferingPreviewHydrated,
} from "./offeringPreviewRuntimeStore"

const syncTimers = new Map<string, ReturnType<typeof setTimeout>>()
const pendingOnSuccess = new Map<
  string,
  ((deal: DealDetailApi) => void) | undefined
>()
const migrationStarted = new Set<string>()

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v)
}

function serverJsonHasSections(json: string | null | undefined): boolean {
  if (!json?.trim()) return false
  try {
    const parsed = JSON.parse(json) as unknown
    if (!isRecord(parsed)) return false
    return Array.isArray(parsed.sections) && parsed.sections.length > 0
  } catch {
    return false
  }
}

function scheduleLegacyLocalStorageMigration(
  dealId: string,
  hadServerSections: boolean,
): void {
  const id = dealId.trim()
  if (!id || hadServerSections || migrationStarted.has(id)) return
  migrationStarted.add(id)
  void (async () => {
    try {
      const legacySectionsRaw = readLegacyOfferingPreviewSectionsFromLocalStorage(id)
      let sections = parseOfferingPreviewSectionsJson(legacySectionsRaw)
      if (sections.length === 0) {
        const flat = parseLegacyFlatDocumentsFromLocalStorage(id)
        if (flat.length > 0) sections = migrateFlatDocumentsToSections(flat)
      }
      const legacyVis = readLegacyOfferingPreviewVisibilityFromLocalStorage(id)
      const visibility = legacyVis
        ? ({
            ...readOfferingPreviewInvestorVisibility(id),
            ...(legacyVis as Partial<Record<OfferingDetailsSectionId, boolean>>),
          } as Record<OfferingDetailsSectionId, boolean>)
        : readOfferingPreviewInvestorVisibility(id)
      if (sections.length === 0 && !legacyVis) return
      writeOfferingPreviewSections(id, sections, { notify: false })
      writeOfferingPreviewInvestorVisibility(id, visibility, { notify: false })
      markOfferingPreviewHydrated(id)
      const deal = await patchDealOfferingInvestorPreview(id, {
        visibility,
        sections: sections as unknown[],
      })
      applyOfferingInvestorPreviewJsonFromServer(id, deal.offeringInvestorPreviewJson, {
        notify: false,
      })
      clearLegacyOfferingPreviewLocalStorage(id)
    } catch {
      /* best-effort */
    } finally {
      migrationStarted.delete(id)
    }
  })()
}

/**
 * Hydrates in-memory preview state from `offering_investor_preview_json` on the deal row.
 * Call after loading a deal (including public offering preview).
 */
export function applyOfferingInvestorPreviewJsonFromServer(
  dealId: string,
  json: string | null | undefined,
  opts?: { notify?: boolean },
): void {
  const id = dealId.trim()
  if (!id) return

  const hadServerSections = serverJsonHasSections(json)

  if (json == null || !String(json).trim()) {
    markOfferingPreviewHydrated(id)
    scheduleLegacyLocalStorageMigration(id, false)
    return
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(String(json)) as unknown
  } catch {
    markOfferingPreviewHydrated(id)
    return
  }
  if (!isRecord(parsed)) {
    markOfferingPreviewHydrated(id)
    return
  }

  const sections = parseOfferingPreviewSectionsJson(parsed.sections)
  writeOfferingPreviewSections(id, sections, opts)

  const visRaw = parsed.visibility
  if (isRecord(visRaw)) {
    const base = readOfferingPreviewInvestorVisibility(id)
    const next = { ...base } as Record<OfferingDetailsSectionId, boolean>
    for (const { id: sid } of OFFERING_DETAILS_SECTION_ORDER) {
      const v = visRaw[sid]
      if (typeof v === "boolean") next[sid] = v
    }
    writeOfferingPreviewInvestorVisibility(id, next, opts)
  }

  markOfferingPreviewHydrated(id)

  if (!hadServerSections && sections.length === 0) {
    scheduleLegacyLocalStorageMigration(id, false)
  }
}

export function cancelOfferingInvestorPreviewServerSync(dealId: string): void {
  const id = dealId.trim()
  if (!id || typeof window === "undefined") return
  const prev = syncTimers.get(id)
  if (prev) window.clearTimeout(prev)
  syncTimers.delete(id)
  pendingOnSuccess.delete(id)
}

export async function persistOfferingInvestorPreviewToServer(
  dealId: string,
): Promise<DealDetailApi | null> {
  const id = dealId.trim()
  if (!id || typeof window === "undefined") return null
  if (!isOfferingPreviewHydrated(id)) return null
  const sections = readOfferingPreviewSections(id)
  const visibility = readOfferingPreviewInvestorVisibility(id)
  try {
    const deal = await patchDealOfferingInvestorPreview(id, {
      visibility,
      sections: sections as unknown[],
    })
    applyOfferingInvestorPreviewJsonFromServer(id, deal.offeringInvestorPreviewJson, {
      notify: false,
    })
    return deal
  } catch {
    return null
  }
}

/**
 * Debounced autosave of documents + investor-visibility toggles to the database.
 */
export function scheduleOfferingInvestorPreviewServerSync(
  dealId: string,
  opts?: { onSuccess?: (deal: DealDetailApi) => void; delayMs?: number },
): void {
  const id = dealId.trim()
  if (!id || typeof window === "undefined") return
  if (!isOfferingPreviewHydrated(id)) return
  const prev = syncTimers.get(id)
  if (prev) window.clearTimeout(prev)
  pendingOnSuccess.set(id, opts?.onSuccess)
  const delay = opts?.delayMs ?? 900
  syncTimers.set(
    id,
    window.setTimeout(() => {
      syncTimers.delete(id)
      const onSuccess = pendingOnSuccess.get(id)
      pendingOnSuccess.delete(id)
      void (async () => {
        const deal = await persistOfferingInvestorPreviewToServer(id)
        if (deal && onSuccess) onSuccess(deal)
      })()
    }, delay),
  )
}
