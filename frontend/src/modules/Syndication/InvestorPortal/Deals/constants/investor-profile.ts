/** Investor entity / profile options (Add Investment + investor rows). */
export const INVESTOR_PROFILE_SELECT_OPTIONS = [
  { value: "", label: "Select" },
  { value: "individual", label: "Individual" },
  {
    value: "custodian_ira_401k",
    label: "Custodian IRA or custodian based 401(k)",
  },
  { value: "joint_tenancy", label: "Joint tenancy" },
  {
    value: "llc_corp_trust_etc",
    label:
      "LLC, corp, partnership, trust, solo 401(k), or checkbook IRA",
  },
] as const


export const INVESTOR_ROLE_SELECT_OPTIONS = [
   { value: "", label: "Select" },
    {
    value: "Lead Sponsor",
    label:
      "Lead Sponsor",
  },
   { value: "admin sponsor", label: "Admin sponsor" },
  {
    value: "Co-sponsor",
    label: "Co-sponsor",
  },
 
  { value: "LP Investors", label: "LP Investors" },
  // { value: "CPA/Accountant", label: "CPA/Accountant" },
  // {
  //   value: "Attroney",
  //   label:
  //     "Attroney",
  // },
  // {
  //   value: "Fund Admin",
  //   label:
  //     "Fund Admin",
  // },
  // {
  //   value: "Registered investment advisor",
  //   label:
  //     "Registered investment advisor",
  // },
]
export function investorProfileLabel(value: string): string {
  if (!value?.trim()) return "—"
  const row = INVESTOR_PROFILE_SELECT_OPTIONS.find((o) => o.value === value)
  return row?.label ?? value
}

/** Resolve profile select `value` from a display label (e.g. when API only sent `entitySubtitle`). */
export function investorProfileIdFromLabel(label: string): string {
  if (!label?.trim()) return ""
  const row = INVESTOR_PROFILE_SELECT_OPTIONS.find((o) => o.label === label)
  return row?.value ?? ""
}

/** Display label for table / optimistic row; passthrough if not a known option value. */
export function investorRoleLabel(value: string): string {
  const t = String(value ?? "").trim()
  if (!t) return "—"
  const row = INVESTOR_ROLE_SELECT_OPTIONS.find((o) => o.value === t)
  if (row) return row.label
  return t
}

/** Map API / row text back to select `value` for edit prefill. */
export function investorRoleSelectValueFromStored(stored: string | undefined): string {
  const t = String(stored ?? "").trim()
  if (!t || t === "—") return ""
  const byVal = INVESTOR_ROLE_SELECT_OPTIONS.find((o) => o.value === t)
  if (byVal) return byVal.value
  const byLabel = INVESTOR_ROLE_SELECT_OPTIONS.find((o) => o.label === t)
  if (byLabel) return byLabel.value
  return ""
}
