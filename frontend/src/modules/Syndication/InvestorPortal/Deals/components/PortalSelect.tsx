import { ChevronDown } from "lucide-react"
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react"

export interface PortalSelectOption {
  value: string
  label: string
}

interface PortalSelectProps {
  value: string
  options: PortalSelectOption[]
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  id?: string
  className?: string
  /** Matches `label` `id` — use instead of `ariaLabel` when a visible label exists */
  labelledBy?: string
  ariaLabel?: string
}

export function PortalSelect({
  value,
  options,
  onChange,
  disabled,
  placeholder = "Select…",
  id: idProp,
  className,
  labelledBy,
  ariaLabel,
}: PortalSelectProps) {
  const uid = useId()
  const listId = `${idProp ?? uid}-listbox`
  const wrapRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  const selected = options.find((o) => o.value === value)
  const displayLabel = selected?.label ?? placeholder
  const isPlaceholderStyle = value === "" || !selected

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (wrapRef.current?.contains(e.target as Node)) return
      close()
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open, close])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, close])

  const a11yLabel = labelledBy
    ? { "aria-labelledby": labelledBy }
    : ariaLabel
      ? { "aria-label": ariaLabel }
      : {}

  return (
    <div
      ref={wrapRef}
      className={[
        "deal_inv_portal_select",
        open ? "deal_inv_portal_select_open" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        type="button"
        id={idProp}
        className="deal_inv_portal_select_trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        {...a11yLabel}
        onClick={() => {
          if (!disabled) setOpen((o) => !o)
        }}
      >
        <span
          className={
            isPlaceholderStyle
              ? "deal_inv_portal_select_placeholder"
              : "deal_inv_portal_select_value"
          }
        >
          {displayLabel}
        </span>
        <ChevronDown
          size={18}
          strokeWidth={2}
          aria-hidden
          className={`deal_inv_portal_select_chevron${open ? " deal_inv_portal_select_chevron_open" : ""}`}
        />
      </button>
      {open ? (
        <div
          id={listId}
          role="listbox"
          tabIndex={-1}
          className="deal_inv_portal_select_list"
        >
          {options.map((o) => {
            const isSelected = value === o.value
            return (
              <div
                key={o.value === "" ? "__empty" : o.value}
                role="option"
                aria-selected={isSelected}
                className={`deal_inv_portal_select_option${isSelected ? " deal_inv_portal_select_option_selected" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(o.value)
                  close()
                }}
              >
                {o.label}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
