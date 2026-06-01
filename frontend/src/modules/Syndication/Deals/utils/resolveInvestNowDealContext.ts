import { SESSION_USER_DETAILS_KEY } from "@/common/auth/sessionKeys"
import {
  investorProfileLabel,
  isLeadSponsorRole,
} from "../constants/investor-profile"
import type { DealDetailApi } from "../api/dealsApi"
import type { DealInvestorClass } from "../types/deal-investor-class.types"
import type { DealInvestorRow } from "../types/deal-investors.types"
import { isLpInvestorClass } from "./investorClassOverviewFields"
import type { LpInvestNowPrefill } from "./prefillLpInvestNowFields"

function readSessionCompanyName(): string {
  if (typeof sessionStorage === "undefined") return ""
  try {
    const raw = sessionStorage.getItem(SESSION_USER_DETAILS_KEY)
    if (!raw?.trim()) return ""
    const parsed = JSON.parse(raw) as unknown
    const o = Array.isArray(parsed)
      ? (parsed[0] as Record<string, unknown> | undefined)
      : parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null
    if (!o) return ""
    return String(o.companyName ?? o.company_name ?? "").trim()
  } catch {
    return ""
  }
}

/** Primary sponsor label shown read-only on Invest now step 1. */
export function resolveInvestNowSponsorLabel(
  deal: Pick<DealDetailApi, "owningEntityName"> | null | undefined,
  members: DealInvestorRow[],
): string {
  const lead = members.find(
    (m) => isLeadSponsorRole(m.investorRole) && m.displayName?.trim(),
  )
  if (lead?.displayName?.trim()) return lead.displayName.trim()
  const owning = deal?.owningEntityName?.trim()
  if (owning) return owning
  return readSessionCompanyName() || "—"
}

/** Investor class name prefilled for this deal (LP class when available). */
export function resolveInvestNowInvestmentClassLabel(
  classes: DealInvestorClass[],
  _prefill: LpInvestNowPrefill | null,
  viewerInvestorClass?: string,
): string {
  const fromViewer = viewerInvestorClass?.trim()
  if (fromViewer) return fromViewer
  const lpClass = classes.find((c) => isLpInvestorClass(c))
  if (lpClass?.name?.trim()) return lpClass.name.trim()
  if (classes[0]?.name?.trim()) return classes[0].name.trim()
  return "—"
}

function custodianIraFromProfileWizardState(
  profileWizardState: unknown,
): boolean {
  if (profileWizardState == null) return false
  let parsed: Record<string, unknown> | null = null
  if (typeof profileWizardState === "string") {
    try {
      const raw = JSON.parse(profileWizardState) as unknown
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        parsed = raw as Record<string, unknown>
      }
    } catch {
      return false
    }
  } else if (
    typeof profileWizardState === "object" &&
    !Array.isArray(profileWizardState)
  ) {
    parsed = profileWizardState as Record<string, unknown>
  }
  if (!parsed) return false
  const v = String(
    parsed.custodianIra ?? parsed.custodian_ira ?? "",
  )
    .trim()
    .toLowerCase()
  return v === "yes" || v === "true" || v === "1"
}

/**
 * Maps saved book profile type (+ wizard snapshot) to commitment `profile_id`
 * used for eSign template category and questionnaire visibility.
 */
export function commitmentProfileIdFromBookProfileType(
  profileType: string,
  profileWizardState?: unknown,
): string {
  const raw = profileType.trim()
  const t = raw.toLowerCase()
  if (!t || t === "—") return ""
  if (t === "individual") return "individual"
  if (t === "joint tenancy" || t === "joint_tenancy") return "joint_tenancy"
  if (
    raw === "__entity_custodian_ira_401k__" ||
    (t.includes("custodian") && (t.includes("ira") || t.includes("401")))
  ) {
    return "custodian_ira_401k"
  }
  if (
    t === "entity" ||
    raw === "__entity_llc_corp_trust_etc__" ||
    t.includes("llc") ||
    t.includes("corp") ||
    t.includes("trust")
  ) {
    if (custodianIraFromProfileWizardState(profileWizardState)) {
      return "custodian_ira_401k"
    }
    return "llc_corp_trust_etc"
  }
  return ""
}

/** Resolve commitment profile id from a profile-book list row. */
export function commitmentProfileIdFromBookProfile(profile: {
  profileType: string
  profileWizardState?: unknown
}): string {
  return commitmentProfileIdFromBookProfileType(
    profile.profileType,
    profile.profileWizardState,
  )
}

/** Human-readable profile type for tables and Invest Now (uses wizard state for Entity rows). */
export function bookProfileTypeDisplayLabel(profile: {
  profileType: string
  profileWizardState?: unknown
}): string {
  const commitmentId = commitmentProfileIdFromBookProfile(profile)
  if (commitmentId) return investorProfileLabel(commitmentId)
  return profile.profileType?.trim() || "—"
}
