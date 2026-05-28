import { toast } from "../../../../common/components/Toast"
import {
  scrollToFirstFormError,
  scrollValidationAlertIntoView,
} from "../../../../common/utils/scrollToFirstFormError"

type InvestorClassPipelineStep = 1 | 2

const FIELD_HIGHLIGHT_CLASS = "deal_inv_ic_field_invalid"
const FIELD_HIGHLIGHT_ATTR = "data-inv-class-validation-error"

const ADVANCED_STEP_MESSAGES = new Set([
  "Investment type is required (Advanced).",
  "Entity legal ownership is required (Advanced).",
  "Distribution share is required (Advanced).",
  "Waitlist status is required (Advanced).",
  "Number of units is required.",
])

function resolveRoot(container?: ParentNode | null): ParentNode {
  return container ?? document
}

function queryField(
  root: ParentNode,
  preferSelector: string,
): HTMLElement | null {
  const scoped = root.querySelector<HTMLElement>(preferSelector)
  if (scoped) return scoped
  if (preferSelector.startsWith("#") && typeof document !== "undefined") {
    return document.querySelector<HTMLElement>(preferSelector)
  }
  return null
}

/** Map validation copy to stable field ids (`InvestorClassModalFormBody` idPrefix). */
export function investorClassErrorPreferSelector(
  message: string,
  idPrefix: string,
): string | null {
  const map: Record<string, string> = {
    "Class type is required.": `#${idPrefix}-class-type`,
    "Equity class name is required.": `#${idPrefix}-equity-name`,
    "Entity legal ownership is required.": `#${idPrefix}-adv-entity-own`,
    "Raise amount (for ownership) is required.": `#${idPrefix}-raise-own`,
    "Raise amount (for distributions) is required.": `#${idPrefix}-raise-dist`,
    "Minimum investment is required.": `#${idPrefix}-min-inv`,
    "Number of units is required.": `#${idPrefix}-adv-nou`,
    "Preferred return type is required.": `#${idPrefix}-mezz-pref-return`,
    "Preferred return is required.": `#${idPrefix}-mezz-pref-return-pct`,
    "Preferred return accrues on is required.": `#${idPrefix}-mezz-pref-accrues`,
    "Day count convention is required.": `#${idPrefix}-mezz-day-count`,
    "Investment type is required (Advanced).": `#${idPrefix}-adv-inv-type`,
    "Entity legal ownership is required (Advanced).": `#${idPrefix}-adv-entity-own`,
    "Distribution share is required (Advanced).": `#${idPrefix}-adv-dist-share`,
    "Waitlist status is required (Advanced).": `#${idPrefix}-adv-waitlist`,
    "An investor class with this name already exists for this class type on this deal. Use a unique name or choose another class type.":
      `#${idPrefix}-equity-name`,
    "Another investor class of this type already uses this name for this deal. Choose a unique name or another class type.":
      `#${idPrefix}-equity-name`,
  }
  if (message.includes("legal ownership")) return `#${idPrefix}-adv-entity-own`
  if (message.includes("distribution share")) return `#${idPrefix}-adv-dist-share`
  return map[message] ?? null
}

/** Pipeline step that contains the field for this validation message. */
export function investorClassErrorPipelineStep(
  message: string,
): InvestorClassPipelineStep {
  if (ADVANCED_STEP_MESSAGES.has(message)) return 2
  if (message.includes("legal ownership") || message.includes("distribution share")) {
    return 2
  }
  return 1
}

export interface InvestorClassValidationFocusOptions {
  container: HTMLElement | null | undefined
  message: string
  idPrefix: string
  pipelineStep?: InvestorClassPipelineStep
  onPipelineStepChange?: (step: InvestorClassPipelineStep) => void
  /** When true, switch pipeline step before scrolling (add/edit full-page flows). */
  usePipeline?: boolean
  /** When false, skip toast (inline error only). Default true. */
  showToast?: boolean
}

export function clearInvestorClassFormFieldHighlights(
  container: ParentNode | null | undefined,
): void {
  const root = resolveRoot(container)
  root.querySelectorAll<HTMLElement>(`[${FIELD_HIGHLIGHT_ATTR}="true"]`).forEach((el) => {
    el.removeAttribute(FIELD_HIGHLIGHT_ATTR)
    el.removeAttribute("aria-invalid")
    el.classList.remove(FIELD_HIGHLIGHT_CLASS)
  })
}

function highlightInvestorClassFormField(el: HTMLElement): void {
  const details = el.closest("details")
  if (details && !details.open) details.open = true
  el.setAttribute(FIELD_HIGHLIGHT_ATTR, "true")
  el.setAttribute("aria-invalid", "true")
  el.classList.add(FIELD_HIGHLIGHT_CLASS)
}

function scrollInvestorClassFormToTop(
  container: ParentNode | null | undefined,
): void {
  const root = resolveRoot(container)
  const scrollEl = root.querySelector<HTMLElement>(
    ".deals_add_deal_asset_form_scroll, .deal_inv_ic_modal_form_grid",
  )
  if (scrollEl) {
    scrollEl.scrollTo({ top: 0, behavior: "smooth" })
  }
  const alert = root.querySelector<HTMLElement>(".um_msg_error, .um_modal_form_error")
  alert?.scrollIntoView({ behavior: "smooth", block: "start" })
}

export function isInvestorClassAllocationValidationMessage(
  message: string,
): boolean {
  return (
    message.includes("legal ownership") || message.includes("distribution share")
  )
}

export function investorClassValidationErrorTitle(message: string): string {
  if (isInvestorClassAllocationValidationMessage(message)) {
    return "Allocation exceeds 100%"
  }
  if (message.includes("(Advanced)")) return "Advanced fields required"
  return "Cannot save investor class"
}

function runInvestorClassFormErrorFocus(
  opts: InvestorClassValidationFocusOptions,
): void {
  clearInvestorClassFormFieldHighlights(opts.container)
  scrollInvestorClassFormToTop(opts.container)
  scrollValidationAlertIntoView(opts.container)

  const preferSelector = investorClassErrorPreferSelector(
    opts.message,
    opts.idPrefix,
  )
  const root = resolveRoot(opts.container)

  if (preferSelector) {
    const preferred = queryField(root, preferSelector)
    if (preferred) {
      highlightInvestorClassFormField(preferred)
    }
  }

  const scrolled = scrollToFirstFormError({
    container: opts.container,
    preferSelector,
  })

  if (preferSelector && !scrolled) {
    const preferred = queryField(root, preferSelector)
    if (preferred) {
      highlightInvestorClassFormField(preferred)
      preferred.scrollIntoView({ behavior: "smooth", block: "center" })
      if (
        preferred instanceof HTMLInputElement ||
        preferred instanceof HTMLSelectElement ||
        preferred instanceof HTMLTextAreaElement
      ) {
        preferred.focus({ preventScroll: true })
      }
    }
  }

  if (!scrolled) scrollValidationAlertIntoView(opts.container)
}

export function focusInvestorClassFormError(
  container: HTMLElement | null | undefined,
  message: string,
  idPrefix: string,
): void {
  presentInvestorClassFormValidationError({
    container,
    message,
    idPrefix,
    showToast: false,
  })
}

/** Toast, scroll to banner + field, and highlight the control to fix. */
export function presentInvestorClassFormValidationError(
  opts: InvestorClassValidationFocusOptions,
): void {
  if (
    opts.showToast !== false &&
    !isInvestorClassAllocationValidationMessage(opts.message)
  ) {
    toast.error(
      investorClassValidationErrorTitle(opts.message),
      opts.message,
      10_000,
    )
  }
  focusInvestorClassFormErrorWithPipeline(opts)
}

/** Show validation error and scroll to the matching field (opens Advanced, switches pipeline step). */
export function focusInvestorClassFormErrorWithPipeline(
  opts: InvestorClassValidationFocusOptions,
): void {
  const targetStep = investorClassErrorPipelineStep(opts.message)
  const needsStepChange =
    opts.usePipeline &&
    opts.onPipelineStepChange != null &&
    opts.pipelineStep != null &&
    opts.pipelineStep !== targetStep

  const run = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        runInvestorClassFormErrorFocus(opts)
      })
    })
  }

  if (needsStepChange) {
    opts.onPipelineStepChange!(targetStep)
    window.setTimeout(run, 50)
    return
  }
  run()
}
