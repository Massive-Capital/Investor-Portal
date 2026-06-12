import { getStoredAccessToken } from "./authTokensApi"
import { getSessionOrganizationCompanyId } from "./sessionOrganization"

/** Sent on API calls so the backend scopes data to the selected company workspace. */
export const ACTIVE_ORGANIZATION_HEADER = "X-Active-Organization-Id"

export function portalAuthHeaders(): HeadersInit {
  const h: Record<string, string> = {}
  const token = getStoredAccessToken()
  if (token) h.Authorization = `Bearer ${token}`

  const activeOrg = getSessionOrganizationCompanyId()
  if (activeOrg) h[ACTIVE_ORGANIZATION_HEADER] = activeOrg

  return h
}

export function organizationIdQueryParam(): string | undefined {
  const id = getSessionOrganizationCompanyId()
  return id ?? undefined
}
