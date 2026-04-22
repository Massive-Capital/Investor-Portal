import { SESSION_BEARER_KEY } from "../../common/auth/sessionKeys"
import { getApiV1Base } from "../../common/utils/apiBaseUrl"

export type WorkspaceTabKey = "settings" | "email" | "contact" | "offerings"

function authHeaders(): Record<string, string> {
  const token = sessionStorage.getItem(SESSION_BEARER_KEY)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function fetchWorkspaceTabSettings(
  companyId: string,
  tabKey: WorkspaceTabKey,
): Promise<{ ok: boolean; payload: Record<string, unknown> }> {
  const base = getApiV1Base()
  if (!base) return { ok: false, payload: {} }
  try {
    const res = await fetch(
      `${base}/companies/${encodeURIComponent(companyId)}/workspace-settings/${tabKey}`,
      { headers: authHeaders(), credentials: "include" },
    )
    const data = (await res.json().catch(() => ({}))) as {
      payload?: unknown
    }
    if (!res.ok) return { ok: false, payload: {} }
    const p = data.payload
    if (p && typeof p === "object" && !Array.isArray(p)) {
      return { ok: true, payload: p as Record<string, unknown> }
    }
    return { ok: true, payload: {} }
  } catch {
    return { ok: false, payload: {} }
  }
}

export type PutWorkspaceResult =
  | { ok: true }
  | { ok: false; message: string; status: number }

export async function putWorkspaceTabSettings(
  companyId: string,
  tabKey: WorkspaceTabKey,
  payload: Record<string, unknown>,
): Promise<PutWorkspaceResult> {
  const base = getApiV1Base()
  if (!base) {
    return { ok: false, message: "API is not configured (VITE_BASE_URL).", status: 0 }
  }
  try {
    const res = await fetch(
      `${base}/companies/${encodeURIComponent(companyId)}/workspace-settings/${tabKey}`,
      {
        method: "PUT",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ payload }),
      },
    )
    if (res.ok) return { ok: true }
    const data = (await res.json().catch(() => ({}))) as { message?: string }
    const msg =
      typeof data.message === "string" && data.message.trim()
        ? data.message.trim()
        : `Save failed (HTTP ${res.status}).`
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console -- dev-only save diagnostics
      console.warn("putWorkspaceTabSettings", res.status, msg)
    }
    return { ok: false, message: msg, status: res.status }
  } catch (e) {
    const message =
      e instanceof Error && e.message ? e.message : "Network error while saving."
    return { ok: false, message, status: 0 }
  }
}

export type CompanyBrandingAsset = "logo" | "background" | "logoIcon"

type PostBrandingOk = { ok: true; url: string }
type PostBrandingErr = { ok: false; message: string }

/** Upload an image; response URL is root-relative (`/uploads/...`) for workspace settings. */
export async function postCompanySettingsBranding(
  companyId: string,
  assetType: CompanyBrandingAsset,
  file: File,
): Promise<PostBrandingOk | PostBrandingErr> {
  const base = getApiV1Base()
  if (!base) {
    return { ok: false, message: "API is not configured (VITE_BASE_URL)." }
  }
  const form = new FormData()
  form.append("file", file)
  try {
    const res = await fetch(
      `${base}/companies/${encodeURIComponent(companyId)}/settings/branding/${assetType}`,
      {
        method: "POST",
        headers: authHeaders(),
        body: form,
        credentials: "include",
      },
    )
    const data = (await res.json().catch(() => ({}))) as { url?: string; message?: string }
    if (!res.ok) {
      const msg =
        typeof data.message === "string" && data.message.trim()
          ? data.message.trim()
          : `Upload failed (HTTP ${res.status}).`
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console -- dev-only upload diagnostics
        console.warn("postCompanySettingsBranding", res.status, msg)
      }
      return { ok: false, message: msg }
    }
    const u = data.url
    if (typeof u === "string" && u.trim()) return { ok: true, url: u.trim() }
    return { ok: false, message: "Server did not return an image URL." }
  } catch (e) {
    const message = e instanceof Error && e.message ? e.message : "Network error while uploading."
    return { ok: false, message }
  }
}
