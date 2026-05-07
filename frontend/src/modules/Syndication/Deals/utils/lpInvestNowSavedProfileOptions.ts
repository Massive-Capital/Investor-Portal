/** Shown in Invest now when a commitment type is chosen but the profile book has no row of that type. */
export const NO_SAVED_PROFILES_FOR_INVESTOR_TYPE_MSG =
  "No saved profiles for this investor type. Add a profile in Investing → Profiles, then return here to continue."

/**
 * Minimal row shape for filtering; full {@link import("@/modules/Investing/pages/profiles/investor-profiles.types").InvestorProfileListRow} is compatible.
 */
export type LpBookProfileFilterRow = {
  id: string
  profileName: string
  profileType: string
  archived?: boolean
}

/**
 * Maps the commitment "investor profile" enum (deal investment) to saved book `profileType`
 * values (Investing → Profiles).
 */
function bookTypeMatchesProfileKind(
  bookProfileType: string,
  commitmentProfileKind: string,
): boolean {
  const t = (bookProfileType ?? "").trim()
  const k = (commitmentProfileKind ?? "").trim()
  if (k === "individual") return t === "Individual"
  if (k === "joint_tenancy") return t === "Joint tenancy"
  if (k === "custodian_ira_401k" || k === "llc_corp_trust_etc") return t === "Entity"
  return false
}

/** Non-archived saved profiles that match the selected commitment profile type. */
export function filterBookProfilesByCommitmentKind(
  profiles: readonly LpBookProfileFilterRow[] | undefined,
  commitmentProfileKind: string,
): LpBookProfileFilterRow[] {
  const k = String(commitmentProfileKind ?? "").trim()
  if (!k) return []
  const list = Array.isArray(profiles) ? profiles : []
  return list.filter(
    (p) =>
      !p.archived && bookTypeMatchesProfileKind(p.profileType ?? "", k),
  )
}
