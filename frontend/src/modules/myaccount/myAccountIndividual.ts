import { INVESTOR } from "../../common/auth/roleUtils"

/**
 * Self-serve signup with no company: role `investor`, no organization, no
 * company membership.
 */
export function isStandaloneIndividualAccount(
  u: Record<string, unknown> | null,
): boolean {
  if (!u) return false
  const role = String(u.role ?? "").trim()
  const org = String(u.organization_id ?? u.organizationId ?? "").trim()
  const memberships = Array.isArray(u.memberships) ? u.memberships : []
  return role === INVESTOR && !org && memberships.length === 0
}

/**
 * Shows the Platform Contacts visibility question on Personal details. Every
 * signed-in account gets it, including contacts who became portal users and
 * company members.
 */
export function canSetPlatformVisibility(
  u: Record<string, unknown> | null,
): boolean {
  return Boolean(u)
}

/** `/account` landing tab: individuals start on Personal details (visibility question). */
export function myAccountDefaultTabPath(
  u: Record<string, unknown> | null,
): "/account/personal" | "/account/company" {
  return isStandaloneIndividualAccount(u)
    ? "/account/personal"
    : "/account/company"
}
