import { SESSION_BEARER_KEY } from "../../../../common/auth/sessionKeys"
import { getApiV1Base } from "../../../../common/utils/apiBaseUrl"
import type { DealInvestorsPayload } from "../types/deal-investors.types"
import { fetchDealInvestors } from "./dealsApi"

function authHeaders(): HeadersInit {
  const token =
    typeof sessionStorage !== "undefined"
      ? sessionStorage.getItem(SESSION_BEARER_KEY)
      : null
  const h: HeadersInit = {}
  if (token) h.Authorization = `Bearer ${token}`
  return h
}

export type PatchMyLpDealInvestNowCommitmentResult =
  | { ok: true; investorsPayload: DealInvestorsPayload }
  | { ok: false; message: string }

export type PostMyLpDealInvestNowEsignSendResult =
  | {
      ok: true
      alreadySent: boolean
      alreadyCompleted: boolean
      signatureRequestId: string | null
      investmentId: string | null
      documentNames: string[]
    }
  | { ok: false; message: string }

/**
 * PATCH `/deals/:dealId/lp-investors/my-invest-now-commitment` — copy_code behavior:
 * sets committed amount (full value), optional status + doc_signed_date; raising-capital guard on server.
 */
export async function patchMyLpDealInvestNowCommitment(
  dealId: string,
  committedAmount: string,
  body: {
    profileId: string
    status: string
    docSignedDate: string
    /** When true, the server updates `user_investor_profile_id` (or clears if empty). */
    includeUserInvestorProfileInBody: boolean
    userInvestorProfileId: string
    questionnaireAnswers?: Record<string, string>
    w9Form?: Record<string, string>
  },
): Promise<PatchMyLpDealInvestNowCommitmentResult> {
  const base = getApiV1Base()
  if (!base) return { ok: false, message: "API base URL is not configured." }
  const did = dealId.trim()
  if (!did) return { ok: false, message: "Missing deal id." }
  try {
    const bodyObj: Record<string, string | Record<string, string>> = {
      committed_amount: committedAmount,
      profile_id: body.profileId.trim(),
      status: body.status ?? "",
      doc_signed_date: body.docSignedDate ?? "",
    }
    if (body.includeUserInvestorProfileInBody) {
      bodyObj.user_investor_profile_id = (body.userInvestorProfileId ?? "").trim()
    }
    if (body.questionnaireAnswers && Object.keys(body.questionnaireAnswers).length > 0) {
      bodyObj.questionnaire_answers = body.questionnaireAnswers
    }
    if (body.w9Form && Object.keys(body.w9Form).length > 0) {
      bodyObj.w9_form = body.w9Form
    }
    const res = await fetch(
      `${base}/deals/${encodeURIComponent(did)}/lp-investors/my-invest-now-commitment`,
      {
        method: "PATCH",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(bodyObj),
      },
    )
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) {
      const msg =
        typeof data.message === "string"
          ? data.message
          : `Could not save commitment (${res.status})`
      return { ok: false, message: msg }
    }
    const investorsPayload = await fetchDealInvestors(did, {
      lpInvestorsOnly: true,
    })
    return {
      ok: true,
      investorsPayload,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error"
    return { ok: false, message: msg }
  }
}

/**
 * POST `/deals/:dealId/lp-investors/my-invest-now-esign-send` — sends profile-matched
 * eSign templates to the signed-in investor (Invest Now step 4).
 */
export async function postMyLpDealInvestNowEsignSend(
  dealId: string,
  body: {
    profileId: string
    memberDisplayName?: string
    questionnaireAnswers?: Record<string, string>
    w9Form?: Record<string, string>
  },
): Promise<PostMyLpDealInvestNowEsignSendResult> {
  const base = getApiV1Base()
  if (!base) return { ok: false, message: "API base URL is not configured." }
  const did = dealId.trim()
  if (!did) return { ok: false, message: "Missing deal id." }
  try {
    const res = await fetch(
      `${base}/deals/${encodeURIComponent(did)}/lp-investors/my-invest-now-esign-send`,
      {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          profile_id: body.profileId.trim(),
          member_display_name: body.memberDisplayName?.trim() ?? "",
          ...(body.questionnaireAnswers &&
          Object.keys(body.questionnaireAnswers).length > 0
            ? { questionnaire_answers: body.questionnaireAnswers }
            : {}),
          ...(body.w9Form && Object.keys(body.w9Form).length > 0
            ? { w9_form: body.w9Form }
            : {}),
        }),
      },
    )
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) {
      const msg =
        typeof data.message === "string"
          ? data.message
          : `Could not send eSign (${res.status})`
      return { ok: false, message: msg }
    }
    const names = data.documentNames
    return {
      ok: true,
      alreadySent: Boolean(data.alreadySent),
      alreadyCompleted: Boolean(data.alreadyCompleted),
      signatureRequestId:
        typeof data.signatureRequestId === "string"
          ? data.signatureRequestId
          : null,
      investmentId:
        typeof data.investmentId === "string" ? data.investmentId : null,
      documentNames: Array.isArray(names)
        ? names.map((n) => String(n))
        : [],
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error"
    return { ok: false, message: msg }
  }
}
