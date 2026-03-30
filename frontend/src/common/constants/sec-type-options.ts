/** SEC type values for syndication deal forms (dropdown options). */
export interface SecTypeSelectOption {
  value: string
  label: string
}

export const SEC_TYPE_OPTIONS: readonly SecTypeSelectOption[] = [
  { value: "", label: "Select SEC type…" },
  { value: "506_b", label: "506(b)" },
  { value: "506_c", label: "506(c)" },
  { value: "intrastate", label: "Intrastate" },
  { value: "joint_venture", label: "Joint venture" },
  { value: "lending", label: "Lending" },
  { value: "regulation_a", label: "Regulation A" },
  { value: "regulation_crowdfunding", label: "Regulation Crowdfunding" },
  { value: "4a2", label: "4a2" },
  { value: "not_applicable", label: "Not applicable" },
]
