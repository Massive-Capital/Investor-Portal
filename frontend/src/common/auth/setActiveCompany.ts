import {
  SESSION_WORKSPACE_COMPANY_ID_KEY,
} from "./sessionKeys"
import { getSessionAccessibleCompanies } from "./sessionMemberships"

export const PORTAL_ACTIVE_COMPANY_CHANGED_EVENT = "portal-active-company-changed"

/** Persist active company for multi-org users (workspace key only). */
export function setActiveCompanyId(companyId: string, _companyName?: string): void {
  const id = companyId.trim().toLowerCase()
  if (!id) return
  const options = getSessionAccessibleCompanies()
  if (!options.some((c) => c.companyId === id)) return

  sessionStorage.setItem(SESSION_WORKSPACE_COMPANY_ID_KEY, id)

  window.dispatchEvent(new CustomEvent(PORTAL_ACTIVE_COMPANY_CHANGED_EVENT))
}

/** After sign-in: default workspace to primary org when user has multiple companies. */
export function ensureActiveCompanyInitialized(): void {
  const companies = getSessionAccessibleCompanies()
  if (companies.length === 0) return
  const existing = sessionStorage
    .getItem(SESSION_WORKSPACE_COMPANY_ID_KEY)
    ?.trim()
    .toLowerCase()
  if (existing && companies.some((c) => c.companyId === existing)) return
  const primary = companies[0]
  if (primary) setActiveCompanyId(primary.companyId, primary.companyName)
}
