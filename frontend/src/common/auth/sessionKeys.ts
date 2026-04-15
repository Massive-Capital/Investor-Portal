/** sessionStorage key for JWT from sign-in */
export const SESSION_BEARER_KEY = "bearerToken";

/** sessionStorage key for JSON stringified `userDetails` array from sign-in API */
export const SESSION_USER_DETAILS_KEY = "userDetails";

/** `investing` | `syndicating` — survives refresh; cleared on logout. */
export const SESSION_PORTAL_MODE_KEY = "portalMode";

/**
 * Platform admins often have no `organizationId` on session user. Workspace settings still need a
 * `companies.id` for GET/PUT — this stores the last resolved target (no UI picker).
 */
export const SESSION_WORKSPACE_COMPANY_ID_KEY = "workspaceCompanyId";

/** Clears sign-in token and cached user details. Call from client-only code (e.g. logout). */
export function clearPortalSessionStorage(): void {
  sessionStorage.removeItem(SESSION_BEARER_KEY)
  sessionStorage.removeItem(SESSION_USER_DETAILS_KEY)
  sessionStorage.removeItem(SESSION_WORKSPACE_COMPANY_ID_KEY)
  sessionStorage.removeItem(SESSION_PORTAL_MODE_KEY)
}
