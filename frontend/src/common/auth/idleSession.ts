/** Inactivity limit before automatic sign-out (matches access token lifetime). */
export const IDLE_LOGOUT_MS = 15 * 60 * 1000;

export const SESSION_LAST_ACTIVITY_KEY = "lastActivityAt";

/** Set before redirecting to sign-in after idle logout; triggers session timeout toast. */
export const SESSION_IDLE_TIMEOUT_NOTICE_KEY = "idleSessionTimeoutNotice";

export function touchSessionActivity(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(SESSION_LAST_ACTIVITY_KEY, String(Date.now()));
}

export function getLastSessionActivityMs(): number | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(SESSION_LAST_ACTIVITY_KEY);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function clearLastSessionActivity(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(SESSION_LAST_ACTIVITY_KEY);
}

export function msUntilIdleLogout(now = Date.now()): number {
  const last = getLastSessionActivityMs();
  if (last == null) {
    touchSessionActivity();
    return IDLE_LOGOUT_MS;
  }
  const remaining = IDLE_LOGOUT_MS - (now - last);
  return remaining > 0 ? remaining : 0;
}
