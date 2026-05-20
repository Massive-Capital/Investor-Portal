import {
  allowedStatusesForStage,
  canEditFundraisingStatus,
  CAPITAL_RAISING_FUNDRAISING_STATUSES,
  isStatusAllowedForStage,
} from "./deal-stage-status-map"
import { defaultStatusForStage } from "./default-stage-status"
import {
  normalizeDealStageCanonical,
  type DealStage,
} from "./deal-stage"
import {
  normalizeDealStatus,
  type DealStatus,
} from "./deal-status"

export type InvestmentMode =
  | "none"
  | "soft_commitment"
  | "hard_commitment"
  | "full_investment"
  | "waitlist"

export interface DealStatusRules {
  status: DealStatus
  canAccessOffering: boolean
  showInvestNowButton: boolean
  investmentMode: InvestmentMode
  showClosedBanner: boolean
  requireSponsorApproval: boolean
  allowDashboardVisibility: boolean
}

const RULES_BY_STATUS: Record<DealStatus, Omit<DealStatusRules, "status">> = {
  draft_hidden: {
    canAccessOffering: false,
    showInvestNowButton: false,
    investmentMode: "none",
    showClosedBanner: false,
    requireSponsorApproval: false,
    allowDashboardVisibility: false,
  },
  coming_soon: {
    canAccessOffering: true,
    showInvestNowButton: false,
    investmentMode: "none",
    showClosedBanner: false,
    requireSponsorApproval: false,
    allowDashboardVisibility: true,
  },
  open_soft_commitment: {
    canAccessOffering: true,
    showInvestNowButton: true,
    investmentMode: "soft_commitment",
    showClosedBanner: false,
    requireSponsorApproval: false,
    allowDashboardVisibility: true,
  },
  open_hard_commitment: {
    canAccessOffering: true,
    showInvestNowButton: true,
    investmentMode: "hard_commitment",
    showClosedBanner: false,
    requireSponsorApproval: false,
    allowDashboardVisibility: true,
  },
  open_investment: {
    canAccessOffering: true,
    showInvestNowButton: true,
    investmentMode: "full_investment",
    showClosedBanner: false,
    requireSponsorApproval: false,
    allowDashboardVisibility: true,
  },
  waitlist: {
    canAccessOffering: true,
    showInvestNowButton: false,
    investmentMode: "waitlist",
    showClosedBanner: false,
    requireSponsorApproval: true,
    allowDashboardVisibility: true,
  },
  closed: {
    canAccessOffering: true,
    showInvestNowButton: false,
    investmentMode: "none",
    showClosedBanner: true,
    requireSponsorApproval: false,
    allowDashboardVisibility: false,
  },
  past: {
    canAccessOffering: false,
    showInvestNowButton: false,
    investmentMode: "none",
    showClosedBanner: false,
    requireSponsorApproval: false,
    allowDashboardVisibility: false,
  },
}

export function getDealStatusRules(
  rawStatus: string | null | undefined,
): DealStatusRules {
  const status = normalizeDealStatus(rawStatus) ?? "draft_hidden"
  return { status, ...RULES_BY_STATUS[status] }
}

export function canInvestorAccessOffering(
  rawStatus: string | null | undefined,
): boolean {
  return getDealStatusRules(rawStatus).canAccessOffering
}

export function canInvestorInvest(
  rawStatus: string | null | undefined,
): boolean {
  const rules = getDealStatusRules(rawStatus)
  return (
    rules.showInvestNowButton &&
    rules.investmentMode !== "none" &&
    rules.investmentMode !== "waitlist"
  )
}

export function shouldShowInvestButton(
  rawStatus: string | null | undefined,
): boolean {
  return getDealStatusRules(rawStatus).showInvestNowButton
}

export function resolveOfferingStatusForStageChange(params: {
  nextStage: DealStage
  currentStatus: string | null | undefined
}): DealStatus {
  const current = normalizeDealStatus(params.currentStatus)
  if (current && isStatusAllowedForStage(params.nextStage, current)) {
    return current
  }
  return defaultStatusForStage(params.nextStage)
}

export function validateDealStageAndStatus(params: {
  dealStage: string | null | undefined
  offeringStatus: string | null | undefined
}): { ok: true } | { ok: false; message: string } {
  const stage = normalizeDealStageCanonical(params.dealStage)
  const status = normalizeDealStatus(params.offeringStatus)
  if (!stage) {
    return { ok: false, message: "Invalid deal stage." }
  }
  if (!status) {
    return { ok: false, message: "Invalid offering status." }
  }
  if (!isStatusAllowedForStage(stage, status)) {
    const allowed = allowedStatusesForStage(stage).join(", ")
    return {
      ok: false,
      message: `Status "${status}" is not allowed for stage "${stage}". Allowed: ${allowed}.`,
    }
  }
  return { ok: true }
}

function fundraisingStatusIndex(status: DealStatus): number {
  return CAPITAL_RAISING_FUNDRAISING_STATUSES.indexOf(status)
}

export function validateOfferingStatusChange(params: {
  dealStage: string | null | undefined
  previousOfferingStatus: string | null | undefined
  nextOfferingStatus: string | null | undefined
}): { ok: true } | { ok: false; message: string } {
  const combo = validateDealStageAndStatus({
    dealStage: params.dealStage,
    offeringStatus: params.nextOfferingStatus,
  })
  if (!combo.ok) return combo

  const prev = normalizeDealStatus(params.previousOfferingStatus)
  const next = normalizeDealStatus(params.nextOfferingStatus)
  if (!prev || !next) {
    return { ok: false, message: "Invalid offering status." }
  }
  if (prev === next) return { ok: true }

  if (!canEditFundraisingStatus(params.dealStage)) {
    return {
      ok: false,
      message:
        "Offering status can only be changed while the deal is in the Capital Raising stage.",
    }
  }

  const prevIdx = fundraisingStatusIndex(prev)
  const nextIdx = fundraisingStatusIndex(next)
  if (prevIdx < 0 || nextIdx < 0) {
    return { ok: false, message: "Invalid fundraising status." }
  }
  if (nextIdx < prevIdx) {
    return {
      ok: false,
      message:
        "Fundraising status cannot move backward. Use the next step in the capital raising workflow.",
    }
  }

  return { ok: true }
}

export function isInvestmentFlowOpeningTransition(
  fromStatus: string | null | undefined,
  toStatus: string | null | undefined,
): boolean {
  const from = normalizeDealStatus(fromStatus)
  const to = normalizeDealStatus(toStatus)
  if (!from || !to) return false
  return (
    (from === "open_soft_commitment" || from === "open_hard_commitment") &&
    to === "open_investment"
  )
}

export {
  normalizeDealStageCanonical,
  normalizeDealStatus,
  allowedStatusesForStage,
  defaultStatusForStage,
  canEditFundraisingStatus,
}
