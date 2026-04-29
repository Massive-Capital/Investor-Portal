import { SESSION_BEARER_KEY } from "../../../../../common/auth/sessionKeys"
import { getApiV1Base } from "../../../../../common/utils/apiBaseUrl"
import { formatDateDdMmmYyyy } from "../../../../../common/utils/formatDateDisplay"
import type { AddInvestmentFormValues } from "../deal-members/add-investment/add_deal_member_types"
import type {
  DealInvestorRow,
  DealInvestorsKpis,
  DealInvestorsPayload,
} from "../types/deal-investors.types"
import type {
  DealInvestorClass,
  DealInvestorClassFormValues,
} from "../types/deal-investor-class.types"
import {
  DEFAULT_ASSET_COUNTRY,
  type AssetStepDraft,
  type DealListRow,
  type DealStepDraft,
} from "../types/deals.types"
import {
  formatCommittedFromRawParts,
  formatCommittedZeroUsd,
  formatCurrencyTableDisplay,
} from "../utils/offeringMoneyFormat"
import {
  DEFAULT_OFFERING_VISIBILITY,
  mapLegacyOfferingVisibility,
  OFFERING_VISIBILITY_OPTIONS,
} from "../utils/offeringOverviewForm"

export { DEAL_INVESTMENT_AUTOSAVE_CONTACT_PLACEHOLDER } from "../constants/investor-profile"

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
  /** Street line 1 (matches `address_line_1` from API). */
  addressLine1?: string
  addressLine2?: string
  city: string
  state?: string
  zipCode?: string
  assetImagePath: string | null
  createdAt: string
  /** When API sends a dedicated deal offering size (snake_case normalized here). */
  offeringSize?: string | null
  /** Sanitized HTML for “Summary for all investors” (Offering details). */
  investorSummaryHtml?: string
  /** Cover image URL chosen from gallery (dashboard + preview hero). */
  galleryCoverImageUrl?: string
  /** JSON string: Key Highlights rows `{ id, metric, newClass, isPreset }[]`. */
  keyHighlightsJson?: string
  /** Plain text; shown at top of deal detail for everyone with access. */
  dealAnnouncementTitle?: string
  dealAnnouncementMessage?: string
  /** Offering workflow status (Overview). */
  offeringStatus?: string
  offeringVisibility?: string
  showOnInvestbase?: boolean
  internalName?: string
  /** Asset row ids selected for offering overview (persisted). */
  offeringOverviewAssetIds?: string[]
  /** Upload-relative paths for offering gallery (persisted for public preview). */
  offeringGalleryPaths?: string[]
  /** Encrypted `preview` query value; persisted on `add_deal_form` for share links. */
  offeringPreviewToken?: string | null
  /**
   * JSON string `{ v, visibility, sections }` for offering preview (documents + investor toggles).
   * Synced to the server for the shared preview link.
   */
  offeringInvestorPreviewJson?: string | null
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

/**
 * Same member directory as User Management — for Add Investment Member dropdown.
 */
export async function fetchUsersForMemberSelect(): Promise<
  Record<string, unknown>[]
> {
  const base = getApiV1Base()
  if (!base) return []
  try {
    const res = await fetch(`${base}/users`, {
      headers: { ...authHeaders() },
      credentials: "include",
    })
    const data = (await res.json().catch(() => ({}))) as { users?: unknown }
    if (!res.ok) return []
    const list = data.users
    if (!Array.isArray(list)) return []
    return list.filter(
      (x): x is Record<string, unknown> =>
        x !== null && typeof x === "object" && !Array.isArray(x),
    )
  } catch {
    return []
  }
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

/** Key highlights JSON from API (camelCase or snake_case). Empty string is valid; do not use firstDefined (it skips ""). */
function pickKeyHighlightsJsonFromDealPayload(
  raw: Record<string, unknown>,
): string {
  if ("keyHighlightsJson" in raw && raw.keyHighlightsJson != null) {
    return String(raw.keyHighlightsJson)
  }
  if ("key_highlights_json" in raw && raw.key_highlights_json != null) {
    return String(raw.key_highlights_json)
  }
  return ""
}

function pickDealAnnouncementField(
  raw: Record<string, unknown>,
  camel: string,
  snake: string,
): string {
  if (camel in raw && raw[camel] != null) return String(raw[camel])
  if (snake in raw && raw[snake] != null) return String(raw[snake])
  return ""
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

  const totalInProgressVal = str(
    firstDefined(r, ["totalInProgress", "total_in_progress"]) ??
      raw.totalInProgress,
    "—",
  )
  const createdDateDisplay = str(
    firstDefined(r, ["createdDateDisplay", "created_date_display"]) ??
      raw.createdDateDisplay,
    "—",
  )
  const startRaw = firstDefined(r, [
    "startDateDisplay",
    "start_date_display",
    "startDate",
    "start_date",
  ])
  const startDateDisplay =
    startRaw != null && String(startRaw).trim() !== ""
      ? str(startRaw)
      : createdDateDisplay

  const invRaw = firstDefined(r, [
    "investmentsDisplay",
    "investments_display",
    "investments",
  ])
  const investmentsDisplay =
    invRaw != null && String(invRaw).trim() !== ""
      ? str(invRaw)
      : totalInProgressVal

  const archivedVal = (() => {
    const a = firstDefined(r, ["archived", "is_archived", "isArchived"])
    if (a === true || a === "true" || a === 1 || a === "1") return true
    if (a === false || a === "false" || a === 0 || a === "0") return false
    return Boolean(raw.archived)
  })()

  const galleryCoverRaw = firstDefined(r, [
    "galleryCoverImageUrl",
    "gallery_cover_image_url",
  ])
  const galleryCoverImageUrl =
    galleryCoverRaw != null && String(galleryCoverRaw).trim() !== ""
      ? str(galleryCoverRaw)
      : undefined

  return {
    id: str(idVal ?? raw.id, `row-${index}`),
    dealName: str(firstDefined(r, ["dealName", "deal_name"]) ?? raw.dealName),
    dealType: str(firstDefined(r, ["dealType", "deal_type"]) ?? raw.dealType),
    dealStage: str(
      firstDefined(r, ["dealStage", "deal_stage"]) ?? raw.dealStage,
    ),
    totalInProgress: totalInProgressVal,
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
    investors: str(
      firstDefined(r, ["investors", "investor_count", "investorCount"]) ??
        raw.investors,
      "—",
    ),
    closeDateDisplay: str(
      firstDefined(r, ["closeDateDisplay", "close_date_display"]) ??
        raw.closeDateDisplay,
      "—",
    ),
    createdDateDisplay,
    startDateDisplay,
    investmentsDisplay,
    investorClass: str(
      firstDefined(r, ["investorClass", "investor_class", "investor_class_label"]) ??
        raw.investorClass,
      "—",
    ),
    archived: archivedVal,
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
    secType: str(firstDefined(r, ["secType", "sec_type"]) ?? raw.secType),
    owningEntityName: str(
      firstDefined(r, ["owningEntityName", "owning_entity_name"]) ??
        raw.owningEntityName,
    ),
    propertyName: str(
      firstDefined(r, ["propertyName", "property_name"]) ?? raw.propertyName,
    ),
    city: str(firstDefined(r, ["city"]) ?? raw.city),
    investmentType: str(
      firstDefined(r, ["investmentType", "investment_type"]) ??
        raw.investmentType,
      "—",
    ),
    propertyType: str(
      firstDefined(r, ["propertyType", "property_type"]) ?? raw.propertyType,
      "—",
    ),
    ...(galleryCoverImageUrl !== undefined
      ? { galleryCoverImageUrl }
      : {}),
  }
}

/** Returns normalized rows, or [] if the API is unreachable, unauthorized, or has no deals. */
export async function fetchDealsList(options?: {
  /** Syndication org deals plus deals where the user is on the roster (`assigning_deal_user`). */
  includeParticipantDeals?: boolean
}): Promise<DealListRow[]> {
  const base = getApiV1Base()
  if (!base) return []
  const q =
    options?.includeParticipantDeals === true
      ? "?includeParticipantDeals=1"
      : ""
  try {
    const res = await fetch(`${base}/deals${q}`, {
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

/** Platform admin: deals for a single customer organization (`organization_id` on add_deal_form). */
export async function fetchDealsListForOrganization(
  organizationId: string,
): Promise<{ deals: DealListRow[]; error?: string }> {
  const id = organizationId.trim()
  const base = getApiV1Base()
  if (!base || !id) return { deals: [] }
  try {
    const res = await fetch(
      `${base}/deals?organizationId=${encodeURIComponent(id)}`,
      {
        headers: { ...authHeaders() },
        credentials: "include",
      },
    )
    const data = (await res.json().catch(() => ({}))) as {
      deals?: unknown[]
      message?: string
    }
    if (!res.ok) {
      return {
        deals: [],
        error: data.message || `Could not load deals (${res.status})`,
      }
    }
    if (!Array.isArray(data.deals)) return { deals: [] }
    return {
      deals: data.deals.map((item, i) =>
        normalizeDealListRow(
          (item != null && typeof item === "object"
            ? item
            : {}) as Partial<DealListRow> & Record<string, unknown>,
          i,
        ),
      ),
    }
  } catch {
    return { deals: [], error: "Unable to connect." }
  }
}

/** Normalizes GET/PATCH deal payloads (snake_case, optional fields). */
export function normalizeDealDetailApi(
  d: DealDetailApi & Record<string, unknown>,
): DealDetailApi {
  const offeringSizeRaw = firstDefined(d, [
    "offeringSize",
    "offering_size",
  ])
  const offeringSize =
    offeringSizeRaw != null && String(offeringSizeRaw).trim() !== ""
      ? str(offeringSizeRaw)
      : undefined
  const summaryRaw = firstDefined(d, [
    "investorSummaryHtml",
    "investor_summary_html",
  ])
  const investorSummaryHtml =
    summaryRaw != null ? str(summaryRaw) : ""
  const coverRaw = firstDefined(d, [
    "galleryCoverImageUrl",
    "gallery_cover_image_url",
  ])
  const galleryCoverImageUrl =
    coverRaw != null ? str(coverRaw) : ""
  const keyHighlightsJson = pickKeyHighlightsJsonFromDealPayload(d)
  const dealAnnouncementTitle = pickDealAnnouncementField(
    d,
    "dealAnnouncementTitle",
    "deal_announcement_title",
  )
  const dealAnnouncementMessage = pickDealAnnouncementField(
    d,
    "dealAnnouncementMessage",
    "deal_announcement_message",
  )
  const offeringStatusRaw = firstDefined(d, [
    "offeringStatus",
    "offering_status",
  ])
  const offeringVisibilityRaw = firstDefined(d, [
    "offeringVisibility",
    "offering_visibility",
  ])
  const showOnInvestbaseRaw = firstDefined(d, [
    "showOnInvestbase",
    "show_on_investbase",
  ])
  const internalNameRaw = firstDefined(d, ["internalName", "internal_name"])
  const offeringStatus =
    offeringStatusRaw != null ? str(offeringStatusRaw) : "draft_hidden"
  const visStr =
    offeringVisibilityRaw != null ? str(offeringVisibilityRaw) : ""
  const visMapped = visStr ? mapLegacyOfferingVisibility(visStr) : ""
  const offeringVisibility = OFFERING_VISIBILITY_OPTIONS.some(
    (o) => o.value === visMapped,
  )
    ? visMapped
    : DEFAULT_OFFERING_VISIBILITY
  const showOnInvestbase =
    showOnInvestbaseRaw === true ||
    showOnInvestbaseRaw === "true" ||
    showOnInvestbaseRaw === 1 ||
    showOnInvestbaseRaw === "1"
  const internalName =
    internalNameRaw != null ? str(internalNameRaw) : ""
  const offeringPreviewTokenRaw = firstDefined(d, [
    "offeringPreviewToken",
    "offering_preview_token",
  ])
  const offeringPreviewToken =
    offeringPreviewTokenRaw != null && String(offeringPreviewTokenRaw).trim() !== ""
      ? str(offeringPreviewTokenRaw)
      : null
  const offeringInvestorPreviewJsonRaw = firstDefined(d, [
    "offeringInvestorPreviewJson",
    "offering_investor_preview_json",
  ])
  const offeringInvestorPreviewJson =
    offeringInvestorPreviewJsonRaw != null &&
    String(offeringInvestorPreviewJsonRaw).trim() !== ""
      ? str(offeringInvestorPreviewJsonRaw)
      : null
  const assetIdsRaw = firstDefined(d, [
    "offeringOverviewAssetIds",
    "offering_overview_asset_ids",
  ])
  let offeringOverviewAssetIds: string[] = []
  if (Array.isArray(assetIdsRaw)) {
    offeringOverviewAssetIds = assetIdsRaw.filter(
      (x): x is string => typeof x === "string",
    )
  } else if (typeof assetIdsRaw === "string" && assetIdsRaw.trim()) {
    try {
      const p = JSON.parse(assetIdsRaw) as unknown
      if (Array.isArray(p)) {
        offeringOverviewAssetIds = p.filter(
          (x): x is string => typeof x === "string",
        )
      }
    } catch {
      offeringOverviewAssetIds = []
    }
  }

  const galleryPathsRaw = firstDefined(d, [
    "offeringGalleryPaths",
    "offering_gallery_paths",
  ])
  let offeringGalleryPaths: string[] = []
  if (Array.isArray(galleryPathsRaw)) {
    offeringGalleryPaths = galleryPathsRaw.filter(
      (x): x is string => typeof x === "string",
    )
  } else if (typeof galleryPathsRaw === "string" && galleryPathsRaw.trim()) {
    try {
      const p = JSON.parse(galleryPathsRaw) as unknown
      if (Array.isArray(p)) {
        offeringGalleryPaths = p.filter(
          (x): x is string => typeof x === "string",
        )
      }
    } catch {
      offeringGalleryPaths = []
    }
  }

  const dealNameRaw = firstDefined(d, ["dealName", "deal_name"])
  const dealName =
    dealNameRaw !== undefined ? str(dealNameRaw) : str(d.dealName ?? "")
  const dealTypeRaw = firstDefined(d, ["dealType", "deal_type"])
  const dealType =
    dealTypeRaw !== undefined ? str(dealTypeRaw) : str(d.dealType ?? "")
  const dealStageRaw = firstDefined(d, ["dealStage", "deal_stage"])
  const dealStage =
    dealStageRaw !== undefined ? str(dealStageRaw) : str(d.dealStage ?? "")

  const assetImgRaw = firstDefined(d, ["assetImagePath", "asset_image_path"])
  const assetImagePath =
    assetImgRaw != null && String(assetImgRaw).trim() !== ""
      ? str(assetImgRaw)
      : null

  const addressLine1 = str(
    firstDefined(d, ["addressLine1", "address_line_1"]) ?? d.addressLine1 ?? "",
  )
  const addressLine2 = str(
    firstDefined(d, ["addressLine2", "address_line_2"]) ?? d.addressLine2 ?? "",
  )
  const stateNorm = str(firstDefined(d, ["state"]) ?? d.state ?? "")
  const zipCodeNorm = str(
    firstDefined(d, ["zipCode", "zip_code"]) ?? d.zipCode ?? "",
  )

  const lr = d.listRow
  const listRow =
    lr && typeof lr === "object"
      ? ({
          ...lr,
          dealName: dealName || str(lr.dealName ?? ""),
          dealType: dealType || str(lr.dealType ?? ""),
          dealStage: dealStage || str(lr.dealStage ?? ""),
        } as DealListRow)
      : lr

  return {
    ...d,
    dealName,
    dealType,
    dealStage,
    ...(listRow !== undefined ? { listRow } : {}),
    investorSummaryHtml,
    galleryCoverImageUrl,
    keyHighlightsJson,
    dealAnnouncementTitle,
    dealAnnouncementMessage,
    offeringStatus,
    offeringVisibility,
    showOnInvestbase,
    internalName,
    offeringOverviewAssetIds,
    offeringGalleryPaths,
    assetImagePath,
    addressLine1,
    addressLine2,
    state: stateNorm,
    zipCode: zipCodeNorm,
    ...(offeringSize !== undefined ? { offeringSize } : {}),
    offeringPreviewToken,
    offeringInvestorPreviewJson,
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
  const d = data.deal as DealDetailApi & Record<string, unknown>
  return normalizeDealDetailApi(d)
}

/**
 * Authenticated: encrypted token for LP preview URLs (hides deal UUID).
 */
export async function fetchOfferingPreviewToken(dealId: string): Promise<string> {
  const base = getApiV1Base()
  if (!base) throw new Error("VITE_BASE_URL is not configured.")
  const res = await fetch(
    `${base}/deals/${encodeURIComponent(dealId)}/offering-preview-token`,
    {
      headers: { ...authHeaders() },
      credentials: "include",
    },
  )
  const data = (await res.json().catch(() => ({}))) as {
    token?: string
    previewToken?: string
    message?: string
  }
  if (!res.ok) {
    throw new Error(
      typeof data.message === "string"
        ? data.message
        : `Could not get preview token (${res.status})`,
    )
  }
  const t = data.token ?? data.previewToken
  if (typeof t !== "string" || !t.trim()) {
    throw new Error("Invalid preview token response.")
  }
  return t.trim()
}

export type OfferingPreviewShareEmailFailure = {
  email: string
  message: string
}

export type OfferingPreviewShareEmailResponse = {
  sent: number
  failures: OfferingPreviewShareEmailFailure[]
  previewUrl?: string
  message?: string
}

/** Email the public offering preview link to the given addresses (authenticated). */
export async function postOfferingPreviewShareByEmail(
  dealId: string,
  emails: string[],
): Promise<OfferingPreviewShareEmailResponse> {
  const base = getApiV1Base()
  if (!base) throw new Error("VITE_BASE_URL is not configured.")
  const res = await fetch(
    `${base}/deals/${encodeURIComponent(dealId)}/offering-preview-share-email`,
    {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ emails }),
    },
  )
  const data = (await res.json().catch(() => ({}))) as OfferingPreviewShareEmailResponse & {
    message?: string
  }
  if (!res.ok) {
    throw new Error(
      typeof data.message === "string"
        ? data.message
        : `Could not send emails (${res.status})`,
    )
  }
  return {
    sent: Number(data.sent) || 0,
    failures: Array.isArray(data.failures) ? data.failures : [],
    previewUrl:
      typeof data.previewUrl === "string" ? data.previewUrl : undefined,
    message: typeof data.message === "string" ? data.message : undefined,
  }
}

function publicOfferingPortfolioPagePrefix(): string {
  const rawBase = import.meta.env.BASE_URL ?? "/"
  const baseSeg =
    rawBase === "/" || rawBase === "./"
      ? ""
      : rawBase.replace(/^\/+/, "").replace(/\/+$/, "")
  return baseSeg ? `/${baseSeg}` : ""
}

/** LP share link (no login): `/offering_portfolio?preview=<encrypted token>`. */
export function buildPublicOfferingPreviewPageUrl(previewToken: string): string {
  const prefix = publicOfferingPortfolioPagePrefix()
  const origin =
    typeof window !== "undefined" ? window.location.origin : ""
  const params = new URLSearchParams()
  params.set("preview", previewToken)
  return `${origin}${prefix}/offering_portfolio?${params.toString()}`
}

/**
 * Fallback when the encrypted token API is unavailable: same page with plain deal UUID
 * (backend `resolvePublicPreviewDealId` accepts legacy `preview=<uuid>`).
 */
export function buildLegacyPublicOfferingPreviewPageUrl(dealId: string): string {
  const prefix = publicOfferingPortfolioPagePrefix()
  const origin =
    typeof window !== "undefined" ? window.location.origin : ""
  const params = new URLSearchParams()
  params.set("preview", dealId.trim())
  return `${origin}${prefix}/offering_portfolio?${params.toString()}`
}

const OFFERING_PREVIEW_DEAL_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isDealUuidForOfferingPreview(id: string): boolean {
  return Boolean(id?.trim() && OFFERING_PREVIEW_DEAL_UUID_RE.test(id.trim()))
}

/**
 * Authenticated: full public offering preview URL for clipboard (encrypted `preview` token).
 * Falls back to legacy `preview=<deal uuid>` when the token endpoint fails but `dealId` is a UUID
 * (same behavior as the Offering Preview page share control).
 */
export async function buildDealOfferingPreviewShareUrl(
  dealId: string,
  options?: { previewToken?: string | null },
): Promise<string> {
  const id = dealId.trim()
  if (!id) throw new Error("Missing deal id.")
  const cached = options?.previewToken?.trim()
  if (cached) return buildPublicOfferingPreviewPageUrl(cached)
  try {
    const token = await fetchOfferingPreviewToken(id)
    return buildPublicOfferingPreviewPageUrl(token)
  } catch {
    if (isDealUuidForOfferingPreview(id))
      return buildLegacyPublicOfferingPreviewPageUrl(id)
    throw new Error("Could not create offering preview link.")
  }
}

/**
 * Unauthenticated preview for LPs. `previewQueryValue` is the encrypted token (or legacy plain UUID).
 * Backend returns the same deal / classes / KPIs / investors payload shape as the authenticated investors endpoint.
 */
export async function fetchPublicOfferingPreview(
  previewQueryValue: string,
): Promise<{
  deal: DealDetailApi
  investorClasses: DealInvestorClass[]
  investorsPayload: DealInvestorsPayload
}> {
  const base = getApiV1Base()
  if (!base) throw new Error("VITE_BASE_URL is not configured.")
  const res = await fetch(
    `${base}/public/offering-preview?preview=${encodeURIComponent(previewQueryValue)}`,
  )
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    throw new Error(
      typeof data.message === "string"
        ? data.message
        : `Could not load preview (${res.status})`,
    )
  }
  const dealRaw = data.deal
  if (!dealRaw || typeof dealRaw !== "object") {
    throw new Error("Invalid response")
  }
  const deal = normalizeDealDetailApi(
    dealRaw as DealDetailApi & Record<string, unknown>,
  )
  const list = extractInvestorClassesPayload(data)
  const investorClasses: DealInvestorClass[] = Array.isArray(list)
    ? list
        .filter(
          (x): x is Record<string, unknown> =>
            x != null && typeof x === "object",
        )
        .map((x, i) => {
          try {
            return normalizeInvestorClass(x, i)
          } catch {
            return null
          }
        })
        .filter((x): x is DealInvestorClass => x != null)
    : []
  const investorsPayload = normalizeDealInvestorsResponse({
    kpis: data.kpis,
    investors: data.investors,
  })
  return { deal, investorClasses, investorsPayload }
}

export async function patchDealInvestorSummary(
  dealId: string,
  investorSummaryHtml: string,
): Promise<
  { ok: true; deal: DealDetailApi } | { ok: false; message: string }
> {
  const base = getApiV1Base()
  if (!base)
    return { ok: false, message: "VITE_BASE_URL is not configured." }
  const res = await fetch(
    `${base}/deals/${encodeURIComponent(dealId)}/investor-summary`,
    {
      method: "PATCH",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ investor_summary_html: investorSummaryHtml }),
    },
  )
  const data = (await res.json().catch(() => ({}))) as {
    deal?: DealDetailApi & Record<string, unknown>
    message?: string
  }
  if (res.status === 200 && data.deal) {
    return { ok: true, deal: normalizeDealDetailApi(data.deal) }
  }
  return {
    ok: false,
    message: data.message || `Could not save summary (${res.status})`,
  }
}

export async function patchDealOfferingInvestorPreview(
  dealId: string,
  body: { visibility: Record<string, boolean>; sections: unknown[] },
): Promise<DealDetailApi> {
  const base = getApiV1Base()
  if (!base) throw new Error("VITE_BASE_URL is not configured.")
  const res = await fetch(
    `${base}/deals/${encodeURIComponent(dealId)}/offering-investor-preview`,
    {
      method: "PATCH",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(body),
    },
  )
  const data = (await res.json().catch(() => ({}))) as {
    deal?: DealDetailApi & Record<string, unknown>
    message?: string
  }
  if (res.status === 200 && data.deal) {
    return normalizeDealDetailApi(data.deal)
  }
  throw new Error(
    data.message || `Could not save offering preview (${res.status})`,
  )
}

export async function patchDealKeyHighlights(
  dealId: string,
  keyHighlightsJson: string,
): Promise<
  { ok: true; deal: DealDetailApi } | { ok: false; message: string }
> {
  const base = getApiV1Base()
  if (!base)
    return { ok: false, message: "VITE_BASE_URL is not configured." }
  const res = await fetch(
    `${base}/deals/${encodeURIComponent(dealId)}/key-highlights`,
    {
      method: "PATCH",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ key_highlights_json: keyHighlightsJson }),
    },
  )
  const data = (await res.json().catch(() => ({}))) as {
    deal?: DealDetailApi & Record<string, unknown>
    message?: string
  }
  if (res.status === 200 && data.deal) {
    return { ok: true, deal: normalizeDealDetailApi(data.deal) }
  }
  return {
    ok: false,
    message: data.message || `Could not save key highlights (${res.status})`,
  }
}

export type OfferingOverviewPayload = {
  offeringStatus: string
  offeringVisibility: string
  dealName: string
  dealType: string
  offeringOverviewAssetIds: string[]
}

export async function patchDealOfferingOverview(
  dealId: string,
  payload: OfferingOverviewPayload,
): Promise<
  { ok: true; deal: DealDetailApi } | { ok: false; message: string }
> {
  const base = getApiV1Base()
  if (!base)
    return { ok: false, message: "VITE_BASE_URL is not configured." }
  try {
    const res = await fetch(
      `${base}/deals/${encodeURIComponent(dealId)}/offering-overview`,
      {
        method: "PATCH",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          offering_status: payload.offeringStatus,
          offering_visibility: payload.offeringVisibility,
          deal_name: payload.dealName,
          deal_type: payload.dealType,
          offering_overview_asset_ids: payload.offeringOverviewAssetIds,
        }),
      },
    )
    const data = (await res.json().catch(() => ({}))) as {
      deal?: DealDetailApi & Record<string, unknown>
      message?: string
    }
    if (res.status === 200 && data.deal) {
      return { ok: true, deal: normalizeDealDetailApi(data.deal) }
    }
    return {
      ok: false,
      message:
        data.message || `Could not save offering overview (${res.status})`,
    }
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof Error
          ? e.message
          : "Network error while saving offering overview.",
    }
  }
}

export async function patchDealAnnouncement(
  dealId: string,
  title: string,
  message: string,
): Promise<
  { ok: true; deal: DealDetailApi } | { ok: false; message: string }
> {
  const base = getApiV1Base()
  if (!base)
    return { ok: false, message: "VITE_BASE_URL is not configured." }
  const res = await fetch(
    `${base}/deals/${encodeURIComponent(dealId)}/deal-announcement`,
    {
      method: "PATCH",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        deal_announcement_title: title,
        deal_announcement_message: message,
      }),
    },
  )
  const data = (await res.json().catch(() => ({}))) as {
    deal?: DealDetailApi & Record<string, unknown>
    message?: string
  }
  if (res.status === 200 && data.deal) {
    return { ok: true, deal: normalizeDealDetailApi(data.deal) }
  }
  return {
    ok: false,
    message: data.message || `Could not save announcement (${res.status})`,
  }
}

export async function patchDealOfferingGallery(
  dealId: string,
  offeringGalleryPaths: string[],
): Promise<
  { ok: true; deal: DealDetailApi } | { ok: false; message: string }
> {
  const base = getApiV1Base()
  if (!base)
    return { ok: false, message: "VITE_BASE_URL is not configured." }
  const res = await fetch(
    `${base}/deals/${encodeURIComponent(dealId)}/offering-gallery`,
    {
      method: "PATCH",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        offering_gallery_paths: offeringGalleryPaths,
      }),
    },
  )
  const data = (await res.json().catch(() => ({}))) as {
    deal?: DealDetailApi & Record<string, unknown>
    message?: string
  }
  if (res.status === 200 && data.deal) {
    return { ok: true, deal: normalizeDealDetailApi(data.deal) }
  }
  return {
    ok: false,
    message: data.message || `Could not save gallery (${res.status})`,
  }
}

/** Upload new gallery files to the server (Add Asset / offering images) so public preview can load them. */
export async function postDealOfferingGalleryUploads(
  dealId: string,
  files: File[],
): Promise<
  | { ok: true; deal: DealDetailApi; newPaths: string[] }
  | { ok: false; message: string }
> {
  const base = getApiV1Base()
  if (!base)
    return { ok: false, message: "VITE_BASE_URL is not configured." }
  if (files.length === 0)
    return { ok: false, message: "No images to upload." }
  const fileKey = (f: File) => `${f.name}\0${f.size}\0${f.lastModified}`
  const seen = new Set<string>()
  const unique: File[] = []
  for (const f of files) {
    const k = fileKey(f)
    if (seen.has(k)) continue
    seen.add(k)
    unique.push(f)
  }
  const fd = new FormData()
  for (const f of unique) fd.append("galleryFiles", f)
  const res = await fetch(
    `${base}/deals/${encodeURIComponent(dealId)}/offering-gallery-uploads`,
    {
      method: "POST",
      headers: { ...authHeaders() },
      body: fd,
      credentials: "include",
    },
  )
  const data = (await res.json().catch(() => ({}))) as {
    deal?: DealDetailApi & Record<string, unknown>
    newPaths?: unknown
    message?: string
  }
  if (res.status === 200 && data.deal) {
    const np = data.newPaths
    const newPaths = Array.isArray(np)
      ? np.filter((x): x is string => typeof x === "string")
      : []
    return {
      ok: true,
      deal: normalizeDealDetailApi(data.deal),
      newPaths,
    }
  }
  return {
    ok: false,
    message:
      data.message || `Could not upload gallery images (${res.status})`,
  }
}

/** Offering document uploads (Documents tab) accept PDF files only. */
export function isDealOfferingDocumentPdfFile(file: File): boolean {
  const name = file.name.trim().toLowerCase()
  if (!name.endsWith(".pdf")) return false
  const mime = file.type.trim().toLowerCase()
  if (
    mime === "" ||
    mime === "application/pdf" ||
    mime === "application/x-pdf"
  ) {
    return true
  }
  /* Some browsers/OS combinations send a generic type for valid PDFs. */
  if (mime === "application/octet-stream") return true
  return false
}

/** Upload offering documents (Documents tab) so preview / investors get stable `/uploads/...` links. */
export async function postDealOfferingDocumentUploads(
  dealId: string,
  files: File[],
): Promise<
  | { ok: true; newPaths: string[] }
  | { ok: false; message: string }
> {
  const base = getApiV1Base()
  if (!base)
    return { ok: false, message: "VITE_BASE_URL is not configured." }
  if (files.length === 0)
    return { ok: false, message: "No documents to upload." }
  const nonPdf = files.filter((f) => !isDealOfferingDocumentPdfFile(f))
  if (nonPdf.length > 0) {
    return {
      ok: false,
      message:
        nonPdf.length === 1
          ? `"${nonPdf[0]!.name}" is not a PDF. Only PDF files can be uploaded.`
          : `Only PDF files can be uploaded. Remove: ${nonPdf.map((f) => f.name).join(", ")}.`,
    }
  }
  const fd = new FormData()
  for (const f of files) fd.append("documentFiles", f)
  const res = await fetch(
    `${base}/deals/${encodeURIComponent(dealId)}/offering-document-uploads`,
    {
      method: "POST",
      headers: { ...authHeaders() },
      body: fd,
      credentials: "include",
    },
  )
  const data = (await res.json().catch(() => ({}))) as {
    newPaths?: unknown
    message?: string
  }
  if (res.status === 200) {
    const np = data.newPaths
    const newPaths = Array.isArray(np)
      ? np.filter((x): x is string => typeof x === "string")
      : []
    return { ok: true, newPaths }
  }
  return {
    ok: false,
    message:
      data.message || `Could not upload documents (${res.status})`,
  }
}

export async function patchDealGalleryCover(
  dealId: string,
  galleryCoverImageUrl: string | null,
): Promise<
  { ok: true; deal: DealDetailApi } | { ok: false; message: string }
> {
  const base = getApiV1Base()
  if (!base)
    return { ok: false, message: "VITE_BASE_URL is not configured." }
  const res = await fetch(
    `${base}/deals/${encodeURIComponent(dealId)}/gallery-cover`,
    {
      method: "PATCH",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        gallery_cover_image_url: galleryCoverImageUrl,
      }),
    },
  )
  const data = (await res.json().catch(() => ({}))) as {
    deal?: DealDetailApi & Record<string, unknown>
    message?: string
  }
  if (res.status === 200 && data.deal) {
    return { ok: true, deal: normalizeDealDetailApi(data.deal) }
  }
  return {
    ok: false,
    message: data.message || `Could not save cover image (${res.status})`,
  }
}

function normalizeInvestorClass(
  raw: Record<string, unknown>,
  index: number,
): DealInvestorClass {
  return {
    id: str(raw.id, `ic-${index}`),
    dealId: str(raw.dealId ?? raw.deal_id),
    name: str(
      firstDefined(raw, [
        "name",
        "className",
        "class_name",
        "title",
        "label",
        "investor_class_name",
      ]) ?? raw.name,
    ),
    subscriptionType: str(raw.subscriptionType ?? raw.subscription_type),
    entityName: str(raw.entityName ?? raw.entity_name),
    startDate: str(raw.startDate ?? raw.start_date),
    offeringSize: str(raw.offeringSize ?? raw.offering_size),
    raiseAmountDistributions: str(
      raw.raiseAmountDistributions ?? raw.raise_amount_distributions,
    ),
    billingRaiseQuota: str(
      raw.billingRaiseQuota ?? raw.billing_raise_quota,
    ),
    minimumInvestment: str(
      raw.minimumInvestment ?? raw.minimum_investment,
    ),
    numberOfUnits: str(raw.numberOfUnits ?? raw.number_of_units),
    pricePerUnit: str(raw.pricePerUnit ?? raw.price_per_unit),
    status: str(raw.status, "draft"),
    visibility: str(raw.visibility),
    advancedOptionsJson: str(
      raw.advancedOptionsJson ?? raw.advanced_options_json,
      "{}",
    ),
    createdAt: str(raw.createdAt ?? raw.created_at),
    updatedAt: str(raw.updatedAt ?? raw.updated_at),
  }
}

function extractInvestorClassesPayload(data: Record<string, unknown>): unknown[] {
  const direct =
    data.investorClasses ??
    data.investor_classes ??
    data.classes ??
    data.items
  if (Array.isArray(direct)) return direct
  const nested = data.data
  if (Array.isArray(nested)) return nested
  if (nested != null && typeof nested === "object") {
    const n = nested as Record<string, unknown>
    const inner =
      n.investorClasses ?? n.investor_classes ?? n.classes ?? n.items
    if (Array.isArray(inner)) return inner
  }
  return []
}

export async function fetchDealInvestorClasses(
  dealId: string,
): Promise<DealInvestorClass[]> {
  const base = getApiV1Base()
  if (!base) return []
  try {
    const res = await fetch(
      `${base}/deals/${encodeURIComponent(dealId)}/investor-classes`,
      {
        headers: { ...authHeaders() },
        credentials: "include",
      },
    )
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) return []
    const list = extractInvestorClassesPayload(data)
    if (!Array.isArray(list) || list.length === 0) return []
    return list
      .filter((x): x is Record<string, unknown> => x != null && typeof x === "object")
      .map((x, i) => {
        try {
          return normalizeInvestorClass(x, i)
        } catch {
          return null
        }
      })
      .filter((x): x is DealInvestorClass => x != null)
  } catch {
    return []
  }
}

function jsonBody(values: DealInvestorClassFormValues): Record<string, string> {
  return {
    name: values.name,
    subscription_type: values.subscriptionType,
    entity_name: values.entityName,
    start_date: values.startDate,
    offering_size: values.offeringSize,
    raise_amount_distributions: values.raiseAmountDistributions,
    billing_raise_quota: values.billingRaiseQuota,
    minimum_investment: values.minimumInvestment,
    number_of_units: values.numberOfUnits,
    price_per_unit: values.pricePerUnit,
    status: values.status,
    visibility: values.visibility,
    advanced_options_json: JSON.stringify(values.advanced),
  }
}

export async function createDealInvestorClass(
  dealId: string,
  values: DealInvestorClassFormValues,
): Promise<DealInvestorClass> {
  const base = getApiV1Base()
  if (!base) throw new Error("API is not configured (VITE_BASE_URL).")
  const res = await fetch(
    `${base}/deals/${encodeURIComponent(dealId)}/investor-classes`,
    {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(jsonBody(values)),
    },
  )
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    investorClass?: Record<string, unknown>
  }
  if (!res.ok)
    throw new Error(
      data.message != null ? String(data.message) : `Error ${res.status}`,
    )
  const c = data.investorClass
  if (!c || typeof c !== "object") throw new Error("Invalid response")
  return normalizeInvestorClass(c as Record<string, unknown>, 0)
}

export async function updateDealInvestorClass(
  dealId: string,
  classId: string,
  values: DealInvestorClassFormValues,
): Promise<DealInvestorClass> {
  const base = getApiV1Base()
  if (!base) throw new Error("API is not configured (VITE_BASE_URL).")
  const res = await fetch(
    `${base}/deals/${encodeURIComponent(dealId)}/investor-classes/${encodeURIComponent(classId)}`,
    {
      method: "PUT",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(jsonBody(values)),
    },
  )
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    investorClass?: Record<string, unknown>
  }
  if (!res.ok)
    throw new Error(
      data.message != null ? String(data.message) : `Error ${res.status}`,
    )
  const c = data.investorClass
  if (!c || typeof c !== "object") throw new Error("Invalid response")
  return normalizeInvestorClass(c as Record<string, unknown>, 0)
}

export async function deleteDealInvestorClass(
  dealId: string,
  classId: string,
): Promise<void> {
  const base = getApiV1Base()
  if (!base) throw new Error("API is not configured (VITE_BASE_URL).")
  const res = await fetch(
    `${base}/deals/${encodeURIComponent(dealId)}/investor-classes/${encodeURIComponent(classId)}`,
    {
      method: "DELETE",
      headers: { ...authHeaders() },
      credentials: "include",
    },
  )
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(
      data.message != null ? String(data.message) : `Error ${res.status}`,
    )
  }
}

const AUTOSAVE_PLACEHOLDER_TEXT = "Pending"

/** Default deal title sent on autosave when the name field is empty; must match {@link buildCreateDealFormDataForAutosave}. */
export const AUTOSAVE_DEFAULT_DEAL_NAME = "Untitled deal"

function isAutosavePlaceholderStored(value: string): boolean {
  return value.trim().toLowerCase() === AUTOSAVE_PLACEHOLDER_TEXT.toLowerCase()
}

/**
 * Maps GET /deals/:id strings into create-wizard controlled fields. Strips autosave
 * placeholders so "Pending" / default "Untitled deal" never show as literal input values.
 */
export function dealDetailFieldForCreateWizard(
  field:
    | "dealName"
    | "secType"
    | "owningEntityName"
    | "propertyName"
    | "city"
    | "streetAddress1"
    | "streetAddress2"
    | "state"
    | "zipCode",
  stored: string | undefined | null,
  detailIncomplete: boolean,
): string {
  const raw = String(stored ?? "")
  const t = raw.trim()
  if (!t) return ""
  if (isAutosavePlaceholderStored(t)) return ""
  if (
    field === "dealName" &&
    detailIncomplete &&
    t.toLowerCase() === AUTOSAVE_DEFAULT_DEAL_NAME.toLowerCase()
  )
    return ""
  return raw
}

/**
 * True when the create/edit deal form is not fully completed: lifecycle stage is Draft
 * and/or required fields still hold autosave placeholders (see
 * {@link buildCreateDealFormDataForAutosave}).
 */
export function isDealDetailFormIncomplete(d: DealDetailApi): boolean {
  const stage = String(d.dealStage ?? "").trim().toLowerCase()
  if (stage === "draft") return true
  if (isAutosavePlaceholderStored(String(d.secType ?? ""))) return true
  if (isAutosavePlaceholderStored(String(d.owningEntityName ?? ""))) return true
  if (isAutosavePlaceholderStored(String(d.propertyName ?? ""))) return true
  if (isAutosavePlaceholderStored(String(d.city ?? ""))) return true
  return false
}

/**
 * Same rules as {@link isDealDetailFormIncomplete} for list rows (requires
 * `secType`, `owningEntityName`, `propertyName`, `city` on the row when the API sends them).
 */
export function isDealListRowIncomplete(row: DealListRow): boolean {
  const stage = String(row.dealStage ?? "").trim().toLowerCase()
  if (stage === "draft") return true
  if (isAutosavePlaceholderStored(String(row.secType ?? ""))) return true
  if (isAutosavePlaceholderStored(String(row.owningEntityName ?? ""))) return true
  if (isAutosavePlaceholderStored(String(row.propertyName ?? ""))) return true
  if (isAutosavePlaceholderStored(String(row.city ?? ""))) return true
  return false
}

/** Optional image fields for {@link buildCreateDealFormData} / autosave (edit deal PUT). */
export type CreateDealMultipartImageOptions = {
  /** Upload-relative path segments still on the property (after optional removals). */
  retainedAssetImagePath?: string[]
}

/**
 * Same fields as {@link buildCreateDealFormData}, with placeholders so the API accepts
 * incomplete wizard data during debounced autosave.
 */
export function buildCreateDealFormDataForAutosave(
  deal: DealStepDraft,
  asset: AssetStepDraft,
  imageFiles: File[],
  imageOpts?: CreateDealMultipartImageOptions,
): FormData {
  const dealName = deal.dealName.trim() || AUTOSAVE_DEFAULT_DEAL_NAME
  const dealStageRaw = deal.dealStage || "Draft"
  const dealStage =
    typeof dealStageRaw === "string" && dealStageRaw.trim()
      ? dealStageRaw
      : "Draft"
  const secType = deal.secType.trim() || AUTOSAVE_PLACEHOLDER_TEXT
  const owningEntityName =
    deal.owningEntityName.trim() || AUTOSAVE_PLACEHOLDER_TEXT
  const propertyName = asset.propertyName.trim() || AUTOSAVE_PLACEHOLDER_TEXT
  const country =
    (asset.country ?? DEFAULT_ASSET_COUNTRY).trim() || DEFAULT_ASSET_COUNTRY
  const city = asset.city.trim() || AUTOSAVE_PLACEHOLDER_TEXT

  const fd = new FormData()
  fd.append("deal_name", dealName)
  fd.append("deal_type", deal.dealType.trim())
  fd.append("deal_stage", dealStage)
  fd.append("sec_type", secType)
  if (deal.closeDate) fd.append("close_date", deal.closeDate)
  fd.append("owning_entity_name", owningEntityName)
  fd.append(
    "funds_required_before_gp_sign",
    deal.fundsBeforeGpCountersigns === "yes" ? "true" : "false",
  )
  fd.append(
    "auto_send_funding_instructions",
    deal.autoFundingAfterGpCountersigns === "yes" ? "true" : "false",
  )
  fd.append("property_name", propertyName)
  fd.append("country", country)
  fd.append("address_line_1", asset.streetAddress1.trim())
  fd.append("address_line_2", asset.streetAddress2.trim())
  fd.append("city", city)
  fd.append("state", asset.state.trim())
  fd.append("zip_code", asset.zipCode.trim())
  if (imageOpts?.retainedAssetImagePath !== undefined) {
    fd.append(
      "retained_asset_image_path",
      imageOpts.retainedAssetImagePath.join(";"),
    )
  }
  for (const file of imageFiles) fd.append("assetImages", file)
  return fd
}

export function buildCreateDealFormData(
  deal: DealStepDraft,
  asset: AssetStepDraft,
  imageFiles: File[],
  imageOpts?: CreateDealMultipartImageOptions,
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
  fd.append("address_line_1", asset.streetAddress1.trim())
  fd.append("address_line_2", asset.streetAddress2.trim())
  fd.append("city", asset.city.trim())
  fd.append("state", asset.state.trim())
  fd.append("zip_code", asset.zipCode.trim())
  if (imageOpts?.retainedAssetImagePath !== undefined) {
    fd.append(
      "retained_asset_image_path",
      imageOpts.retainedAssetImagePath.join(";"),
    )
  }
  for (const file of imageFiles) fd.append("assetImages", file)
  return fd
}

export async function createDealMultipart(
  formData: FormData,
): Promise<
  | { ok: true; dealId?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }
> {
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
    deal?: { id?: string }
  }
  if (res.status === 201) {
    const rawId = data.deal?.id
    const dealId =
      rawId != null && String(rawId).trim() ? String(rawId).trim() : undefined
    return { ok: true, dealId }
  }
  if (res.status === 400 && data.errors)
    return { ok: false, message: data.message || "Validation failed", fieldErrors: data.errors }
  return {
    ok: false,
    message: data.message || `Could not create deal (${res.status})`,
  }
}

export async function updateDealMultipart(
  dealId: string,
  formData: FormData,
): Promise<{ ok: true } | { ok: false; message: string; fieldErrors?: Record<string, string> }> {
  const base = getApiV1Base()
  if (!base)
    return { ok: false, message: "VITE_BASE_URL is not configured." }
  const res = await fetch(`${base}/deals/${encodeURIComponent(dealId)}`, {
    method: "PUT",
    headers: { ...authHeaders() },
    body: formData,
    credentials: "include",
  })
  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    errors?: Record<string, string>
  }
  if (res.status === 200) return { ok: true }
  if (res.status === 400 && data.errors)
    return { ok: false, message: data.message || "Validation failed", fieldErrors: data.errors }
  return {
    ok: false,
    message: data.message || `Could not update deal (${res.status})`,
  }
}

export async function deleteDeal(
  dealId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const base = getApiV1Base()
  if (!base)
    return { ok: false, message: "VITE_BASE_URL is not configured." }
  const res = await fetch(`${base}/deals/${encodeURIComponent(dealId)}`, {
    method: "DELETE",
    headers: { ...authHeaders() },
    credentials: "include",
  })
  if (res.status === 204 || res.status === 200) return { ok: true }
  const data = (await res.json().catch(() => ({}))) as { message?: string }
  return {
    ok: false,
    message: data.message || `Could not delete deal (${res.status})`,
  }
}

function emptyInvestorsKpis(): DealInvestorsKpis {
  const z = "—"
  return {
    offeringSize: z,
    committed: z,
    remaining: z,
    totalApproved: z,
    totalPending: z,
    totalFunded: z,
    approvedCount: z,
    pendingCount: z,
    waitlistCount: z,
    averageApproved: z,
    nonAccreditedCount: z,
  }
}

function parseExtraContributionAmountsFromRaw(
  raw: Record<string, unknown>,
): string[] {
  const v =
    raw.extraContributionAmounts ?? raw.extra_contribution_amounts
  if (Array.isArray(v)) return v.map((x) => String(x))
  if (typeof v === "string" && v.trim()) {
    try {
      const p = JSON.parse(v) as unknown
      if (Array.isArray(p)) return p.map((x) => String(x))
    } catch {
      /* ignore */
    }
  }
  return []
}

function normalizeInvestorRowApi(
  raw: Record<string, unknown>,
  index: number,
): DealInvestorRow {
  const commitmentAmountRaw = str(
    firstDefined(raw, [
      "commitmentAmountRaw",
      "commitment_amount_raw",
      "commitmentAmount",
      "commitment_amount",
    ]),
  )
  const extras = parseExtraContributionAmountsFromRaw(raw)

  const committedFromApi = firstDefined(raw, [
    "committed",
    "amount_committed",
    "committed_amount",
    "total_committed",
  ])
  const committedTrimmed =
    committedFromApi == null ? "" : String(committedFromApi).trim()
  const hasCommittedString =
    committedTrimmed !== "" && committedTrimmed !== "—"

  /** Sum of deal_investment.commitment_amount + extra_contribution_amounts (DB source of truth). */
  const fromRawParts = formatCommittedFromRawParts(
    commitmentAmountRaw,
    extras,
  )

  /**
   * Show commitment from the investment row first; fall back to API `committed` when raw is absent
   * (e.g. older payloads).
   */
  const committedDisplay =
    fromRawParts !== "—"
      ? fromRawParts
      : hasCommittedString
        ? formatCurrencyTableDisplay(committedTrimmed)
        : formatCommittedZeroUsd()

  return {
    id: str(firstDefined(raw, ["id", "investor_id"]) ?? raw.id, `inv-${index}`),
    displayName: str(
      firstDefined(raw, [
        "displayName",
        "display_name",
        "contact_display_name",
        "contactDisplayName",
        "name",
        "full_name",
      ]),
    ),
    entitySubtitle: str(
      firstDefined(raw, [
        "entitySubtitle",
        "entity_subtitle",
        "entity_type",
        "subtitle",
      ]),
    ),
    investorClass: str(
      firstDefined(raw, [
        "investorClass",
        "investor_class",
        "class",
        "investorClassName",
        "investor_class_name",
        "className",
        "class_name",
        "offeringClass",
        "offering_class",
      ]),
    ),
    investorRole: str(
      firstDefined(raw, ["investorRole", "investor_role", "role"]),
    ),
    memberRoleLabels: (() => {
      const v =
        raw.memberRoleLabels ??
        raw.member_role_labels ??
        raw.dealMemberRoleLabels ??
        raw.deal_member_role_labels
      if (!Array.isArray(v)) return undefined
      const out = v
        .map((x) => String(x ?? "").trim())
        .filter(Boolean)
      return out.length > 0 ? out : undefined
    })(),
    status: str(
      firstDefined(raw, [
        "status",
        "investment_status",
        "investmentStatus",
      ]),
    ),
    committed: committedDisplay,
    signedDate: formatDateDdMmmYyyy(
      str(
        firstDefined(raw, [
          "signedDate",
          "signed_date",
          "signed",
          "docSignedDate",
          "doc_signed_date",
        ]),
      ),
    ),
    fundedDate: formatDateDdMmmYyyy(
      str(firstDefined(raw, ["fundedDate", "funded_date", "funded"])),
    ),
    selfAccredited: str(
      firstDefined(raw, ["selfAccredited", "self_accredited", "self_acc"]),
      "—",
    ),
    verifiedAccLabel: str(
      firstDefined(raw, [
        "verifiedAccLabel",
        "verified_acc_label",
        "verified_accreditation",
      ]),
      "—",
    ),
    userDisplayName: str(
      firstDefined(raw, [
        "userDisplayName",
        "user_display_name",
        "username",
        "user_name",
        "portal_user",
      ]),
      "—",
    ),
    userEmail: str(
      firstDefined(raw, ["userEmail", "user_email", "email"]),
      "—",
    ),
    contactId: str(firstDefined(raw, ["contactId", "contact_id"])),
    profileId: str(firstDefined(raw, ["profileId", "profile_id"])),
    userInvestorProfileId: str(
      firstDefined(raw, ["userInvestorProfileId", "user_investor_profile_id"]),
    ),
    userInvestorProfileName: str(
      firstDefined(raw, [
        "userInvestorProfileName",
        "user_investor_profile_name",
        "savedProfileName",
        "saved_profile_name",
      ]),
    ),
    offeringId: str(firstDefined(raw, ["offeringId", "offering_id"])),
    commitmentAmountRaw:
      commitmentAmountRaw.trim() !== ""
        ? commitmentAmountRaw
        : hasCommittedString
          ? String(committedFromApi).trim()
          : "",
    extraContributionAmounts: extras,
    docSignedDateIso: str(
      firstDefined(raw, [
        "docSignedDateIso",
        "doc_signed_date_iso",
        "docSignedDate",
        "doc_signed_date",
      ]),
    ),
    addedByDisplayName: str(
      firstDefined(raw, [
        "addedByDisplayName",
        "added_by_display_name",
      ]),
      "—",
    ),
    ...(() => {
      const adder = firstDefined(raw, ["addedByUserId", "added_by_user_id"]);
      if (adder == null || !String(adder).trim()) return {}
      return { addedByUserId: String(adder).trim() }
    })(),
    addedInvestorsCommitted: str(
      firstDefined(raw, [
        "addedInvestorsCommitted",
        "added_investors_committed",
      ]),
      "—",
    ),
    investorKind: (() => {
      const ik = firstDefined(raw, ["investorKind", "investor_kind"])
      if (ik === "lp_roster" || ik === "investment") return ik
      return undefined
    })(),
    ...(() => {
      const v = firstDefined(raw, [
        "invitationMailSent",
        "invitation_mail_sent",
        "sendInvitationMail",
        "send_invitation_mail",
      ])
      if (v === true) return { invitationMailSent: true as const }
      if (v === false) return { invitationMailSent: false as const }
      const s = String(v ?? "")
        .trim()
        .toLowerCase()
      if (s === "yes" || s === "1" || s === "true" || s === "y")
        return { invitationMailSent: true as const }
      if (s === "no" || s === "0" || s === "false" || s === "n" || s === "")
        return { invitationMailSent: false as const }
      return {}
    })(),
    ...(() => {
      const v = firstDefined(raw, ["fundApproved", "fund_approved"])
      if (v === true) return { fundApproved: true as const }
      if (v === false) return { fundApproved: false as const }
      const s = String(v ?? "")
        .trim()
        .toLowerCase()
      if (s === "true" || s === "1" || s === "yes") return { fundApproved: true as const }
      if (s === "false" || s === "0" || s === "no")
        return { fundApproved: false as const }
      return {}
    })(),
    fundApprovedCommitmentSnapshot: str(
      firstDefined(raw, [
        "fundApprovedCommitmentSnapshot",
        "fund_approved_commitment_snapshot",
      ]),
      "",
    ),
  }
}

function normalizeDealInvestorsResponse(data: unknown): DealInvestorsPayload {
  if (!data || typeof data !== "object") {
    return { kpis: emptyInvestorsKpis(), investors: [] }
  }
  const d = data as Record<string, unknown>
  const inv = d.investors ?? d.rows
  const kpisObj = (d.kpis ?? d.summary ?? {}) as Record<string, unknown>

  const kpis: DealInvestorsKpis = {
    offeringSize: str(
      firstDefined(kpisObj, ["offeringSize", "offering_size"]),
      "—",
    ),
    committed: str(firstDefined(kpisObj, ["committed"]), "—"),
    remaining: str(firstDefined(kpisObj, ["remaining"]), "—"),
    totalApproved: str(
      firstDefined(kpisObj, ["totalApproved", "total_approved"]),
      "—",
    ),
    totalPending: str(
      firstDefined(kpisObj, ["totalPending", "total_pending"]),
      "—",
    ),
    totalFunded: str(
      firstDefined(kpisObj, ["totalFunded", "total_funded"]),
      "—",
    ),
    approvedCount: str(
      firstDefined(kpisObj, ["approvedCount", "approved_count"]),
      "—",
    ),
    pendingCount: str(
      firstDefined(kpisObj, ["pendingCount", "pending_count"]),
      "—",
    ),
    waitlistCount: str(
      firstDefined(kpisObj, ["waitlistCount", "waitlist_count"]),
      "—",
    ),
    averageApproved: str(
      firstDefined(kpisObj, ["averageApproved", "average_approved"]),
      "—",
    ),
    nonAccreditedCount: str(
      firstDefined(kpisObj, ["nonAccreditedCount", "non_accredited_count"]),
      "—",
    ),
  }

  if (!Array.isArray(inv)) return { kpis, investors: [] }
  return {
    kpis,
    investors: inv.map((item, i) =>
      normalizeInvestorRowApi(
        item != null && typeof item === "object"
          ? (item as Record<string, unknown>)
          : {},
        i,
      ),
    ),
  }
}

function normalizeDealMembersResponse(data: unknown): DealInvestorRow[] {
  if (!data || typeof data !== "object") return []
  const d = data as Record<string, unknown>
  const raw = d.members ?? d.rows ?? d.investors
  if (!Array.isArray(raw)) return []
  return raw.map((item, i) =>
    normalizeInvestorRowApi(
      item != null && typeof item === "object"
        ? (item as Record<string, unknown>)
        : {},
      i,
    ),
  )
}

/**
 * Loads KPIs + investor rows for the deal detail Investors tab.
 * Expected API: `GET /deals/:dealId/investors` → `{ kpis?: {...}, investors: [...] }`.
 * Pass `lpInvestorsOnly` to limit rows to LP investor role (`lpInvestorsOnly=1`).
 */
export async function fetchDealInvestors(
  dealId: string,
  options?: { lpInvestorsOnly?: boolean },
): Promise<DealInvestorsPayload> {
  const base = getApiV1Base()
  if (!base) return { kpis: emptyInvestorsKpis(), investors: [] }
  try {
    const q = options?.lpInvestorsOnly ? "?lpInvestorsOnly=1" : ""
    const res = await fetch(
      `${base}/deals/${encodeURIComponent(dealId)}/investors${q}`,
      {
        headers: { ...authHeaders() },
        credentials: "include",
      },
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { kpis: emptyInvestorsKpis(), investors: [] }
    return normalizeDealInvestorsResponse(data)
  } catch {
    return { kpis: emptyInvestorsKpis(), investors: [] }
  }
}

/** Response from GET /deals/:dealId/commitment-amount?contact_id=… */
export interface DealCommitmentAmountResult {
  dealId: string
  contactId: string
  /** Raw stored `commitment_amount` text, or null when none / blank. */
  commitmentAmount: string | null
  found: boolean
}

/**
 * Latest `commitment_amount` for `(deal_id, contact_id)` (viewer-scoped).
 * @throws If config is missing, ids are blank, or the request fails (401/404/500).
 */
export async function fetchDealCommitmentAmount(
  dealId: string,
  contactId: string,
): Promise<DealCommitmentAmountResult> {
  const did = dealId.trim()
  const cid = contactId.trim()
  if (!did) throw new Error("Missing deal id.")
  if (!cid) throw new Error("Missing contact id.")
  const base = getApiV1Base()
  if (!base) throw new Error("VITE_BASE_URL is not configured.")
  const params = new URLSearchParams()
  params.set("contact_id", cid)
  const res = await fetch(
    `${base}/deals/${encodeURIComponent(did)}/commitment-amount?${params.toString()}`,
    {
      headers: { ...authHeaders() },
      credentials: "include",
    },
  )
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    throw new Error(
      typeof data.message === "string"
        ? data.message
        : `Could not load commitment amount (${res.status})`,
    )
  }
  const rawAmt = firstDefined(data, [
    "commitmentAmount",
    "commitment_amount",
  ])
  const commitmentAmount =
    rawAmt == null || String(rawAmt).trim() === ""
      ? null
      : String(rawAmt).trim()
  const found =
    typeof data.found === "boolean"
      ? data.found
      : Boolean(commitmentAmount)
  return {
    dealId: str(firstDefined(data, ["dealId", "deal_id"]) ?? did),
    contactId: str(firstDefined(data, ["contactId", "contact_id"]) ?? cid),
    commitmentAmount,
    found,
  }
}

/**
 * GET /deals/:dealId/members — roster from `deal_member` merged with investments
 * (commitment = sum of all `deal_investment` rows per contact on this deal).
 */
export async function fetchDealMembers(dealId: string): Promise<DealInvestorRow[]> {
  const base = getApiV1Base()
  if (!base) return []
  try {
    const res = await fetch(
      `${base}/deals/${encodeURIComponent(dealId)}/members`,
      {
        headers: { ...authHeaders() },
        credentials: "include",
      },
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return []
    return normalizeDealMembersResponse(data)
  } catch {
    return []
  }
}

export interface DealReviewSummary {
  reviewRating: number
  reviewCount: number
}

/**
 * Optional enrichment when the list API omits review fields. If you add
 * `GET /deals/:dealId/review-summary` → `{ reviewRating, reviewCount }` (or
 * snake_case), implement a `fetch` here (same pattern as `fetchDealMembers`).
 * The current backend has no such route, so this returns `null` and the
 * dashboard uses `DealListRow.reviewRating` / `reviewCount` from the list.
 */
export async function fetchDealReviewSummary(
  _dealId: string,
): Promise<DealReviewSummary | null> {
  return null
}

export type PostDealMemberInvitationEmailResult =
  | { ok: true }
  | { ok: false; message: string }

/**
 * POST `/deals/:dealId/members/send-invitation-email` — sends HTML/text from
 * backend template using SMTP settings in server `.env.local`.
 * Use `invitation_source: "investor"` from the **Investors** tab; `"deal_member"` from **Deal
 * members** and pass the row `Role` in `deal_member_role`.
 */
export async function postDealMemberInvitationEmail(
  dealId: string,
  input: {
    to_email: string
    member_display_name?: string
    invitation_source?: "investor" | "deal_member"
    deal_member_role?: string
  },
): Promise<PostDealMemberInvitationEmailResult> {
  const base = getApiV1Base()
  if (!base) {
    return { ok: false, message: "API base URL is not configured" }
  }
  try {
    const res = await fetch(
      `${base}/deals/${encodeURIComponent(dealId)}/members/send-invitation-email`,
      {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          to_email: input.to_email.trim(),
          member_display_name: input.member_display_name?.trim() ?? "",
          invitation_source: input.invitation_source ?? "investor",
          deal_member_role: input.deal_member_role?.trim() ?? "",
        }),
      },
    )
    const data = (await res.json().catch(() => ({}))) as {
      message?: unknown
    }
    if (!res.ok) {
      const msg =
        data.message != null ? String(data.message) : res.statusText
      return { ok: false, message: msg || "Could not send email" }
    }
    return { ok: true }
  } catch {
    return { ok: false, message: "Network error" }
  }
}

/**
 * DELETE `/deals/:dealId/members/:rowId` — `rowId` is a `deal_investment` id or `deal_member` id from the roster API.
 */
export async function deleteDealMemberRoster(
  dealId: string,
  rowId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const base = getApiV1Base()
  if (!base) {
    return { ok: false, message: "API base URL is not configured" }
  }
  try {
    const res = await fetch(
      `${base}/deals/${encodeURIComponent(dealId)}/members/${encodeURIComponent(rowId)}`,
      {
        method: "DELETE",
        headers: { ...authHeaders() },
        credentials: "include",
      },
    )
    const data = (await res.json().catch(() => ({}))) as { message?: unknown }
    if (!res.ok) {
      const msg =
        data.message != null ? String(data.message) : res.statusText
      return { ok: false, message: msg || "Could not remove member" }
    }
    return { ok: true }
  } catch {
    return { ok: false, message: "Network error" }
  }
}

export type PatchMyLpDealCommitmentResult =
  | { ok: true; investorsPayload: DealInvestorsPayload }
  | { ok: false; message: string }

/**
 * PATCH `/deals/:dealId/lp-investors/my-commitment` — LP adds an amount to their cumulative
 * commitment for this deal (same investor profile row); first commit uses this as the initial total.
 */
export async function patchMyLpDealCommitment(
  dealId: string,
  committedAmount: string,
  body: { profileId: string },
): Promise<PatchMyLpDealCommitmentResult> {
  const base = getApiV1Base()
  if (!base) return { ok: false, message: "API base URL is not configured." }
  const did = dealId.trim()
  if (!did) return { ok: false, message: "Missing deal id." }
  try {
    const res = await fetch(
      `${base}/deals/${encodeURIComponent(did)}/lp-investors/my-commitment`,
      {
        method: "PATCH",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          committed_amount: committedAmount,
          profile_id: body.profileId.trim(),
        }),
      },
    )

    console.log("response =>", res);
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    console.log("data =>", data);
    if (!res.ok) {
      const msg =
        typeof data.message === "string"
          ? data.message
          : `Could not save commitment (${res.status})`
      return { ok: false, message: msg }
    }
    const rawPayload = data.investorsPayload ?? data.investors_payload
    if (!rawPayload || typeof rawPayload !== "object") {
      return { ok: false, message: "Invalid response from server." }
    }
    return {
      ok: true,
      investorsPayload: normalizeDealInvestorsResponse(rawPayload),
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error"
    return { ok: false, message: msg }
  }
}

export type PostDealLpInvestorResult =
  | { ok: true; mode: "api"; lpInvestorId?: string }
  | { ok: true; mode: "client" }
  | { ok: false; message: string }

/** JSON POST `/deals/:dealId/lp-investors` — roster row in `deal_lp_investor` (no `deal_investment`). */
export async function postDealLpInvestor(
  dealId: string,
  values: AddInvestmentFormValues,
  options?: { autosave?: boolean },
): Promise<PostDealLpInvestorResult> {
  const base = getApiV1Base()
  if (!base) return { ok: true, mode: "client" }

  const body: Record<string, unknown> = {
    contact_id: values.contactId,
    contact_display_name: values.contactDisplayName?.trim() ?? "",
    investor_class: values.investorClass,
    send_invitation_mail: values.sendInvitationMail ?? "no",
    profile_id: String(values.profileId ?? "").trim(),
  }
  const ce = values.contactEmail?.trim()
  if (ce) body.contact_email = ce
  const role = values.investorRole?.trim()
  if (role) body.investor_role = role
  if (options?.autosave) body.autosave = true

  try {
    const res = await fetch(
      `${base}/deals/${encodeURIComponent(dealId)}/lp-investors`,
      {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(body),
      },
    )
    const data = (await res.json().catch(() => ({}))) as {
      message?: unknown
      investor?: { id?: string }
    }
    if (!res.ok) {
      const msg =
        data?.message != null ? String(data.message) : res.statusText
      return { ok: false, message: msg || "Could not save LP investor" }
    }
    const rawId = data.investor?.id
    const lpInvestorId =
      rawId != null && String(rawId).trim()
        ? String(rawId).trim()
        : undefined
    return { ok: true, mode: "api", lpInvestorId }
  } catch {
    return { ok: false, message: "Network error" }
  }
}

/** JSON PUT `/deals/:dealId/lp-investors/:lpInvestorId`. */
export async function putDealLpInvestor(
  dealId: string,
  lpInvestorId: string,
  values: AddInvestmentFormValues,
  options?: { autosave?: boolean },
): Promise<PostDealLpInvestorResult> {
  const base = getApiV1Base()
  if (!base) return { ok: true, mode: "client" }

  const body: Record<string, unknown> = {
    contact_id: values.contactId,
    contact_display_name: values.contactDisplayName?.trim() ?? "",
    investor_class: values.investorClass,
    send_invitation_mail: values.sendInvitationMail ?? "no",
    profile_id: String(values.profileId ?? "").trim(),
  }
  const ce = values.contactEmail?.trim()
  if (ce) body.contact_email = ce
  const role = values.investorRole?.trim()
  if (role) body.investor_role = role
  if (options?.autosave) body.autosave = true

  try {
    const res = await fetch(
      `${base}/deals/${encodeURIComponent(dealId)}/lp-investors/${encodeURIComponent(lpInvestorId)}`,
      {
        method: "PUT",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(body),
      },
    )
    const data = (await res.json().catch(() => ({}))) as {
      message?: unknown
    }
    if (!res.ok) {
      const msg =
        data?.message != null ? String(data.message) : res.statusText
      return { ok: false, message: msg || "Could not update LP investor" }
    }
    return { ok: true, mode: "api" }
  } catch {
    return { ok: false, message: "Network error" }
  }
}

export type PostDealInvestmentResult =
  | { ok: true; mode: "api"; investmentId?: string }
  | { ok: true; mode: "client" }
  | { ok: false; message: string }

function appendDealInvestmentMultipartFields(
  fd: FormData,
  values: AddInvestmentFormValues,
  documentFile: File | null,
  options?: { autosave?: boolean },
): void {
  fd.append("offering_id", values.offeringId)
  fd.append("contact_id", values.contactId)
  fd.append("contact_display_name", values.contactDisplayName?.trim() ?? "")
  fd.append("profile_id", values.profileId)
  fd.append("investor_role", values.investorRole?.trim() ?? "")
  fd.append("status", values.status)
  fd.append("investor_class", values.investorClass)
  fd.append("doc_signed_date", values.docSignedDate)
  /* Backend rejects blank; autosave uses "0". Add Member / hidden fields send no amount — same default. */
  fd.append(
    "commitment_amount",
    values.commitmentAmount.trim() !== "" ? values.commitmentAmount.trim() : "0",
  )
  fd.append(
    "extra_contribution_amounts",
    JSON.stringify(values.extraContributionAmounts),
  )
  if (documentFile) fd.append("subscriptionDocument", documentFile)
  fd.append("send_invitation_mail", values.sendInvitationMail ?? "no")
  fd.append(
    "fund_approved",
    values.fundApproved === true ? "true" : "false",
  )
  if (options?.autosave) fd.append("autosave", "true")
}

/**
 * POST multipart to `/deals/:dealId/investments`.
 * If no API base URL is configured, returns `{ ok: true, mode: 'client' }` so the UI can save locally only.
 */
export async function postDealInvestment(
  dealId: string,
  values: AddInvestmentFormValues,
  documentFile: File | null,
  options?: { autosave?: boolean },
): Promise<PostDealInvestmentResult> {
  const base = getApiV1Base()
  if (!base) return { ok: true, mode: "client" }

  const fd = new FormData()
  appendDealInvestmentMultipartFields(fd, values, documentFile, options)

  try {
    const res = await fetch(
      `${base}/deals/${encodeURIComponent(dealId)}/investments`,
      {
        method: "POST",
        headers: { ...authHeaders() },
        body: fd,
        credentials: "include",
      },
    )
    const data = (await res.json().catch(() => ({}))) as {
      message?: unknown
      investor?: { id?: string }
    }
    if (!res.ok) {
      const msg =
        data?.message != null ? String(data.message) : res.statusText
      return { ok: false, message: msg || "Could not save investment" }
    }
    const rawId = data.investor?.id
    const investmentId =
      rawId != null && String(rawId).trim()
        ? String(rawId).trim()
        : undefined
    if (import.meta.env.DEV) {
      console.info("[Add member / investment] Stored in DB (POST)", {
        tables: ["deal_investment", "deal_member"],
        dealId,
        autosave: Boolean(options?.autosave),
        deal_investment_row: {
          offering_id: values.offeringId,
          contact_id: values.contactId,
          contact_display_name: values.contactDisplayName?.trim() ?? "",
          profile_id: values.profileId,
          investor_role: values.investorRole?.trim() ?? "",
          status: values.status,
          investor_class: values.investorClass,
          doc_signed_date: values.docSignedDate || null,
          commitment_amount: values.commitmentAmount,
          extra_contribution_amounts: values.extraContributionAmounts,
          subscription_document_uploaded: Boolean(documentFile),
        },
        deal_member_row: {
          offering_id: values.offeringId,
          contact_id: values.contactId,
          contact_display_name: values.contactDisplayName?.trim() ?? "",
          profile_id: values.profileId,
          investor_role: values.investorRole?.trim() ?? "",
          status: values.status,
          investor_class: values.investorClass,
          send_invitation_mail: values.sendInvitationMail ?? "no",
        },
      })
    }
    return { ok: true, mode: "api", investmentId }
  } catch {
    return { ok: false, message: "Network error" }
  }
}

/**
 * PUT multipart to `/deals/:dealId/investments/:investmentId` — same fields as POST.
 */
export async function putDealInvestment(
  dealId: string,
  investmentId: string,
  values: AddInvestmentFormValues,
  documentFile: File | null,
  options?: { autosave?: boolean },
): Promise<PostDealInvestmentResult> {
  const base = getApiV1Base()
  if (!base) return { ok: true, mode: "client" }

  const fd = new FormData()
  appendDealInvestmentMultipartFields(fd, values, documentFile, options)

  try {
    const res = await fetch(
      `${base}/deals/${encodeURIComponent(dealId)}/investments/${encodeURIComponent(investmentId)}`,
      {
        method: "PUT",
        headers: { ...authHeaders() },
        body: fd,
        credentials: "include",
      },
    )
    const data = (await res.json().catch(() => ({}))) as {
      message?: unknown
    }
    if (!res.ok) {
      const msg =
        data?.message != null ? String(data.message) : res.statusText
      return { ok: false, message: msg || "Could not update investment" }
    }
    if (import.meta.env.DEV) {
      console.info("[Edit investment] Stored in DB (PUT)", {
        tables: ["deal_investment", "deal_member"],
        dealId,
        investmentId,
        autosave: Boolean(options?.autosave),
        deal_investment_row: {
          offering_id: values.offeringId,
          contact_id: values.contactId,
          contact_display_name: values.contactDisplayName?.trim() ?? "",
          profile_id: values.profileId,
          investor_role: values.investorRole?.trim() ?? "",
          status: values.status,
          investor_class: values.investorClass,
          doc_signed_date: values.docSignedDate || null,
          commitment_amount: values.commitmentAmount,
          extra_contribution_amounts: values.extraContributionAmounts,
          subscription_document_uploaded: Boolean(documentFile),
        },
        deal_member_row: {
          offering_id: values.offeringId,
          contact_id: values.contactId,
          contact_display_name: values.contactDisplayName?.trim() ?? "",
          profile_id: values.profileId,
          investor_role: values.investorRole?.trim() ?? "",
          status: values.status,
          investor_class: values.investorClass,
          send_invitation_mail: values.sendInvitationMail ?? "no",
        },
      })
    }
    return { ok: true, mode: "api" }
  } catch {
    return { ok: false, message: "Network error" }
  }
}
