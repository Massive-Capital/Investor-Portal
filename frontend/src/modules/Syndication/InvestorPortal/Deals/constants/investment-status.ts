/**
 * Investment workflow statuses (Add Investment + investor Status column).
 * Includes deal-style offering states and post-signature / terminal workflow states.
 */
export const INVESTMENT_STATUS_SELECT_OPTIONS = [
  { value: "", label: "Select status" },
  {
    value: "Draft (hidden to investors)",
    label: "Draft (hidden to investors)",
  },
  {
    value: "Coming soon (no new investments allowed)",
    label: "Coming soon (no new investments allowed)",
  },
  { value: "Open to soft commitment", label: "Open to soft commitment" },
  { value: "Open to hard commitment", label: "Open to hard commitment" },
  { value: "Open to investment", label: "Open to investment" },
  {
    value: "Waitlist (new investments require approval)",
    label: "Waitlist (new investments require approval)",
  },
  {
    value: "Closed (no new investments allowed)",
    label: "Closed (no new investments allowed)",
  },
  { value: "Past (hidden)", label: "Past (hidden)" },
  { value: "Soft committed", label: "Soft committed" },
  { value: "Investment started", label: "Investment started" },
  {
    value: "Document signing started",
    label: "Document signing started",
  },
  { value: "Signed", label: "Signed" },
  { value: "Counter-signed", label: "Counter-signed" },
  {
    value: "Funding instructions sent",
    label: "Funding instructions sent",
  },
  {
    value: "Funds fully received (complete)",
    label: "Funds fully received (complete)",
  },
  {
    value: "Inactive (bought out, assigned, or sold)",
    label: "Inactive (bought out, assigned, or sold)",
  },
  {
    value: "Canceled (did not complete)",
    label: "Canceled (did not complete)",
  },
] as const

export function investmentStatusLabel(value: string): string {
  if (!value?.trim()) return "—"
  const row = INVESTMENT_STATUS_SELECT_OPTIONS.find((o) => o.value === value)
  return row?.label ?? value
}
