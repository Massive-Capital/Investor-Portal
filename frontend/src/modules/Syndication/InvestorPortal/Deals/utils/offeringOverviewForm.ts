/** Stored API values for PATCH /deals/:id/offering-overview */

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
] as const

export type OfferingStatusValue = (typeof OFFERING_STATUS_OPTIONS)[number]["value"]

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

export const DEFAULT_OFFERING_STATUS: OfferingStatusValue = "draft_hidden"

export const DEFAULT_OFFERING_VISIBILITY: OfferingVisibilityValue =
  "show_on_dashboard"

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
