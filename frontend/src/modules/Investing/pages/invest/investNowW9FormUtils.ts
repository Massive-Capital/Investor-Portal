import {
  // formatSsnItinInput,
  nineDigitsFromSsnItinInput,
  ssnItinFieldError,
} from "@/common/tax/usSsnItin"
import type { SavedAddress } from "@/modules/Investing/pages/profiles/address.types"
import type { InvestorProfileListRow } from "@/modules/Investing/pages/profiles/investor-profiles.types"
import { readSessionUser } from "@/modules/myaccount/sessionUser"
import {
  EMPTY_INVEST_NOW_W9,
  type InvestNowW9FormValues,
} from "./investNowW9.types"
import type { InvestNowQuestionnaireAnswers } from "./investNowQuestionnaireValidation"

export function formatInvestNowW9AddressLine(
  parts: Pick<
    InvestNowW9FormValues,
    "street1" | "street2" | "city" | "state" | "zip"
  >,
): string {
  const street = [parts.street1.trim(), parts.street2.trim()]
    .filter(Boolean)
    .join(", ")
  const loc = [parts.city.trim(), parts.state.trim(), parts.zip.trim()]
    .filter(Boolean)
    .join(", ")
  return [street, loc].filter(Boolean).join(", ")
}

export function investNowW9ValuesFromAddress(addr: SavedAddress): InvestNowW9FormValues {
  const parts = {
    street1: addr.street1.trim(),
    street2: addr.street2.trim(),
    city: addr.city.trim(),
    state: addr.state.trim(),
    zip: addr.zip.trim(),
  }
  return {
    ...EMPTY_INVEST_NOW_W9,
    ...parts,
    addressLine: formatInvestNowW9AddressLine(parts),
  }
}

function readWizardState(
  profile: InvestorProfileListRow,
): Record<string, unknown> | null {
  const raw = profile.profileWizardState
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  return raw as Record<string, unknown>
}

function joinNameParts(parts: string[]): string {
  return parts.map((p) => p.trim()).filter(Boolean).join(" ")
}

function taxNameFromWizard(wizard: Record<string, unknown>): string {
  const entityLegal = String(wizard.entityLegalName ?? "").trim()
  if (entityLegal) return entityLegal
  const first = String(wizard.firstName ?? "").trim()
  const middle = String(wizard.middleName ?? "").trim()
  const last = String(wizard.lastName ?? "").trim()
  const single = joinNameParts([first, middle, last])
  if (single) return single
  const first2 = String(wizard.firstName2 ?? "").trim()
  const middle2 = String(wizard.middleName2 ?? "").trim()
  const last2 = String(wizard.lastName2 ?? "").trim()
  const spouse = joinNameParts([first2, middle2, last2])
  if (spouse) return `${single || ""} & ${spouse}`.replace(/^ & /, "").trim()
  return ""
}

function sessionStr(camelKey: string): string {
  const u = readSessionUser()
  if (!u) return ""
  const camel = u[camelKey]
  if (typeof camel === "string" && camel.trim()) return camel.trim()
  const snakeKey = camelKey.replace(/([A-Z])/g, "_$1").toLowerCase()
  const snake = u[snakeKey]
  return typeof snake === "string" ? snake.trim() : ""
}

function sessionDisplayName(): string {
  return [sessionStr("firstName"), sessionStr("lastName")].filter(Boolean).join(" ")
}

function prefillFromQuestionnaire(
  answers: InvestNowQuestionnaireAnswers | undefined,
): Partial<InvestNowW9FormValues> {
  if (!answers) return {}
  const first = String(answers.first_name ?? "").trim()
  const last = String(answers.last_name ?? "").trim()
  const name = [first, last].filter(Boolean).join(" ")
  const addressLine = String(answers.address ?? "").trim()
  const partial: Partial<InvestNowW9FormValues> = {}
  if (name) partial.name = name
  if (addressLine) partial.addressLine = addressLine
  return partial
}

function hasStructuredAddress(values: InvestNowW9FormValues): boolean {
  return Boolean(
    values.street1.trim() &&
      values.city.trim() &&
      values.state.trim() &&
      values.zip.trim(),
  )
}

function hasAnyAddress(values: InvestNowW9FormValues): boolean {
  return Boolean(values.addressLine.trim()) || hasStructuredAddress(values)
}

/** Apply prefill without overwriting values the investor already entered. */
export function mergeInvestNowW9Values(
  current: InvestNowW9FormValues,
  prefill: InvestNowW9FormValues,
): InvestNowW9FormValues {
  const next = { ...current }
  if (!next.name.trim() && prefill.name.trim()) next.name = prefill.name.trim()
  if (!hasAnyAddress(next)) {
    if (prefill.addressLine.trim()) next.addressLine = prefill.addressLine.trim()
    if (prefill.street1.trim()) next.street1 = prefill.street1.trim()
    if (prefill.street2.trim()) next.street2 = prefill.street2.trim()
    if (prefill.city.trim()) next.city = prefill.city.trim()
    if (prefill.state.trim()) next.state = prefill.state.trim()
    if (prefill.zip.trim()) next.zip = prefill.zip.trim()
    if (!next.addressLine.trim() && hasStructuredAddress(next)) {
      next.addressLine = formatInvestNowW9AddressLine(next)
    }
  }
  return next
}

export function buildInvestNowW9Prefill({
  profiles,
  addresses,
  savedUserProfileId,
  questionnaireAnswers,
}: {
  profiles: InvestorProfileListRow[]
  addresses: SavedAddress[]
  savedUserProfileId: string
  questionnaireAnswers?: InvestNowQuestionnaireAnswers
}): InvestNowW9FormValues {
  const profile = profiles.find((p) => p.id === savedUserProfileId.trim())
  let next: InvestNowW9FormValues = { ...EMPTY_INVEST_NOW_W9 }

  if (profile) {
    const wizard = readWizardState(profile)
    const name =
      (wizard ? taxNameFromWizard(wizard) : "") ||
      sessionDisplayName() ||
      profile.profileName.trim() ||
      ""

    next = {
      ...next,
      name,
    }

    const taxAddressId = wizard ? String(wizard.taxAddressId ?? "").trim() : ""
    const addr = taxAddressId
      ? addresses.find((a) => a.id === taxAddressId)
      : addresses[0]
    if (addr) {
      next = { ...next, ...investNowW9ValuesFromAddress(addr) }
    }
  } else {
    const sessionName = sessionDisplayName()
    if (sessionName) next = { ...next, name: sessionName }
  }

  const fromQuestionnaire = prefillFromQuestionnaire(questionnaireAnswers)
  next = mergeInvestNowW9Values(next, {
    ...EMPTY_INVEST_NOW_W9,
    name: fromQuestionnaire.name ?? "",
    addressLine: fromQuestionnaire.addressLine ?? "",
    street1: fromQuestionnaire.street1 ?? "",
    street2: fromQuestionnaire.street2 ?? "",
    city: fromQuestionnaire.city ?? "",
    state: fromQuestionnaire.state ?? "",
    zip: fromQuestionnaire.zip ?? "",
  })

  return next
}

/** Payload for `w9_form` on Invest Now commitment / eSign APIs. */
export function investNowW9FormApiPayload(
  values: InvestNowW9FormValues,
): Record<string, string> {
  return {
    name: values.name.trim(),
    address_line: formatInvestNowW9AddressLine(values),
    street1: values.street1.trim(),
    street2: values.street2.trim(),
    city: values.city.trim(),
    state: values.state.trim(),
    zip: values.zip.trim(),
    ssn: nineDigitsFromSsnItinInput(values.ssn),
  }
}

export function validateInvestNowW9Form(
  values: InvestNowW9FormValues,
): string | null {
  if (!values.name.trim()) {
    return "Enter your name as shown on your income tax return"
  }
  const hasLine = Boolean(values.addressLine.trim())
  const hasParts =
    Boolean(values.street1.trim()) &&
    Boolean(values.city.trim()) &&
    Boolean(values.state.trim()) &&
    Boolean(values.zip.trim())
  if (!hasLine && !hasParts) return "Enter your address"
  const ssnErr = ssnItinFieldError(values.ssn, {
    required: true,
    requiredMessage: "Enter your social security number",
  })
  if (ssnErr) return ssnErr
  return null
}
