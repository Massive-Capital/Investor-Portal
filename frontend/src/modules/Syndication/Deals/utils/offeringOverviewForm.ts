/** Stored API values for PATCH /deals/:id/offering-overview (`offering_status` column). */

import {
  allowedStatusesForStage,
  canEditFundraisingStatus,
  CAPITAL_RAISING_FUNDRAISING_STATUSES,
  defaultStatusForStage,
  normalizeDealStageCanonical,
  normalizeDealStatus,
  type DealStatus,
} from "../constants/deal-lifecycle"

export const OFFERING_STATUS_OPTIONS = [
  {
    value: "draft_hidden",
    label: "Draft (hidden to investors)",
  },
  {
    value: "coming_soon",
    label: "Coming soon (no new investments allowed)",
  },
  {
    value: "open_soft_commitment",
    label: "Open to soft commitment",
  },
  {
    value: "open_hard_commitment",
    label: "Open to hard commitment",
  },
  {
    value: "open_investment",
    label: "Open to investment",
  },
  {
    value: "waitlist",
    label: "Waitlist (new investments require approval)",
  },
  {
    value: "closed",
    label: "Closed (no new investments)",
  },
  {
    value: "past",
    label: "Past (fully hidden)",
  },
] as const

export type OfferingStatusValue = (typeof OFFERING_STATUS_OPTIONS)[number]["value"]

export type OfferingStatusSelectOption = {
  value: OfferingStatusValue | string
  label: string
}

export const DEFAULT_OFFERING_STATUS: OfferingStatusValue = "draft_hidden"

export const OFFERING_VISIBILITY_OPTIONS = [
  {
    value: "show_on_dashboard",
    label: "Show on dashboard",
  },
  {
    value: "show_on_deal_investors_dashboard",
    label: "Show on deal investors' dashboard",
    /** Shown below the control when this value is selected (matches design tooltip copy). */
    optionHint:
      "Offering is only visible to existing investors on this deal.",
  },
  {
    value: "only_visible_with_link",
    label: "Only visible with link",
  },
] as const

export type OfferingVisibilityValue =
  (typeof OFFERING_VISIBILITY_OPTIONS)[number]["value"]

export const DEFAULT_OFFERING_VISIBILITY: OfferingVisibilityValue =
  "show_on_dashboard"

/** Status choices allowed for the deal's current stage (and forward steps when raising). */
export function offeringStatusOptionsForDealStage(
  dealStage: string | null | undefined,
  currentOfferingStatus?: string | null,
): OfferingStatusSelectOption[] {
  const stage = normalizeDealStageCanonical(dealStage)
  if (!stage) return [...OFFERING_STATUS_OPTIONS]
  const allowed = new Set<DealStatus>(allowedStatusesForStage(stage))
  let statuses = OFFERING_STATUS_OPTIONS.filter((o) =>
    allowed.has(o.value as DealStatus),
  )
  if (stage === "capital_raising") {
    const cur = normalizeDealStatus(currentOfferingStatus)
    if (cur) {
      const minIdx = CAPITAL_RAISING_FUNDRAISING_STATUSES.indexOf(cur)
      if (minIdx >= 0) {
        const forward = new Set(
          CAPITAL_RAISING_FUNDRAISING_STATUSES.slice(minIdx),
        )
        statuses = statuses.filter((o) =>
          forward.has(o.value as DealStatus),
        )
      }
    }
  }
  return statuses
}

/** True when the overview status dropdown should be editable (capital raising only). */
export function isOfferingStatusFieldEditable(
  dealStage: string | null | undefined,
): boolean {
  return canEditFundraisingStatus(dealStage)
}

/** Human-readable label for overview display; empty API value shows "—". */
export function offeringStatusLabelFromRaw(
  raw: string | null | undefined,
): string {
  const v = String(raw ?? "").trim()
  if (!v) return "—"
  const opt = OFFERING_STATUS_OPTIONS.find((o) => o.value === v)
  return opt?.label ?? v
}

/** Raw `offering_status` from the deal — no stage default injection. */
export function offeringStatusFromApi(
  raw: string | null | undefined,
): string {
  return String(raw ?? "").trim()
}

/** Human-readable label for overview visibility; empty API value shows "—". */
export function offeringVisibilityLabelFromRaw(
  raw: string | null | undefined,
): string {
  const mapped = mapLegacyOfferingVisibility(String(raw ?? ""))
  if (!mapped.trim()) return "—"
  const opt = OFFERING_VISIBILITY_OPTIONS.find((o) => o.value === mapped)
  if (opt) return opt.label
  return mapped
}

/** Select options for overview; keeps the stored value visible even when stage-locked. */
export function offeringStatusOptionsForOverview(
  dealStage: string | null | undefined,
  currentOfferingStatus?: string | null,
): OfferingStatusSelectOption[] {
  const cur = offeringStatusFromApi(currentOfferingStatus)
  const opts = offeringStatusOptionsForDealStage(dealStage, cur || null)
  if (!cur) return opts
  if (opts.some((o) => o.value === cur)) return opts
  return [{ value: cur, label: offeringStatusLabelFromRaw(cur) }, ...opts]
}

/** Coerce to a valid status for the stage, or the stage default. */
export function normalizeOfferingStatusForStage(
  dealStage: string | null | undefined,
  raw: string | undefined,
): OfferingStatusValue {
  const stage = normalizeDealStageCanonical(dealStage)
  const v = String(raw ?? "").trim()
  if (stage) {
    const allowed = allowedStatusesForStage(stage)
    if (allowed.includes(v as DealStatus)) return v as OfferingStatusValue
    return defaultStatusForStage(stage) as OfferingStatusValue
  }
  const ok = OFFERING_STATUS_OPTIONS.some((o) => o.value === v)
  return ok ? (v as OfferingStatusValue) : DEFAULT_OFFERING_STATUS
}

/** Map pre–mockup API/DB values to current visibility codes. */
export function mapLegacyOfferingVisibility(raw: string): string {
  const v = String(raw ?? "").trim()
  switch (v) {
    case "eligible_investors":
      return "show_on_dashboard"
    case "link_only":
    case "hidden":
      return "only_visible_with_link"
    default:
      return v
  }
}

/**
 * True when Offering Details → Overview visibility is “Only visible with link”
 * (LPs reach the offering via the shared preview URL).
 */
export function dealHasOfferingShareLink(
  detail: { offeringVisibility?: string | null } | null | undefined,
): boolean {
  if (!detail) return false
  return (
    mapLegacyOfferingVisibility(String(detail.offeringVisibility ?? "")) ===
    "only_visible_with_link"
  )
}
