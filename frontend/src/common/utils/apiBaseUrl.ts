/**
 * Builds the `/api/v1` root from `VITE_BASE_URL`.
 * Accepts either `http://host:port` or `http://host:port/api/v1` so paths are not doubled.
 */
export function getApiV1Base(): string {
  const raw = (import.meta.env.VITE_BASE_URL ?? "").toString().trim();
  if (!raw) return "";
  const base = raw.replace(/\/$/, "");
  if (base.endsWith("/api/v1")) return base;
  return `${base}/api/v1`;
}

/** Origin for static assets (e.g. `/uploads/...`) when API base is `.../api/v1`. */
export function getBackendOrigin(): string {
  const v1 = getApiV1Base();
  if (!v1) return "";
  if (v1.endsWith("/api/v1")) return v1.slice(0, -"/api/v1".length);
  return v1.replace(/\/api\/v1\/?$/, "");
}

/**
 * First image URL from API `assetImagePath` (semicolon-separated paths under `uploads/`).
 */
export function assetImagePathToUrl(assetImagePath: string | null | undefined): string {
  if (assetImagePath == null || !String(assetImagePath).trim()) return ""
  const first = String(assetImagePath).split(";")[0]?.trim()
  if (!first) return ""
  const origin = getBackendOrigin()
  if (!origin) return ""
  const rel = first.replace(/^\/+/, "")
  return `${origin}/uploads/${rel}`
}
