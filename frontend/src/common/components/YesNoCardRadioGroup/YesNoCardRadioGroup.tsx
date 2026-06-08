import { CheckCircle2, MailCheck, MailX, XCircle } from "lucide-react"
import { CardRadioGroup } from "../CardRadioGroup/CardRadioGroup"
import "../CardRadioGroup/card_radio_group.css"

export type YesNoValue = "yes" | "no" | ""

type YesNoCardRadioGroupProps = {
  name: string
  value: YesNoValue
  onChange: (value: "yes" | "no") => void
  /** Shows “(Standard)” on the Yes option — matches deal create defaults. */
  yesIsCommon?: boolean
  /** Shows “(Standard)” on the No option. */
  noIsCommon?: boolean
  disabled?: boolean
  ariaLabel?: string
  ariaLabelledBy?: string
  ariaDescribedBy?: string
  className?: string
  /** Mail icons for invitation / notification prompts. */
  variant?: "default" | "mail"
}

export function YesNoCardRadioGroup({
  name,
  value,
  onChange,
  yesIsCommon = false,
  noIsCommon = false,
  disabled = false,
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  className,
  variant = "default",
}: YesNoCardRadioGroupProps) {
  const yesLabel = yesIsCommon ? "Yes (Standard)" : "Yes"
  const noLabel = noIsCommon ? "No (Standard)" : "No"
  const YesIcon = variant === "mail" ? MailCheck : CheckCircle2
  const NoIcon = variant === "mail" ? MailX : XCircle

  return (
    <div
      className={className}
      aria-describedby={ariaDescribedBy}
    >
      <CardRadioGroup
        name={name}
        value={value}
        onChange={(v) => onChange(v as "yes" | "no")}
        ariaLabel={ariaLabel}
        ariaLabelledBy={ariaLabelledBy}
        disabled={disabled}
        options={[
          { value: "yes", label: yesLabel, icon: YesIcon },
          { value: "no", label: noLabel, icon: NoIcon },
        ]}
      />
    </div>
  )
}
