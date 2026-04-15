import { patchDealOfferingInvestorPreview, type DealDetailApi } from "../api/dealsApi"
import {
  parseOfferingPreviewSectionsJson,
  readOfferingPreviewSections,
  writeOfferingPreviewSections,
} from "./offeringPreviewDocSections"
import {
  OFFERING_DETAILS_SECTION_ORDER,
  readOfferingPreviewInvestorVisibility,
  writeOfferingPreviewInvestorVisibility,
  type OfferingDetailsSectionId,
} from "./offeringPreviewInvestorVisibility"

const syncTimers = new Map<string, ReturnType<typeof setTimeout>>()
const pendingOnSuccess = new Map<
  string,
  ((deal: DealDetailApi) => void) | undefined
>()

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v)
}

/**
 * Writes server-stored preview state into localStorage so existing preview readers stay unchanged.
 * Call after loading a deal (including public offering preview).
 */
export function applyOfferingInvestorPreviewJsonFromServer(
  dealId: string,
  json: string | null | undefined,
): void {
  const id = dealId.trim()
  if (!id || typeof window === "undefined") return
  if (json == null || !String(json).trim()) return
  let parsed: unknown
  try {
    parsed = JSON.parse(String(json)) as unknown
  } catch {
    return
  }
  if (!isRecord(parsed)) return
  const secsRaw = parsed.sections
  const sections = parseOfferingPreviewSectionsJson(secsRaw)
  writeOfferingPreviewSections(id, sections)
  const visRaw = parsed.visibility
  if (isRecord(visRaw)) {
    const base = readOfferingPreviewInvestorVisibility(id)
    const next = { ...base } as Record<OfferingDetailsSectionId, boolean>
    for (const { id: sid } of OFFERING_DETAILS_SECTION_ORDER) {
      const v = visRaw[sid]
      if (typeof v === "boolean") next[sid] = v
    }
    writeOfferingPreviewInvestorVisibility(id, next)
  }
}

export async function persistOfferingInvestorPreviewToServer(
  dealId: string,
): Promise<DealDetailApi | null> {
  const id = dealId.trim()
  if (!id || typeof window === "undefined") return null
  const sections = readOfferingPreviewSections(id)
  const visibility = readOfferingPreviewInvestorVisibility(id)
  try {
    return await patchDealOfferingInvestorPreview(id, {
      visibility,
      sections: sections as unknown[],
    })
  } catch {
    return null
  }
}

/**
 * Debounced autosave of documents + investor-visibility toggles for the shared preview link.
 */
export function scheduleOfferingInvestorPreviewServerSync(
  dealId: string,
  opts?: { onSuccess?: (deal: DealDetailApi) => void; delayMs?: number },
): void {
  const id = dealId.trim()
  if (!id || typeof window === "undefined") return
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
