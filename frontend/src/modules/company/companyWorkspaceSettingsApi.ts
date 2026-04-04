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

export async function putWorkspaceTabSettings(
  companyId: string,
  tabKey: WorkspaceTabKey,
  payload: Record<string, unknown>,
): Promise<boolean> {
  const base = getApiV1Base()
  if (!base) return false
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
    return res.ok
  } catch {
    return false
  }
}
