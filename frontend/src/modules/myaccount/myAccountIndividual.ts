import { INVESTOR } from "../../common/auth/roleUtils"

/**
 * Self-serve signup with no company: role `investor`, no organization, no
 * company membership. Only these accounts choose Platform Contacts visibility.
 */
export function isStandaloneIndividualAccount(
  u: Record<string, unknown> | null,
): boolean {
  if (!u) return false
  if (typeof u.canSetVisibleToUsers === "boolean") return u.canSetVisibleToUsers
  const role = String(u.role ?? "").trim()
  const org = String(u.organization_id ?? u.organizationId ?? "").trim()
  const memberships = Array.isArray(u.memberships) ? u.memberships : []
  return role === INVESTOR && !org && memberships.length === 0
}

/** `/account` landing tab: individuals start on Personal details (visibility question). */
export function myAccountDefaultTabPath(
  u: Record<string, unknown> | null,
): "/account/personal" | "/account/company" {
  return isStandaloneIndividualAccount(u)
    ? "/account/personal"
    : "/account/company"
}
