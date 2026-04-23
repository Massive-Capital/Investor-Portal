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

const MAX_MULTIPART_BRANDING_NAME_LEN = 180

/**
 * Multipart `filename` must be safe 7-bit for Chrome/Edge+Multer in some pickers/Windows locales;
 * long or non-ASCII names (e.g. CJK) can end up with empty/garbled parts in Chromium.
 */
function toSafeBrandingFileNameForMultipart(
  fromPicker: string,
  fallback: string,
): string {
  const base = (fromPicker?.trim() || fallback).trim() || fallback
  const ascii = base
    .replace(/[\u0000-\u001F\u007F]/g, "_")
    .replace(/[^ -~]+/g, "_")
    .replace(/[<>:"/\\|?*]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_\s]+|[_\s]+$/g, "")
  const trimmed = (ascii || fallback).slice(0, MAX_MULTIPART_BRANDING_NAME_LEN)
  return trimmed || fallback
}

function defaultBrandingUploadFilename(file: File): string {
  const t = (file.type ?? "").toLowerCase()
  if (file.name?.trim()) {
    return toSafeBrandingFileNameForMultipart(file.name, "upload.png")
  }
  if (t.includes("jpeg") || t === "image/jpg")
    return toSafeBrandingFileNameForMultipart("", "upload.jpg")
  if (t.includes("png")) return toSafeBrandingFileNameForMultipart("", "upload.png")
  if (t.includes("webp")) return toSafeBrandingFileNameForMultipart("", "upload.webp")
  if (t.includes("svg")) return toSafeBrandingFileNameForMultipart("", "upload.svg")
  if (t.includes("gif")) return toSafeBrandingFileNameForMultipart("", "upload.gif")
  if (
    t.includes("icon") ||
    t === "image/vnd.microsoft.icon" ||
    t === "image/x-icon"
  ) {
    return toSafeBrandingFileNameForMultipart("", "upload.ico")
  }
  return toSafeBrandingFileNameForMultipart("", "upload.png")
}

/**
 * Edge/Chrome and some pickers can supply a `File` with an empty `name` / empty `type` (Multer
 * + sniff on the server still handle bytes). A stable 7-bit name + `File` wrapper makes FormData
 * and multipart `filename=` consistent with Firefox. Use two-arg `form.append` so the
 * part filename comes from `File#name` only.
 */
function normalizeBrandingFileForUpload(file: File): File {
  const name = defaultBrandingUploadFilename(file)
  const type =
    file.type && file.type.length > 0
      ? file.type
      : "application/octet-stream"
  try {
    if (typeof File === "function") {
      return new File([file], name, { type, lastModified: file.lastModified })
    }
  } catch {
    /* continue */
  }
  return file
}

type PostBrandingOk = {
  ok: true
  url: string
  /** Set when the asset is on Cloudinary; `null` when stored under `/uploads/...`. */
  publicId: string | null
}
type PostBrandingErr = { ok: false; message: string }

/** Upload an image; response `url` is a full `https` URL (Cloudinary) or root-relative `/uploads/...` when the API is not using Cloudinary. */
export async function postCompanySettingsBranding(
  companyId: string,
  assetType: CompanyBrandingAsset,
  file: File,
): Promise<PostBrandingOk | PostBrandingErr> {
  const base = getApiV1Base()
  if (!base) {
    return { ok: false, message: "API is not configured (VITE_BASE_URL)." }
  }
  if (!file || (typeof file.size === "number" && file.size <= 0)) {
    return { ok: false, message: "Choose a non-empty image file." }
  }
  const toSend = normalizeBrandingFileForUpload(file)
  const form = new FormData()
  form.append("file", toSend)
  try {
    const res = await fetch(
      `${base}/companies/${encodeURIComponent(companyId)}/settings/branding/${assetType}`,
      {
        method: "POST",
        headers: {
          ...authHeaders(),
          Accept: "application/json",
        },
        body: form,
        credentials: "include",
        mode: "cors",
        cache: "no-store",
      },
    )
    const data = (await res.json().catch(() => ({}))) as {
      url?: string
      publicId?: string | null
      message?: string
    }
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
    if (typeof u === "string" && u.trim()) {
      const publicId =
        data.publicId === null
          ? null
          : typeof data.publicId === "string" && data.publicId.trim()
            ? data.publicId.trim()
            : null
      return { ok: true, url: u.trim(), publicId }
    }
    return { ok: false, message: "Server did not return an image URL." }
  } catch (e) {
    const message = e instanceof Error && e.message ? e.message : "Network error while uploading."
    return { ok: false, message }
  }
}
