import type { ReactNode } from "react"

export interface InvestNowFormFieldProps {
  id?: string
  label: string
  required?: boolean
  hint?: string
  children: ReactNode
  className?: string
}

export function InvestNowFormField({
  id,
  label,
  required = false,
  hint,
  children,
  className = "",
}: InvestNowFormFieldProps) {
  const Tag = id ? "label" : "div"
  return (
    <Tag
      {...(id ? { htmlFor: id } : {})}
      className={["deals_create_label deals_create_label_full", className]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="deals_create_label_text">
        {label}
        {required ? (
          <span className="deals_create_req" aria-hidden>
            {" "}
            *
          </span>
        ) : null}
      </span>
      {children}
      {hint ? <p className="deals_create_hint invest_now_field_hint">{hint}</p> : null}
    </Tag>
  )
}

export function InvestNowReadonlyField({
  label,
  required = false,
  value,
  emphasis = false,
}: {
  label: string
  required?: boolean
  value: string
  emphasis?: boolean
}) {
  return (
    <div className="deals_create_label deals_create_label_full">
      <span className="deals_create_label_text">
        {label}
        {required ? (
          <span className="deals_create_req" aria-hidden>
            {" "}
            *
          </span>
        ) : null}
      </span>
      <input
        type="text"
        readOnly
        tabIndex={-1}
        className={
          emphasis
            ? "deals_create_input invest_now_readonly_input invest_now_readonly_input_emphasis"
            : "deals_create_input invest_now_readonly_input"
        }
        value={value}
        aria-readonly="true"
      />
    </div>
  )
}
