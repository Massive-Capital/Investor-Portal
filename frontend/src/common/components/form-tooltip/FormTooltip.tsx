import { Info } from "lucide-react"
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react"
import "./form-tooltip.css"

export interface FormTooltipProps {
  content: ReactNode
  /** Shown in aria-label on the trigger */
  label: string
  placement?: "top" | "bottom"
  className?: string
}

const LEAVE_MS = 180

export function MandatoryFieldMark() {
  return (
    <span className="form_mandatory_star" aria-hidden="true">
      *
    </span>
  )
}

export function FormTooltip({
  content,
  label,
  placement = "top",
  className = "",
}: FormTooltipProps) {
  const tooltipId = useId()
  const rootRef = useRef<HTMLSpanElement>(null)
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [open, setOpen] = useState(false)

  const clearLeaveTimer = useCallback(() => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current)
      leaveTimerRef.current = null
    }
  }, [])

  const show = useCallback(() => {
    clearLeaveTimer()
    setOpen(true)
  }, [clearLeaveTimer])

  const scheduleHide = useCallback(() => {
    clearLeaveTimer()
    leaveTimerRef.current = setTimeout(() => setOpen(false), LEAVE_MS)
  }, [clearLeaveTimer])

  useEffect(() => {
    return () => clearLeaveTimer()
  }, [clearLeaveTimer])

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open])

  useEffect(() => {
    if (!open) return
    function onDocMouseDown(e: MouseEvent) {
      const el = rootRef.current
      if (el && !el.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDocMouseDown)
    return () => document.removeEventListener("mousedown", onDocMouseDown)
  }, [open])

  function handleTriggerClick() {
    clearLeaveTimer()
    setOpen((v) => !v)
  }

  const rootClass = `form_tooltip_root ${className}`.trim()

  return (
    <span
      ref={rootRef}
      className={rootClass}
      onMouseEnter={show}
      onMouseLeave={scheduleHide}
    >
      <button
        type="button"
        className="form_tooltip_trigger"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        onClick={handleTriggerClick}
      >
        <Info size={16} strokeWidth={2} aria-hidden />
      </button>
      <div
        id={tooltipId}
        role="tooltip"
        className="form_tooltip_panel"
        data-placement={placement}
        data-visible={open}
      >
        <div className="form_tooltip_surface">{content}</div>
        <span className="form_tooltip_arrow" aria-hidden />
      </div>
    </span>
  )
}
