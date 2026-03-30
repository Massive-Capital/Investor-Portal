import { SESSION_BEARER_KEY } from "../../../../../common/auth/sessionKeys"
import { getApiV1Base } from "../../../../../common/utils/apiBaseUrl"
import type {
  AssetStepDraft,
  DealListRow,
  DealStepDraft,
} from "../types/deals.types"

export interface DealDetailApi {
  id: string
  dealName: string
  dealType: string
  dealStage: string
  secType: string
  closeDate: string | null
  owningEntityName: string
  fundsRequiredBeforeGpSign: boolean
  autoSendFundingInstructions: boolean
  propertyName: string
  country: string
  city: string
  assetImagePath: string | null
  createdAt: string
  listRow: DealListRow
}

function authHeaders(): HeadersInit {
  const token =
    typeof sessionStorage !== "undefined"
      ? sessionStorage.getItem(SESSION_BEARER_KEY)
      : null
  const h: HeadersInit = {}
  if (token) h.Authorization = `Bearer ${token}`
  return h
}

function str(v: unknown, fallback = ""): string {
  if (v == null) return fallback
  if (typeof v === "string") return v
  return String(v)
}

function firstDefined(
  raw: Record<string, unknown>,
  keys: string[],
): unknown {
  for (const k of keys) {
    if (k in raw && raw[k] != null && raw[k] !== "") return raw[k]
  }
  return undefined
}

/** Ensures every list field exists so table cells / sort accessors never throw. */
function normalizeDealListRow(
  raw: Partial<DealListRow> & Record<string, unknown>,
  index: number,
): DealListRow {
  const r = raw as Record<string, unknown>
  const idVal = firstDefined(r, ["id", "deal_id"])
  const loc = firstDefined(r, ["locationDisplay", "location_display"])
  const createdAtVal = firstDefined(r, ["createdAt", "created_at"])
  const assetImg =
    firstDefined(r, ["assetImagePath", "asset_image_path"]) ?? r.assetImagePath
  const assetImagePath =
    assetImg != null && String(assetImg).trim() !== ""
      ? String(assetImg)
      : null
  return {
    id: str(idVal ?? raw.id, `row-${index}`),
    dealName: str(firstDefined(r, ["dealName", "deal_name"]) ?? raw.dealName),
    dealType: str(firstDefined(r, ["dealType", "deal_type"]) ?? raw.dealType),
    dealStage: str(
      firstDefined(r, ["dealStage", "deal_stage"]) ?? raw.dealStage,
    ),
    totalInProgress: str(
      firstDefined(r, ["totalInProgress", "total_in_progress"]) ??
        raw.totalInProgress,
      "—",
    ),
    totalAccepted: str(
      firstDefined(r, ["totalAccepted", "total_accepted"]) ??
        raw.totalAccepted,
      "—",
    ),
    raiseTarget: str(
      firstDefined(r, ["raiseTarget", "raise_target"]) ?? raw.raiseTarget,
      "—",
    ),
    distributions: str(
      firstDefined(r, ["distributions"]) ?? raw.distributions,
      "—",
    ),
    investors: str(firstDefined(r, ["investors"]) ?? raw.investors, "—"),
    closeDateDisplay: str(
      firstDefined(r, ["closeDateDisplay", "close_date_display"]) ??
        raw.closeDateDisplay,
      "—",
    ),
    createdDateDisplay: str(
      firstDefined(r, ["createdDateDisplay", "created_date_display"]) ??
        raw.createdDateDisplay,
      "—",
    ),
    locationDisplay:
      loc != null ? str(loc) : raw.locationDisplay != null
        ? str(raw.locationDisplay)
        : undefined,
    createdAt:
      createdAtVal != null
        ? str(createdAtVal)
        : raw.createdAt != null
          ? str(raw.createdAt)
          : undefined,
    assetImagePath,
  }
}

/** Returns normalized rows, or [] if the API is unreachable, unauthorized, or has no deals. */
export async function fetchDealsList(): Promise<DealListRow[]> {
  const base = getApiV1Base()
  if (!base) return []
  try {
    const res = await fetch(`${base}/deals`, {
      headers: { ...authHeaders() },
      credentials: "include",
    })
    const data = (await res.json().catch(() => ({}))) as {
      deals?: unknown[]
    }
    if (!res.ok) return []
    if (!Array.isArray(data.deals)) return []
    return data.deals.map((item, i) =>
      normalizeDealListRow(
        (item != null && typeof item === "object"
          ? item
          : {}) as Partial<DealListRow> & Record<string, unknown>,
        i,
      ),
    )
  } catch {
    return []
  }
}

export async function fetchDealById(dealId: string): Promise<DealDetailApi> {
  const base = getApiV1Base()
  if (!base) throw new Error("VITE_BASE_URL is not configured.")
  const res = await fetch(`${base}/deals/${encodeURIComponent(dealId)}`, {
    headers: { ...authHeaders() },
    credentials: "include",
  })
  const data = (await res.json().catch(() => ({}))) as {
    deal?: DealDetailApi
    message?: string
  }
  if (!res.ok)
    throw new Error(data.message || `Could not load deal (${res.status})`)
  if (!data.deal) throw new Error("Invalid response")
  return data.deal
}

export function buildCreateDealFormData(
  deal: DealStepDraft,
  asset: AssetStepDraft,
  imageFiles: File[],
): FormData {
  const fd = new FormData()
  fd.append("deal_name", deal.dealName.trim())
  fd.append("deal_type", deal.dealType)
  fd.append("deal_stage", deal.dealStage)
  fd.append("sec_type", deal.secType.trim())
  if (deal.closeDate) fd.append("close_date", deal.closeDate)
  fd.append("owning_entity_name", deal.owningEntityName.trim())
  fd.append(
    "funds_required_before_gp_sign",
    deal.fundsBeforeGpCountersigns === "yes" ? "true" : "false",
  )
  fd.append(
    "auto_send_funding_instructions",
    deal.autoFundingAfterGpCountersigns === "yes" ? "true" : "false",
  )
  fd.append("property_name", asset.propertyName.trim())
  fd.append("country", asset.country)
  fd.append("city", asset.city.trim())
  for (const file of imageFiles) fd.append("assetImages", file)
  return fd
}

export async function createDealMultipart(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; message: string; fieldErrors?: Record<string, string> }> {
  const base = getApiV1Base()
  if (!base)
    return { ok: false, message: "VITE_BASE_URL is not configured." }
  const res = await fetch(`${base}/deals`, {
    method: "POST",
    headers: { ...authHeaders() },
    body: formData,
    credentials: "include",
  })
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    errors?: Record<string, string>
  }
  if (res.status === 201) return { ok: true }
  if (res.status === 400 && data.errors)
    return { ok: false, message: data.message || "Validation failed", fieldErrors: data.errors }
  return {
    ok: false,
    message: data.message || `Could not create deal (${res.status})`,
  }
}
