import { useId } from "react"
import type { DropdownSelectOption } from "@/common/components/dropdown-select"
import { DealsCreateDropdownSelect } from "@/modules/Syndication/Deals/components/DealsCreateDropdownSelect"
import "@/modules/Syndication/Deals/components/deals-create-dropdown.css"
import type { LpBookProfileFilterRow } from "@/modules/Syndication/Deals/utils/lpInvestNowSavedProfileOptions"
import { InvestNowFormField, InvestNowReadonlyField } from "./InvestNowFormField"
import { InvestNowStepLayout } from "./InvestNowStepLayout"

export interface InvestNowInvestorStepProps {
  profileOptions: DropdownSelectOption[]
  savedUserProfileId: string
  onSavedProfileChange: (id: string) => void
  investmentClassLabel: string
  sponsorLabel: string
  loading: boolean
  disabled: boolean
  bookLoading: boolean
  error?: string
  onAddProfile?: () => void
}

export function InvestNowInvestorStep({
  profileOptions,
  savedUserProfileId,
  onSavedProfileChange,
  investmentClassLabel,
  sponsorLabel,
  loading,
  disabled,
  bookLoading,
  error,
  onAddProfile,
}: InvestNowInvestorStepProps) {
  const profileFieldId = useId()
  const titleId = "invest-now-step-investor-title"

  return (
    <InvestNowStepLayout
      titleId={titleId}
      title="Investor"
      hint="Select the investor profile and investment class you want to invest in, as well as the primary sponsor you are investing with."
      error={error}
    >
      <InvestNowFormField id={profileFieldId} label="Profile" required>
        <DealsCreateDropdownSelect
          id={profileFieldId}
          options={profileOptions}
          value={savedUserProfileId}
          onChange={onSavedProfileChange}
          placeholder={bookLoading ? "Loading profiles…" : "Select profile"}
          ariaLabel="Profile"
          disabled={disabled || loading || bookLoading}
          footer={
            onAddProfile
              ? { label: "Add Profile", onClick: onAddProfile }
              : undefined
          }
        />
      </InvestNowFormField>

      <InvestNowReadonlyField
        label="Investment class"
        required
        value={investmentClassLabel}
      />

      <InvestNowReadonlyField
        label="Sponsor"
        required
        value={sponsorLabel}
        emphasis
      />
    </InvestNowStepLayout>
  )
}

export type { LpBookProfileFilterRow }
