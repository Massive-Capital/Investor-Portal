import { SESSION_BEARER_KEY } from "../../../../../common/auth/sessionKeys"
import { getApiV1Base } from "../../../../../common/utils/apiBaseUrl"
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
  },
): Promise<PatchMyLpDealInvestNowCommitmentResult> {
  const base = getApiV1Base()
  if (!base) return { ok: false, message: "API base URL is not configured." }
  const did = dealId.trim()
  if (!did) return { ok: false, message: "Missing deal id." }
  try {
    const res = await fetch(
      `${base}/deals/${encodeURIComponent(did)}/lp-investors/my-invest-now-commitment`,
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
          status: body.status ?? "",
          doc_signed_date: body.docSignedDate ?? "",
        }),
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
