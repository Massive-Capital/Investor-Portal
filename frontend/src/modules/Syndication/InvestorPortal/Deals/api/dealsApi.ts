import { SESSION_BEARER_KEY } from "../../../../../common/auth/sessionKeys"
import { getApiV1Base } from "../../../../../common/utils/apiBaseUrl"
import { formatDateDdMmmYyyy } from "../../../../../common/utils/formatDateDisplay"
import { getSampleDealInvestorsPayload } from "../dealInvestorsMock"
import type { AddInvestmentFormValues } from "../types/add-investment.types"
import type {
  DealInvestorRow,
  DealInvestorsKpis,
  DealInvestorsPayload,
} from "../types/deal-investors.types"
import type {
  DealInvestorClass,
  DealInvestorClassFormValues,
} from "../types/deal-investor-class.types"
import type {
  AssetStepDraft,
  DealListRow,
  DealStepDraft,
} from "../types/deals.types"
import { formatMoneyFieldDisplay } from "../utils/offeringMoneyFormat"

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
  /** When API sends a dedicated deal offering size (snake_case normalized here). */
  offeringSize?: string | null
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
  const offeringSizeRaw = firstDefined(d, [
    "offeringSize",
    "offering_size",
  ])
  const offeringSize =
    offeringSizeRaw != null && String(offeringSizeRaw).trim() !== ""
      ? str(offeringSizeRaw)
      : undefined
  return {
    ...d,
    ...(offeringSize !== undefined ? { offeringSize } : {}),
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
    minimumInvestment: str(
      raw.minimumInvestment ?? raw.minimum_investment,
    ),
    pricePerUnit: str(raw.pricePerUnit ?? raw.price_per_unit),
    status: str(raw.status, "draft"),
    visibility: str(raw.visibility),
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
    minimum_investment: values.minimumInvestment,
    price_per_unit: values.pricePerUnit,
    status: values.status,
    visibility: values.visibility,
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
  return []
}

function normalizeInvestorRowApi(
  raw: Record<string, unknown>,
  index: number,
): DealInvestorRow {
  const committedRaw = str(firstDefined(raw, ["committed", "amount_committed"]))
  const commitmentAmountRaw = str(
    firstDefined(raw, [
      "commitmentAmountRaw",
      "commitment_amount_raw",
      "commitmentAmount",
      "commitment_amount",
    ]),
  )
  const extras = parseExtraContributionAmountsFromRaw(raw)
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
    status: str(firstDefined(raw, ["status", "investment_status"])),
    committed: formatMoneyFieldDisplay(committedRaw),
    signedDate: formatDateDdMmmYyyy(
      str(firstDefined(raw, ["signedDate", "signed_date", "signed"])),
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
    offeringId: str(firstDefined(raw, ["offeringId", "offering_id"])),
    commitmentAmountRaw:
      commitmentAmountRaw ||
      (committedRaw.trim() && committedRaw !== "—" ? committedRaw : ""),
    extraContributionAmounts: extras,
    docSignedDateIso: str(
      firstDefined(raw, [
        "docSignedDateIso",
        "doc_signed_date_iso",
        "docSignedDate",
        "doc_signed_date",
      ]),
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

/**
 * Loads KPIs + investor rows for the deal detail Investors tab.
 * Set `VITE_USE_MOCK_DEAL_INVESTORS=true` to preview the populated UI without an API.
 * Expected API: `GET /deals/:dealId/investors` → `{ kpis?: {...}, investors: [...] }`.
 */
export async function fetchDealInvestors(
  dealId: string,
): Promise<DealInvestorsPayload> {
  if (import.meta.env.VITE_USE_MOCK_DEAL_INVESTORS === "true")
    return getSampleDealInvestorsPayload()

  const base = getApiV1Base()
  if (!base) return { kpis: emptyInvestorsKpis(), investors: [] }
  try {
    const res = await fetch(
      `${base}/deals/${encodeURIComponent(dealId)}/investors`,
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

export type PostDealInvestmentResult =
  | { ok: true; mode: "api" }
  | { ok: true; mode: "client" }
  | { ok: false; message: string }

/**
 * POST multipart to `/deals/:dealId/investments`.
 * If no API base URL is configured, returns `{ ok: true, mode: 'client' }` so the UI can save locally only.
 */
export async function postDealInvestment(
  dealId: string,
  values: AddInvestmentFormValues,
  documentFile: File | null,
): Promise<PostDealInvestmentResult> {
  const base = getApiV1Base()
  if (!base) return { ok: true, mode: "client" }

  const fd = new FormData()
  fd.append("offering_id", values.offeringId)
  fd.append("contact_id", values.contactId)
  fd.append("contact_display_name", values.contactDisplayName?.trim() ?? "")
  fd.append("profile_id", values.profileId)
  fd.append("investor_role", values.investorRole?.trim() ?? "")
  fd.append("status", values.status)
  fd.append("investor_class", values.investorClass)
  fd.append("doc_signed_date", values.docSignedDate)
  fd.append("commitment_amount", values.commitmentAmount)
  fd.append(
    "extra_contribution_amounts",
    JSON.stringify(values.extraContributionAmounts),
  )
  if (documentFile) fd.append("subscriptionDocument", documentFile)

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
    }
    if (!res.ok) {
      const msg =
        data?.message != null ? String(data.message) : res.statusText
      return { ok: false, message: msg || "Could not save investment" }
    }
    return { ok: true, mode: "api" }
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
): Promise<PostDealInvestmentResult> {
  const base = getApiV1Base()
  if (!base) return { ok: true, mode: "client" }

  const fd = new FormData()
  fd.append("offering_id", values.offeringId)
  fd.append("contact_id", values.contactId)
  fd.append("contact_display_name", values.contactDisplayName?.trim() ?? "")
  fd.append("profile_id", values.profileId)
  fd.append("investor_role", values.investorRole?.trim() ?? "")
  fd.append("status", values.status)
  fd.append("investor_class", values.investorClass)
  fd.append("doc_signed_date", values.docSignedDate)
  fd.append("commitment_amount", values.commitmentAmount)
  fd.append(
    "extra_contribution_amounts",
    JSON.stringify(values.extraContributionAmounts),
  )
  if (documentFile) fd.append("subscriptionDocument", documentFile)

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
    return { ok: true, mode: "api" }
  } catch {
    return { ok: false, message: "Network error" }
  }
}
