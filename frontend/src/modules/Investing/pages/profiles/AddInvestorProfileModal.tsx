import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react"
import { createPortal } from "react-dom"
import {
  ArrowLeft,
  Calendar,
  ChevronRight,
  Building2,
  CircleDollarSign,
  FileText,
  Eye,
  EyeOff,
  Fingerprint,
  HelpCircle,
  IdCard,
  Info,
  LandPlot,
  Mail,
  MapPin,
  Phone,
  Search,
  UserPlus,
  UserRound,
  X,
  Save,
} from "lucide-react"
import { toast } from "@/common/components/Toast"
import type { BeneficiaryDraft } from "./AddBeneficiaryModal"
import type { ProfileBookSnapshot } from "./investingProfileBookApi"
import { BENEFICIARY_LEGAL_DISCLAIMER } from "./beneficiary-legal"
import { InvestingFormField } from "./InvestingFormField"
import { formatSavedAddressLabel, type SavedAddress } from "./address.types"
import type {
  InvestorProfileListRow,
  NewInvestorProfilePayload,
  UpdateInvestorProfilePayload,
} from "./investor-profiles.types"
import "@/modules/Syndication/InvestorPortal/Deals/deal-members/add-investment/add_deal_modal.css"
import "@/modules/Syndication/InvestorPortal/Deals/deals-create.css"
import "@/modules/Syndication/InvestorPortal/Deals/deals-list.css"
import "@/modules/contacts/contacts.css"
import "@/modules/usermanagement/user_management.css"
import "./add-investor-profile-modal.css"
import "./investing-profiles-form-modals.css"

const PROFILE_TYPE_INDIVIDUAL = "Individual"
const PROFILE_TYPE_JOINT_TENANCY = "Joint tenancy"
const PROFILE_TYPE_ENTITY = "Entity"

/**
 * Add flow: steps 1–4 are Profile type, Details, Distributions, Address.
 * **Individual** adds step 5 (optional Beneficiary). Joint and Entity have no beneficiary step.
 * Edit appends a last step for the audit “reason for change.”
 */
const ADD_PROFILE_WIZARD_STEPS_NO_BENEFICIARY: readonly string[] = [
  "Profile type",
  "Profile details",
  "Distributions",
  "Address",
] as const
const BENEFICIARY_WIZARD_STEP_LABEL = "Beneficiary" as const
const ADD_PROFILE_WIZARD_STEP_LABELS: readonly string[] = [
  ...ADD_PROFILE_WIZARD_STEPS_NO_BENEFICIARY,
  BENEFICIARY_WIZARD_STEP_LABEL,
] as const
/** Last add-flow step when profile is Individual (includes optional beneficiary). */
const ADD_LAST_STEP_WITH_BENEFICIARY = ADD_PROFILE_WIZARD_STEP_LABELS.length
/** Last add-flow step for Joint or Entity (no beneficiary step). */
const ADD_LAST_STEP_NO_BENEFICIARY = ADD_PROFILE_WIZARD_STEPS_NO_BENEFICIARY.length

const ENTITY_SUBTYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "llc", label: "LLC" },
  { value: "corporation", label: "Corporation" },
  { value: "partnership", label: "Partnership" },
  { value: "trust", label: "Trust" },
  { value: "ira", label: "IRA" },
  { value: "401k", label: "401(k)" },
]

const FEDERAL_TAX_CLASSIFICATION_OPTIONS: { value: string; label: string }[] = [
  {
    value: "individual_sole_smllc",
    label: "Individual/sole proprietor or single-member LLC (Most common)",
  },
  { value: "c_corp", label: "C Corporation" },
  { value: "s_corp", label: "S Corporation" },
  { value: "partnership", label: "Partnership" },
  { value: "trust_estate", label: "Trust/estate" },
  { value: "llc_excluding_smlc", label: "LLC (excluding single-member LLC)" },
]

type DistributionMethod = "ach" | "check" | "other"

const initialState = {
  profileType: "",
  firstName: "",
  middleName: "",
  lastName: "",
  email1: "",
  ssn: "",
  firstName2: "",
  middleName2: "",
  lastName2: "",
  email2: "",
  phone2: "",
  spouseSsn: "",
  distributionMethod: "ach" as DistributionMethod,
  bankAccountQuery: "",
  /** When method is check: payee name + saved mailing address (separate from ACH/other free text). */
  checkPayeeName: "",
  checkMailingAddressId: "",
  taxAddressId: "",
  mailingAddressId: "",
  /** Joint: "add_new" = pick a saved row (can match tax); "same_as_tax" = mailing follows tax, id cleared. */
  mailingAddressMode: "add_new" as "add_new" | "same_as_tax",
  /** Entity / retirement: subtype (e.g. llc, ira) and display name. */
  entitySubType: "",
  entityLegalName: "",
  /**
   * Shown when entity + **not** custodian-based IRA: full legal / tax profile
   * (jurisdiction, formation, ownership, SMLLC rules, EIN, etc.). Persisted in `form_snapshot`.
   */
  entityJurisdictionOfRegistration: "",
  /** YYYY-MM-DD, optional. */
  entityDateFormed: "",
  /** Distinct from custodian-based IRA question; for non-custodian entity path. */
  entityOwnedByIra401k: "" as "" | "yes" | "no",
  entityMemberCount: "",
  /** Single-member / disregarded status for the entity. */
  entityDisregarded: "" as "" | "yes" | "no",
  /** Legal entity or plan EIN (non-custodian path). */
  entityEin: "",
  entityEinVisible: false,
  /** 3rd profile type (entity): custodian path for IRA/401(k). */
  custodianIra: "" as "" | "yes" | "no",
  legalIraName: "",
  iraCompany: "",
  federalTaxClassification: "",
  iraPartnerEin: "",
  iraCustodianEin: "",
  iraPartnerEinVisible: false,
  iraCustodianEinVisible: false,
  beneficiary: null as BeneficiaryDraft | null,
  /** When set, `beneficiary` was chosen from `savedBeneficiaries` by id. */
  beneficiaryPickId: "",
}

type FormState = typeof initialState

const FORM_STATE_KEYS = Object.keys(initialState) as (keyof FormState)[]

function formToJsonSnapshot(f: FormState): Record<string, unknown> {
  return JSON.parse(JSON.stringify(f)) as Record<string, unknown>
}

/**
 * Merge saved `profile_wizard_state` (same shape as `FormState`) into a partial; unknown keys are ignored.
 */
function partialFormFromSavedWizard(raw: unknown): Partial<FormState> {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return {}
  }
  const src = raw as Record<string, unknown>
  const out: Partial<FormState> = {}
  for (const k of FORM_STATE_KEYS) {
    if (!(k in src)) continue
    const v = src[k as string]
    if (k === "beneficiary") {
      if (v == null) out.beneficiary = null
      else if (typeof v === "object" && !Array.isArray(v)) {
        out.beneficiary = v as BeneficiaryDraft
      }
      continue
    }
    (out as Record<string, unknown>)[k] = v
  }
  return out
}

const REQUIRED_MSG = "This field is required."

type AddProfileFieldErrorKey =
  | "profileType"
  | "entitySubType"
  | "entityLegalName"
  | "entityJurisdictionOfRegistration"
  | "entityDisregarded"
  | "entityEin"
  | "custodianIra"
  | "legalIraName"
  | "iraCompany"
  | "iraPartnerEin"
  | "iraCustodianEin"
  | "federalTaxClassification"
  | "firstName"
  | "lastName"
  | "email1"
  | "firstName2"
  | "lastName2"
  | "email2"
  | "ssn"
  | "bankAccountQuery"
  | "checkPayeeName"
  | "checkMailingAddressId"
  | "taxAddressId"
  | "mailingAddressId"

type AddProfileFieldErrors = Partial<Record<AddProfileFieldErrorKey, string>>

/** `um_field_input_invalid` (same as Add contact) when `hasError`. */
function invClass(base: string, hasError: boolean) {
  return hasError ? `${base} um_field_input_invalid` : base
}

/** Required distribution fields: check uses payee + saved address; ACH/other use search text. */
function addDistributionValidationErrors(
  f: FormState,
  into: AddProfileFieldErrors,
) {
  if (f.distributionMethod === "check") {
    if (!f.checkPayeeName.trim()) into.checkPayeeName = REQUIRED_MSG
    if (!f.checkMailingAddressId.trim()) {
      into.checkMailingAddressId =
        "Select a check mailing address from your saved addresses, or add one in the Address tab first."
    }
  } else if (!f.bankAccountQuery.trim()) {
    into.bankAccountQuery =
      "Enter or search distribution details for your method (ACH, check, or other)."
  }
}

function distributionDetailsLabel(m: DistributionMethod): string {
  switch (m) {
    case "ach":
      return "Distribution bank account"
    case "check":
      return "Check payee and mailing"
    case "other":
      return "Distribution instructions"
    default:
      return "Distribution details"
  }
}

function distributionDetailsHint(m: DistributionMethod): string {
  switch (m) {
    case "ach":
      return "This is used for receiving ACH distributions"
    case "check":
      return "Enter the payee name, then select where checks should be mailed from your saved addresses"
    case "other":
      return "How you or your entity will receive distributions (contact your fund admin if unsure)"
    default:
      return ""
  }
}

function distributionDetailsPlaceholder(m: DistributionMethod): string {
  if (m === "ach") return "Search"
  if (m === "check") return "Search or enter payee and address"
  if (m === "other") return "Enter details"
  return "Search"
}

function distributionDetailsInputAria(m: DistributionMethod): string {
  if (m === "ach") return "Search distribution bank account"
  if (m === "check") return "Check payee and mailing details"
  if (m === "other") return "Other distribution instructions"
  return "Distribution details"
}

const EDIT_WIZARD_REASON_LABEL = "Reason for change" as const

interface AddInvestorProfileModalProps {
  open: boolean
  onClose: () => void
  /** Saved addresses from the Address tab, shown in tax / mailing dropdowns. */
  savedAddresses?: SavedAddress[]
  /** Saved beneficiaries; only the Individual path shows the beneficiary step (a dropdown, no inline add). */
  savedBeneficiaries?: ProfileBookSnapshot["beneficiaries"]
  /**
   * `add` (default): 4 or 5 content steps (5 only for Individual, includes optional Beneficiary), then save. `edit`: same, then a final step for the audit reason, then `onProfileUpdated`.
   */
  mode?: "add" | "edit"
  /**
   * When `mode=edit`, the profile list row (includes `profileWizardState` when saved) and `id` for the PUT.
   * Legacy rows without `profileWizardState` are seeded from `profileName` / `profileType` only.
   */
  editTarget?: InvestorProfileListRow | null
  /** Fired with display fields after validation; parent may persist the profile. May return a Promise. */
  onProfileCreated?: (p: NewInvestorProfilePayload) => void | Promise<void>
  onProfileUpdated?: (id: string, p: UpdateInvestorProfilePayload) => void | Promise<void>
  /**
   * `inline`: in-tab panel. `page`: full-page like Create deal (parent supplies shell).
   * @default "modal"
   */
  variant?: "modal" | "inline" | "page"
}

function FieldHelp({
  label,
  tooltip,
}: {
  label: string
  /** Native tooltip; use for a short field description. */
  tooltip?: string
}) {
  const tip = tooltip?.trim() || "More information"
  const aria = tooltip?.trim() || `${label} — more information`
  return (
    <button
      type="button"
      className="investing_field_hint"
      aria-label={aria}
      title={tip}
    >
      <Info size={16} strokeWidth={1.75} aria-hidden />
    </button>
  )
}

function SavedAddressSelect({
  id,
  value,
  onChange,
  savedAddresses,
  emptyLabel,
  ariaLabel,
  disabled,
  /** When the list is empty, e.g. a filtered list; defaults to a generic hint. */
  emptyListHint,
  invalid,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  savedAddresses: SavedAddress[]
  emptyLabel: string
  ariaLabel: string
  disabled?: boolean
  emptyListHint?: string
  /** Validation error outline (Add contact). */
  invalid?: boolean
}) {
  const noAddresses = savedAddresses.length === 0
  return (
    <>
      {noAddresses ? (
        <p className="add_profile_sub" style={{ marginBottom: "0.35em" }}>
          {emptyListHint || (
            <>
              Add at least one address in the <strong>Address</strong> tab, then return
              here to select it.
            </>
          )}
        </p>
      ) : null}
      <select
        id={id}
        className={invClass("um_field_select deals_add_inv_field_control", Boolean(invalid))}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        disabled={disabled || noAddresses}
        aria-invalid={Boolean(invalid)}
        aria-describedby={invalid ? `${id}-err` : undefined}
      >
        <option value="">{emptyLabel}</option>
        {savedAddresses.map((a) => (
          <option key={a.id} value={a.id}>
            {formatSavedAddressLabel(a)}
          </option>
        ))}
      </select>
    </>
  )
}

function beneficiaryToDraft(
  row: BeneficiaryDraft & { id: string },
): BeneficiaryDraft {
  return {
    fullName: row.fullName,
    relationship: row.relationship,
    taxId: row.taxId,
    phone: row.phone,
    email: row.email,
    addressQuery: row.addressQuery,
  }
}

function formatSavedBeneficiaryLabel(
  row: BeneficiaryDraft & { id: string },
): string {
  const name = row.fullName?.trim() || "—"
  const rel = row.relationship?.trim()
  return rel ? `${name} (${rel})` : name
}

function SavedBeneficiarySelect({
  id,
  value,
  onChange,
  rows,
  emptyLabel,
  ariaLabel,
}: {
  id: string
  value: string
  onChange: (nextId: string) => void
  rows: (BeneficiaryDraft & { id: string })[]
  emptyLabel: string
  ariaLabel: string
}) {
  const noRows = rows.length === 0
  return (
    <>
      {noRows ? (
        <p className="add_profile_sub" style={{ marginBottom: "0.35em" }}>
          Add at least one beneficiary in the <strong>Beneficiaries</strong> tab, then return
          here to select one. You can also continue without a beneficiary.
        </p>
      ) : null}
      <select
        id={id}
        className="um_field_select deals_add_inv_field_control"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        disabled={noRows}
      >
        <option value="">{emptyLabel}</option>
        {rows.map((r) => (
          <option key={r.id} value={r.id}>
            {formatSavedBeneficiaryLabel(r)}
          </option>
        ))}
      </select>
    </>
  )
}

function buildDisplayProfileName(f: FormState): string {
  if (f.profileType === PROFILE_TYPE_ENTITY) {
    if (f.custodianIra === "yes" && f.legalIraName.trim()) {
      return f.legalIraName.trim()
    }
    const name = f.entityLegalName.trim()
    const sub = ENTITY_SUBTYPE_OPTIONS.find((o) => o.value === f.entitySubType)
    const kind = sub?.label ?? f.entitySubType.trim()
    if (name && kind) return `${name} (${kind})`
    return name || kind || "—"
  }
  if (f.profileType === PROFILE_TYPE_JOINT_TENANCY) {
    const a = [f.firstName, f.middleName, f.lastName]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(" ")
    const b = [f.firstName2, f.middleName2, f.lastName2]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(" ")
    if (a && b) return `${a} & ${b}`
    return a || b || "—"
  }
  return [f.firstName, f.middleName, f.lastName]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" ")
}

/**
 * Best-effort seed of wizard fields from API list row (only `profileName` and `profileType` are stored).
 * Keeps the same UI as "Add profile" while filling in obvious splits of the display name.
 */
function seedFormFromListRow(row: { profileName: string; profileType: string }): Partial<FormState> {
  const t = (row.profileType || "").trim()
  const out: Partial<FormState> = { profileType: t }
  const name = (row.profileName || "").trim()
  if (!name || name === "—") return out
  if (t === PROFILE_TYPE_ENTITY) {
    const paren = name.match(/^(.+?)\s*\(([^)]+)\)\s*$/)
    if (paren) {
      const inner = paren[2]!.trim()
      const sub = ENTITY_SUBTYPE_OPTIONS.find(
        (o) => o.label === inner || inner.includes(o.label) || o.label.includes(inner),
      )
      return {
        ...out,
        entityLegalName: paren[1]!.trim(),
        ...(sub ? { entitySubType: sub.value } : {}),
      }
    }
    return { ...out, entityLegalName: name }
  }
  if (t === PROFILE_TYPE_JOINT_TENANCY) {
    const m = name.match(/^(.*)\s+&\s+(.*)$/)
    if (m) {
      const left = m[1]!.trim().split(/\s+/)
      const right = m[2]!.trim().split(/\s+/)
      return {
        ...out,
        firstName: left[0] || "",
        lastName: left.length > 1 ? left[left.length - 1]! : "",
        middleName: left.length > 2 ? left.slice(1, -1).join(" ") : "",
        firstName2: right[0] || "",
        lastName2: right.length > 1 ? right[right.length - 1]! : "",
        middleName2: right.length > 2 ? right.slice(1, -1).join(" ") : "",
      }
    }
    return out
  }
  if (t === PROFILE_TYPE_INDIVIDUAL) {
    const p = name.split(/\s+/).filter(Boolean)
    if (p.length === 0) return out
    if (p.length === 1) return { ...out, firstName: p[0]! }
    return {
      ...out,
      firstName: p[0]!,
      lastName: p[p.length - 1]!,
      middleName: p.length > 2 ? p.slice(1, -1).join(" ") : "",
    }
  }
  return out
}

export function AddInvestorProfileModal({
  open,
  onClose,
  savedAddresses = [],
  savedBeneficiaries = [] as ProfileBookSnapshot["beneficiaries"],
  mode = "add",
  editTarget = null,
  onProfileCreated,
  onProfileUpdated,
  variant = "modal",
}: AddInvestorProfileModalProps) {
  const isListInline = variant === "inline"
  const isPage = variant === "page"
  const isNonModalLayout = isListInline || isPage
  const isEdit = mode === "edit"
  const [form, setForm] = useState<FormState>(initialState)
  const [fieldError, setFieldError] = useState<AddProfileFieldErrors>({})
  const [ssnVisible, setSsnVisible] = useState(false)
  const [spouseSsnVisible, setSpouseSsnVisible] = useState(false)
  const [step, setStep] = useState(1)
  const [lastEditReason, setLastEditReason] = useState("")
  const [lastEditReasonError, setLastEditReasonError] = useState<string | null>(null)

  const activeSavedBeneficiaries = useMemo(
    () => savedBeneficiaries.filter((b) => !b.archived),
    [savedBeneficiaries],
  )

  const addProfilePageTitleId = useId()
  const isIndividual = form.profileType === PROFILE_TYPE_INDIVIDUAL
  const isJointTenancy = form.profileType === PROFILE_TYPE_JOINT_TENANCY
  const isEntity = form.profileType === PROFILE_TYPE_ENTITY
  const hasBeneficiaryStep = !isJointTenancy && !isEntity
  const addFlowLastContentStep = hasBeneficiaryStep
    ? ADD_LAST_STEP_WITH_BENEFICIARY
    : ADD_LAST_STEP_NO_BENEFICIARY
  const stepperLabels = useMemo(
    () => {
      const addLabels = (hasBeneficiaryStep
        ? ADD_PROFILE_WIZARD_STEP_LABELS
        : ADD_PROFILE_WIZARD_STEPS_NO_BENEFICIARY) as string[]
      return (isEdit ? [...addLabels, EDIT_WIZARD_REASON_LABEL] : addLabels) as string[]
    },
    [isEdit, hasBeneficiaryStep],
  )
  const totalSteps = stepperLabels.length
  const effectiveMaxStep = totalSteps

  const stepHeading = useMemo(() => {
    if (step >= 1 && step <= totalSteps) {
      return stepperLabels[step - 1] ?? (isEdit ? "Edit profile" : "Add profile")
    }
    return isEdit ? "Edit profile" : "Add profile"
  }, [step, totalSteps, stepperLabels, isEdit])

  const addProfilePageSubtitle = useMemo(() => {
    if (isEdit && step === totalSteps) {
      return "Describe why you are updating this profile. This is stored in the audit trail."
    }
    if (step === 1) {
      return isEdit
        ? "Update details using the same steps as when the profile was added. Then confirm your change reason."
        : "Select how this profile will be registered."
    }
    if (isJointTenancy) {
      if (step === 2) return "Names, emails, and tax ID for both joint owners."
      if (step === 3) return "How you want to receive distributions."
      if (step === 4) return "Tax and mailing address for this profile."
    }
    if (isEntity) {
      if (step === 2) return "Entity or plan name, EIN, and account information."
      if (step === 3) return "How you want to receive distributions."
      if (step === 4) return "Mailing and legal address for this profile."
    }
    if (isIndividual) {
      if (step === 2)
        return "Legal name, SSN or TIN, and contact information."
      if (step === 3) return "How you want to receive distributions."
      if (step === 4) return "Mailing and legal address for this profile."
      if (step === 5) return "Optional designated beneficiary for this account."
    }
    return "Set up a profile for investments and distributions."
  }, [step, isEdit, isJointTenancy, isEntity, isIndividual, totalSteps])

  useEffect(() => {
    if (!open) return
    setFieldError({})
    setSsnVisible(false)
    setSpouseSsnVisible(false)
    setLastEditReason("")
    setLastEditReasonError(null)
    setStep(1)
    if (isEdit && editTarget) {
      const t = (editTarget.profileType || "").trim()
      const isJoint = t === PROFILE_TYPE_JOINT_TENANCY
      const isEnt = t === PROFILE_TYPE_ENTITY
      const fromWizard = partialFormFromSavedWizard(
        editTarget.profileWizardState ?? null,
      )
      const clearBen = isJoint || isEnt
      if (Object.keys(fromWizard).length > 0) {
        setForm({
          ...initialState,
          ...fromWizard,
          ...(clearBen ? { beneficiary: null, beneficiaryPickId: "" } : {}),
        })
      } else {
        setForm({
          ...initialState,
          ...seedFormFromListRow(editTarget),
          ...(clearBen ? { beneficiary: null, beneficiaryPickId: "" } : {}),
        })
      }
    } else {
      setForm(initialState)
    }
  }, [open, isEdit, editTarget])

  useEffect(() => {
    if (!isIndividual && !isJointTenancy && !isEntity && step > 1) setStep(1)
  }, [isIndividual, isJointTenancy, isEntity, step])

  useEffect(() => {
    setStep((s) => (s > totalSteps ? totalSteps : s))
  }, [totalSteps])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open || isNonModalLayout) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open, isNonModalLayout])

  const patch = useCallback(
    (
      partial: Partial<FormState>,
      clearFieldErrors?: AddProfileFieldErrorKey | AddProfileFieldErrorKey[],
    ) => {
      setForm((prev) => ({ ...prev, ...partial }))
      if (clearFieldErrors) {
        const keys = (Array.isArray(clearFieldErrors) ? clearFieldErrors : [clearFieldErrors]) as AddProfileFieldErrorKey[]
        setFieldError((f) => {
          let next = f
          for (const k of keys) {
            if (f[k]) {
              if (next === f) next = { ...f }
              next[k] = undefined
            }
          }
          return next
        })
      }
    },
    [],
  )

  const validateStep = useCallback((): boolean => {
    const noErr: AddProfileFieldErrors = {}
    if (step === 1) {
      const err: AddProfileFieldErrors = {}
      if (!form.profileType.trim()) {
        err.profileType = REQUIRED_MSG
      } else if (!isIndividual && !isJointTenancy && !isEntity) {
        err.profileType =
          "Choose Individual, Joint tenancy, or an entity or plan type."
      }
      setFieldError(err)
      return Object.keys(err).length === 0
    }
    if (step === 2 && isEntity) {
      const err: AddProfileFieldErrors = {}
      if (!form.custodianIra) {
        err.custodianIra = REQUIRED_MSG
      } else if (form.custodianIra === "yes") {
        if (!form.legalIraName.trim()) err.legalIraName = REQUIRED_MSG
        if (!form.iraCompany.trim()) err.iraCompany = REQUIRED_MSG
        if (!form.iraCustodianEin.trim()) {
          err.iraCustodianEin = REQUIRED_MSG
        }
      } else {
        if (!form.entityLegalName.trim()) {
          err.entityLegalName = "Enter the legal name of the entity."
        }
        if (!form.entityJurisdictionOfRegistration.trim()) {
          err.entityJurisdictionOfRegistration = REQUIRED_MSG
        }
        if (!form.entitySubType.trim()) err.entitySubType = REQUIRED_MSG
        if (!form.federalTaxClassification.trim()) {
          err.federalTaxClassification = REQUIRED_MSG
        }
        if (!form.entityDisregarded) {
          err.entityDisregarded = REQUIRED_MSG
        }
        if (!form.entityEin.trim()) err.entityEin = REQUIRED_MSG
      }
      setFieldError(err)
      return Object.keys(err).length === 0
    }
    if (step === 2 && isJointTenancy) {
      const err: AddProfileFieldErrors = {}
      if (!form.firstName.trim()) err.firstName = REQUIRED_MSG
      if (!form.lastName.trim()) err.lastName = REQUIRED_MSG
      if (!form.email1.trim()) err.email1 = REQUIRED_MSG
      if (!form.firstName2.trim()) err.firstName2 = REQUIRED_MSG
      if (!form.lastName2.trim()) err.lastName2 = REQUIRED_MSG
      if (!form.email2.trim()) err.email2 = REQUIRED_MSG
      if (!form.ssn.trim()) err.ssn = REQUIRED_MSG
      setFieldError(err)
      return Object.keys(err).length === 0
    }
    if (step === 2 && isIndividual) {
      const err: AddProfileFieldErrors = {}
      if (!form.firstName.trim()) err.firstName = REQUIRED_MSG
      if (!form.lastName.trim()) err.lastName = REQUIRED_MSG
      if (!form.ssn.trim()) err.ssn = REQUIRED_MSG
      setFieldError(err)
      return Object.keys(err).length === 0
    }
    if (
      step === 3 &&
      (isIndividual || isJointTenancy || isEntity)
    ) {
      const err: AddProfileFieldErrors = {}
      addDistributionValidationErrors(form, err)
      setFieldError(err)
      return Object.keys(err).length === 0
    }
    if (step === 4 && (isIndividual || isEntity)) {
      const err: AddProfileFieldErrors = {}
      if (!form.taxAddressId.trim()) {
        err.taxAddressId = "Select a tax address, or add one in the Address tab first."
      }
      setFieldError(err)
      return Object.keys(err).length === 0
    }
    if (step === 4 && isJointTenancy) {
      const err: AddProfileFieldErrors = {}
      if (!form.taxAddressId.trim()) {
        err.taxAddressId = "Select a tax address, or add one in the Address tab first."
      }
      if (form.mailingAddressMode === "add_new" && !form.mailingAddressId.trim()) {
        err.mailingAddressId =
          "Select a saved mailing address (it may be the same as tax), or choose “Same as tax address” above."
      }
      setFieldError(err)
      return Object.keys(err).length === 0
    }
    if (step === 5 && hasBeneficiaryStep) {
      setFieldError(noErr)
      return true
    }
    setFieldError(noErr)
    return true
  }, [step, form, isIndividual, isJointTenancy, isEntity, hasBeneficiaryStep])

  const goNext = useCallback(() => {
    if (!validateStep()) return
    setStep((s) => Math.min(effectiveMaxStep, s + 1))
  }, [validateStep, effectiveMaxStep])

  const goBack = useCallback(() => {
    setFieldError({})
    setStep((s) => Math.max(1, s - 1))
  }, [])

  function handleProfileTypeChange(value: string) {
    setForm((prev) => ({
      ...prev,
      profileType: value,
      ...(value === PROFILE_TYPE_JOINT_TENANCY || value === PROFILE_TYPE_ENTITY
        ? { beneficiary: null, beneficiaryPickId: "" as const }
        : {}),
      ...(value !== PROFILE_TYPE_ENTITY
        ? {
            entitySubType: "",
            entityLegalName: "",
            entityJurisdictionOfRegistration: "",
            entityDateFormed: "",
            entityOwnedByIra401k: "" as const,
            entityMemberCount: "",
            entityDisregarded: "" as const,
            entityEin: "",
            entityEinVisible: false,
            custodianIra: "" as const,
            legalIraName: "",
            iraCompany: "",
            federalTaxClassification: "",
            iraPartnerEin: "",
            iraCustodianEin: "",
            iraPartnerEinVisible: false,
            iraCustodianEinVisible: false,
          }
        : {}),
    }))
    setFieldError((f) => (f.profileType ? { ...f, profileType: undefined } : f))
    if (
      value !== PROFILE_TYPE_INDIVIDUAL &&
      value !== PROFILE_TYPE_JOINT_TENANCY &&
      value !== PROFILE_TYPE_ENTITY
    ) {
      setStep(1)
    }
  }

  function runFullFormValidationForSave(): boolean {
    if (isJointTenancy) {
      const err: AddProfileFieldErrors = {}
      if (!form.firstName.trim()) err.firstName = REQUIRED_MSG
      if (!form.lastName.trim()) err.lastName = REQUIRED_MSG
      if (!form.email1.trim()) err.email1 = REQUIRED_MSG
      if (!form.firstName2.trim()) err.firstName2 = REQUIRED_MSG
      if (!form.lastName2.trim()) err.lastName2 = REQUIRED_MSG
      if (!form.email2.trim()) err.email2 = REQUIRED_MSG
      if (!form.ssn.trim()) err.ssn = REQUIRED_MSG
      addDistributionValidationErrors(form, err)
      if (!form.taxAddressId.trim()) {
        err.taxAddressId = "Select a tax address, or add one in the Address tab first."
      }
      if (form.mailingAddressMode === "add_new" && !form.mailingAddressId.trim()) {
        err.mailingAddressId =
          "Select a saved mailing address (it may be the same as tax), or choose “Same as tax address” above."
      }
      setFieldError(err)
      if (Object.keys(err).length > 0) {
        if (
          err.firstName ||
          err.lastName ||
          err.email1 ||
          err.firstName2 ||
          err.lastName2 ||
          err.email2 ||
          err.ssn
        ) {
          setStep(2)
        } else if (err.bankAccountQuery || err.checkPayeeName || err.checkMailingAddressId) {
          setStep(3)
        } else if (err.taxAddressId || err.mailingAddressId) {
          setStep(4)
        }
        return false
      }
      return true
    }
    if (isIndividual) {
      const err: AddProfileFieldErrors = {}
      if (!form.firstName.trim()) err.firstName = REQUIRED_MSG
      if (!form.lastName.trim()) err.lastName = REQUIRED_MSG
      if (!form.ssn.trim()) err.ssn = REQUIRED_MSG
      addDistributionValidationErrors(form, err)
      if (!form.taxAddressId.trim()) {
        err.taxAddressId = "Select a tax address, or add one in the Address tab first."
      }
      setFieldError(err)
      if (Object.keys(err).length > 0) {
        if (err.firstName || err.lastName || err.ssn) setStep(2)
        else if (err.bankAccountQuery || err.checkPayeeName || err.checkMailingAddressId) setStep(3)
        else if (err.taxAddressId) setStep(4)
        return false
      }
      return true
    }
    if (isEntity) {
      const err: AddProfileFieldErrors = {}
      if (!form.custodianIra) {
        err.custodianIra = REQUIRED_MSG
      } else if (form.custodianIra === "yes") {
        if (!form.legalIraName.trim()) err.legalIraName = REQUIRED_MSG
        if (!form.iraCompany.trim()) err.iraCompany = REQUIRED_MSG
        if (!form.iraCustodianEin.trim()) {
          err.iraCustodianEin = REQUIRED_MSG
        }
      } else {
        if (!form.entityLegalName.trim()) {
          err.entityLegalName = "Enter the legal name of the entity."
        }
        if (!form.entityJurisdictionOfRegistration.trim()) {
          err.entityJurisdictionOfRegistration = REQUIRED_MSG
        }
        if (!form.entitySubType.trim()) err.entitySubType = REQUIRED_MSG
        if (!form.federalTaxClassification.trim()) {
          err.federalTaxClassification = REQUIRED_MSG
        }
        if (!form.entityDisregarded) {
          err.entityDisregarded = REQUIRED_MSG
        }
        if (!form.entityEin.trim()) err.entityEin = REQUIRED_MSG
      }
      addDistributionValidationErrors(form, err)
      if (!form.taxAddressId.trim()) {
        err.taxAddressId = "Select a tax address, or add one in the Address tab first."
      }
      setFieldError(err)
      if (Object.keys(err).length > 0) {
        if (
          err.custodianIra ||
          err.legalIraName ||
          err.iraCompany ||
          err.iraCustodianEin ||
          err.entitySubType ||
          err.entityLegalName ||
          err.entityJurisdictionOfRegistration ||
          err.federalTaxClassification ||
          err.entityDisregarded ||
          err.entityEin
        ) {
          setStep(2)
        } else if (err.bankAccountQuery || err.checkPayeeName || err.checkMailingAddressId) {
          setStep(3)
        } else if (err.taxAddressId) {
          setStep(4)
        }
        return false
      }
      return true
    }
    setFieldError({
      profileType: "Choose a profile type to continue.",
    })
    return false
  }

  function handleSubmit() {
    if (isEdit) return
    if (step !== addFlowLastContentStep) return
    if (!runFullFormValidationForSave()) return
    const payload: NewInvestorProfilePayload = {
      profileName: buildDisplayProfileName(form),
      profileType: form.profileType,
      profileWizardState: formToJsonSnapshot(form),
    }
    if (onProfileCreated) {
      void (async () => {
        try {
          await onProfileCreated(payload)
          onClose()
        } catch (e) {
          toast.error(
            "Could not save profile",
            e instanceof Error ? e.message : "Please try again.",
          )
        }
      })()
    } else {
      toast.success(
        "Profile added",
        "Your new profile was saved. (No handler — data not persisted.)",
      )
      onClose()
    }
  }

  function handleEditSave() {
    if (!isEdit || !editTarget) return
    if (step !== totalSteps) return
    if (!lastEditReason.trim()) {
      setLastEditReasonError("This field is required for the audit log.")
      toast.error("Reason required", "Describe why you are making this change.")
      return
    }
    setLastEditReasonError(null)
    if (!runFullFormValidationForSave()) {
      return
    }
    const payload: UpdateInvestorProfilePayload = {
      profileName: buildDisplayProfileName(form),
      profileType: form.profileType,
      lastEditReason: lastEditReason.trim(),
      profileWizardState: formToJsonSnapshot(form),
    }
    if (onProfileUpdated) {
      void (async () => {
        try {
          await onProfileUpdated(editTarget.id, payload)
          onClose()
        } catch (e) {
          toast.error(
            "Could not save profile",
            e instanceof Error ? e.message : "Please try again.",
          )
        }
      })()
    } else {
      onClose()
    }
  }

  if (!open) return null

  function stepperGroup() {
    return (
      <>
        <p id="add-profile-step-label" className="add_profile_sronly">
          Step {step} of {totalSteps}: {stepHeading}
        </p>
        {stepperLabels.map((label, i) => {
          const n = i + 1
          const isActive = step === n
          const isDone = step > n
          return (
            <Fragment key={n}>
              {i > 0 ? (
                <span
                  className={
                    step > i
                      ? "add_contact_step_line add_contact_step_line_active"
                      : "add_contact_step_line"
                  }
                  aria-hidden
                />
              ) : null}
              <div
                className={
                  isActive
                    ? "add_contact_step_node add_contact_step_node_active"
                    : isDone
                      ? "add_contact_step_node add_contact_step_node_done"
                      : "add_contact_step_node"
                }
              >
                <span
                  className="add_contact_step_dot"
                  aria-current={isActive ? "step" : undefined}
                >
                  {n}
                </span>
                <span className="add_contact_step_label">{label}</span>
              </div>
            </Fragment>
          )
        })}
      </>
    )
  }

  function renderFormPanel() {
    const formNode = (
        <form
          className={
            isPage ? "deals_add_deal_asset_form" : "deals_add_inv_modal_form"
          }
          onSubmit={(e) => e.preventDefault()}
          noValidate
          aria-labelledby={
            isPage ? addProfilePageTitleId : "add-profile-modal-title"
          }
          aria-describedby="add-profile-step-label"
        >
          <div
            className={
              isPage
                ? "deals_add_deal_asset_form_scroll deals_add_profile_wizard_scroll"
                : "deals_add_inv_modal_scroll"
            }
          >
            {step === 1 && (
            <div className="add_contact_section" aria-labelledby="ap-s1">
              <p id="ap-s1" className="add_contact_section_eyebrow">
                Profile type
              </p>
              <InvestingFormField
                id="ap-profile-type"
                label={<>Profile type <span className="contacts_required" aria-hidden>*</span></>}
                Icon={IdCard}
                labelSuffix={
                  <FieldHelp label="Profile type" tooltip="Type of profile" />
                }
                error={fieldError.profileType}
              >
                <select
                  id="ap-profile-type"
                  className={invClass(
                    "um_field_select deals_add_inv_field_control",
                    Boolean(fieldError.profileType),
                  )}
                  value={form.profileType}
                  onChange={(e) => handleProfileTypeChange(e.target.value)}
                  aria-invalid={Boolean(fieldError.profileType)}
                  aria-describedby={
                    fieldError.profileType ? "ap-profile-type-err" : undefined
                  }
                >
                  <option value="">Select profile type</option>
                  <option value={PROFILE_TYPE_INDIVIDUAL}>Individual</option>
                  <option value={PROFILE_TYPE_JOINT_TENANCY}>Joint tenancy</option>
                  <option value={PROFILE_TYPE_ENTITY}>
                    LLC, corporation, partnership, trust, IRA, or 401(k)
                  </option>
                </select>
              </InvestingFormField>
            </div>
          )}

          {step === 2 && isEntity && (
            <div className="add_contact_section" aria-labelledby="ap-entity-s2">
              <p id="ap-entity-s2" className="add_contact_section_eyebrow">
                Profile details
              </p>
              <InvestingFormField
                id="ap-entity-custodian"
                label={
                  <>
                    Is this a custodian based IRA or 401(k)?{" "}
                    <span className="contacts_required" aria-hidden>*</span>
                  </>
                }
                Icon={HelpCircle}
                error={fieldError.custodianIra}
              >
                <select
                  id="ap-entity-custodian"
                  className={invClass(
                    "um_field_select deals_add_inv_field_control",
                    Boolean(fieldError.custodianIra),
                  )}
                  value={form.custodianIra}
                  onChange={(e) => {
                    const v = e.target.value as "" | "yes" | "no"
                    if (v === "yes") {
                      patch(
                        {
                          custodianIra: v,
                          entitySubType: "",
                          entityLegalName: "",
                          entityJurisdictionOfRegistration: "",
                          entityDateFormed: "",
                          entityOwnedByIra401k: "" as const,
                          entityMemberCount: "",
                          entityDisregarded: "" as const,
                          entityEin: "",
                          entityEinVisible: false,
                        },
                        "custodianIra",
                      )
                    } else if (v === "no") {
                      patch(
                        {
                          custodianIra: v,
                          legalIraName: "",
                          iraCompany: "",
                          federalTaxClassification: "",
                          iraPartnerEin: "",
                          iraCustodianEin: "",
                          iraPartnerEinVisible: false,
                          iraCustodianEinVisible: false,
                        },
                        [
                          "custodianIra",
                          "legalIraName",
                          "iraCompany",
                          "iraPartnerEin",
                          "iraCustodianEin",
                        ],
                      )
                    } else {
                      patch(
                        {
                          custodianIra: v,
                          legalIraName: "",
                          iraCompany: "",
                          federalTaxClassification: "",
                          iraPartnerEin: "",
                          iraCustodianEin: "",
                          iraPartnerEinVisible: false,
                          iraCustodianEinVisible: false,
                          entitySubType: "",
                          entityLegalName: "",
                          entityJurisdictionOfRegistration: "",
                          entityDateFormed: "",
                          entityOwnedByIra401k: "" as const,
                          entityMemberCount: "",
                          entityDisregarded: "" as const,
                          entityEin: "",
                          entityEinVisible: false,
                        },
                        "custodianIra",
                      )
                    }
                  }}
                  aria-label="Is this a custodian based IRA or 401(k)"
                  aria-invalid={Boolean(fieldError.custodianIra)}
                  aria-describedby={
                    fieldError.custodianIra ? "ap-entity-custodian-err" : undefined
                  }
                >
                  <option value="">Select</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </InvestingFormField>
              {form.custodianIra ? (
                <p className="add_profile_sub" style={{ marginTop: "0.25em" }}>
                  Choose &quot;yes&quot; if a custodian needs to sign, and &quot;no&quot; if
                  only the investor needs to sign. Choose &quot;no&quot; if this is not an
                  IRA or 401(k).{" "}
                  <a
                    href="https://www.irs.gov/retirement-plans"
                    className="add_profile_inline_link"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Learn more
                  </a>
                  .
                </p>
              ) : null}

              {form.custodianIra === "yes" ? (
                <>
                  <InvestingFormField
                    id="ap-ent-legal-ira"
                    label={
                      <>
                        Legal IRA name <span className="contacts_required" aria-hidden>*</span>
                      </>
                    }
                    Icon={Building2}
                    error={fieldError.legalIraName}
                  >
                    <input
                      id="ap-ent-legal-ira"
                      className={invClass(
                        "deals_add_inv_input deals_add_inv_field_control",
                        Boolean(fieldError.legalIraName),
                      )}
                      value={form.legalIraName}
                      onChange={(e) =>
                        patch({ legalIraName: e.target.value }, "legalIraName")
                      }
                      placeholder="Quest Trust Company FBO John Smith IRA # 1234567"
                      autoComplete="organization"
                      aria-invalid={Boolean(fieldError.legalIraName)}
                      aria-describedby={
                        fieldError.legalIraName ? "ap-ent-legal-ira-err" : undefined
                      }
                    />
                  </InvestingFormField>
                  <InvestingFormField
                    id="ap-ent-ira-co"
                    label={
                      <>
                        IRA company <span className="contacts_required" aria-hidden>*</span>
                      </>
                    }
                    Icon={Building2}
                    error={fieldError.iraCompany}
                  >
                    <input
                      id="ap-ent-ira-co"
                      className={invClass(
                        "deals_add_inv_input deals_add_inv_field_control",
                        Boolean(fieldError.iraCompany),
                      )}
                      value={form.iraCompany}
                      onChange={(e) => patch({ iraCompany: e.target.value }, "iraCompany")}
                      placeholder="IRA company name"
                      autoComplete="organization"
                      aria-invalid={Boolean(fieldError.iraCompany)}
                      aria-describedby={
                        fieldError.iraCompany ? "ap-ent-ira-co-err" : undefined
                      }
                    />
                  </InvestingFormField>
                  <InvestingFormField
                    id="ap-ent-federal-tax"
                    label="Federal tax classification"
                    Icon={FileText}
                  >
                    <select
                      id="ap-ent-federal-tax"
                      className="um_field_select deals_add_inv_field_control"
                      value={form.federalTaxClassification}
                      onChange={(e) =>
                        patch({ federalTaxClassification: e.target.value })
                      }
                      aria-label="Federal tax classification"
                    >
                      <option value="">Select</option>
                      {FEDERAL_TAX_CLASSIFICATION_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </InvestingFormField>
                  <InvestingFormField
                    id="ap-ent-ira-partner-ein"
                    label="IRA partner EIN"
                    Icon={Fingerprint}
                  >
                    <p className="add_profile_sub" style={{ marginBottom: "0.5em" }}>
                      Unique EIN of your IRA account. Needed to issue your Schedule K-1.{" "}
                      <a
                        href="https://www.irs.gov"
                        className="add_profile_inline_link"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Learn more
                      </a>
                      .
                    </p>
                    <div className="add_profile_input_wrap">
                      <input
                        id="ap-ent-ira-partner-ein"
                        className="deals_add_inv_input deals_add_inv_field_control"
                        type={form.iraPartnerEinVisible ? "text" : "password"}
                        value={form.iraPartnerEin}
                        onChange={(e) => patch({ iraPartnerEin: e.target.value })}
                        autoComplete="off"
                        placeholder="EIN"
                        aria-label="IRA partner EIN"
                      />
                      <button
                        type="button"
                        className="add_profile_ssn_toggle"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            iraPartnerEinVisible: !prev.iraPartnerEinVisible,
                          }))
                        }
                        aria-label={
                          form.iraPartnerEinVisible
                            ? "Hide IRA partner EIN"
                            : "Show IRA partner EIN"
                        }
                      >
                        {form.iraPartnerEinVisible ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                    </div>
                  </InvestingFormField>
                  <InvestingFormField
                    id="ap-ent-ira-cust-ein"
                    label={
                      <>
                        IRA custodian EIN <span className="contacts_required" aria-hidden>*</span>
                      </>
                    }
                    Icon={Fingerprint}
                    labelSuffix={
                      <FieldHelp
                        label="IRA custodian EIN"
                        tooltip="Usually this is the custodian or plan entity EIN for your IRA, not your personal SSN. Enter the EIN of the financial institution that holds the account, when required for your tax forms."
                      />
                    }
                    error={fieldError.iraCustodianEin}
                  >
                    <p
                      id="ap-ent-ira-cust-ein-hint"
                      className="add_profile_sub"
                      style={{ marginBottom: "0.5em" }}
                    >
                      Usually this is the custodian or entity EIN for your IRA, not your SSN.
                    </p>
                    <div className="add_profile_input_wrap">
                      <input
                        id="ap-ent-ira-cust-ein"
                        className={invClass(
                          "deals_add_inv_input deals_add_inv_field_control",
                          Boolean(fieldError.iraCustodianEin),
                        )}
                        type={form.iraCustodianEinVisible ? "text" : "password"}
                        value={form.iraCustodianEin}
                        onChange={(e) =>
                          patch({ iraCustodianEin: e.target.value }, "iraCustodianEin")
                        }
                        autoComplete="off"
                        placeholder="EIN"
                        aria-invalid={Boolean(fieldError.iraCustodianEin)}
                        aria-describedby={[
                          "ap-ent-ira-cust-ein-hint",
                          fieldError.iraCustodianEin
                            ? "ap-ent-ira-cust-ein-err"
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        aria-label="IRA custodian EIN"
                      />
                      <button
                        type="button"
                        className="add_profile_ssn_toggle"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            iraCustodianEinVisible: !prev.iraCustodianEinVisible,
                          }))
                        }
                        aria-label={
                          form.iraCustodianEinVisible
                            ? "Hide IRA custodian EIN"
                            : "Show IRA custodian EIN"
                        }
                      >
                        {form.iraCustodianEinVisible ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                    </div>
                  </InvestingFormField>
                </>
              ) : null}

              {form.custodianIra === "no" ? (
                <>
                  <InvestingFormField
                    id="ap-entity-legal"
                    label={
                      <>
                        Entity name <span className="contacts_required" aria-hidden>*</span>
                      </>
                    }
                    Icon={Building2}
                    error={fieldError.entityLegalName}
                  >
                    <input
                      id="ap-entity-legal"
                      className={invClass(
                        "deals_add_inv_input deals_add_inv_field_control",
                        Boolean(fieldError.entityLegalName),
                      )}
                      value={form.entityLegalName}
                      onChange={(e) =>
                        patch({ entityLegalName: e.target.value }, "entityLegalName")
                      }
                      placeholder="Registered legal name of the entity or plan"
                      autoComplete="organization"
                      aria-invalid={Boolean(fieldError.entityLegalName)}
                      aria-describedby={
                        fieldError.entityLegalName ? "ap-entity-legal-err" : undefined
                      }
                    />
                  </InvestingFormField>
                  <InvestingFormField
                    id="ap-entity-jurisdiction"
                    label={
                      <>
                        Jurisdiction of registration <span className="contacts_required" aria-hidden>*</span>
                      </>
                    }
                    Icon={LandPlot}
                    error={fieldError.entityJurisdictionOfRegistration}
                  >
                    <input
                      id="ap-entity-jurisdiction"
                      className={invClass(
                        "deals_add_inv_input deals_add_inv_field_control",
                        Boolean(fieldError.entityJurisdictionOfRegistration),
                      )}
                      value={form.entityJurisdictionOfRegistration}
                      onChange={(e) =>
                        patch(
                          { entityJurisdictionOfRegistration: e.target.value },
                          "entityJurisdictionOfRegistration",
                        )
                      }
                      placeholder="State is sufficient, e.g. 'WA'"
                      autoComplete="off"
                      aria-invalid={Boolean(fieldError.entityJurisdictionOfRegistration)}
                      aria-describedby={
                        fieldError.entityJurisdictionOfRegistration
                          ? "ap-entity-jurisdiction-err"
                          : undefined
                      }
                    />
                  </InvestingFormField>
                  <InvestingFormField
                    id="ap-entity-date-formed"
                    label="Date formed"
                    Icon={Calendar}
                  >
                    <input
                      id="ap-entity-date-formed"
                      type="date"
                      className="deals_add_inv_input deals_add_inv_field_control"
                      value={form.entityDateFormed}
                      onChange={(e) =>
                        patch({ entityDateFormed: e.target.value })
                      }
                      aria-label="Date formed"
                    />
                  </InvestingFormField>
                  <InvestingFormField
                    id="ap-entity-owned-ira"
                    label="Is this entity owned by an IRA or 401(k)?"
                    Icon={HelpCircle}
                    labelSuffix={
                      <FieldHelp
                        label="Is this entity owned by an IRA or 401(k)?"
                        tooltip="Indicate if an IRA, solo 401(k), or other retirement account owns this entity (separate from custodian signing for investments)."
                      />
                    }
                  >
                    <select
                      id="ap-entity-owned-ira"
                      className="um_field_select deals_add_inv_field_control"
                      value={form.entityOwnedByIra401k}
                      onChange={(e) =>
                        patch(
                          { entityOwnedByIra401k: e.target.value as "" | "yes" | "no" },
                        )
                      }
                      aria-label="Is this entity owned by an IRA or 401(k)?"
                    >
                      <option value="">Select</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </InvestingFormField>
                  <InvestingFormField
                    id="ap-entity-member-count"
                    label="Number of members"
                    Icon={UserPlus}
                  >
                    <input
                      id="ap-entity-member-count"
                      className="deals_add_inv_input deals_add_inv_field_control"
                      inputMode="numeric"
                      value={form.entityMemberCount}
                      onChange={(e) => patch({ entityMemberCount: e.target.value })}
                      placeholder="Enter number of members in the entity"
                      autoComplete="off"
                    />
                  </InvestingFormField>
                  <InvestingFormField
                    id="ap-entity-type"
                    label={
                      <>
                        Type <span className="contacts_required" aria-hidden>*</span>
                      </>
                    }
                    Icon={IdCard}
                    labelSuffix={
                      <FieldHelp
                        label="Type"
                        tooltip="LLC, corporation, partnership, trust, IRA, or 401(k) plan"
                      />
                    }
                    error={fieldError.entitySubType}
                  >
                    <select
                      id="ap-entity-type"
                      className={invClass(
                        "um_field_select deals_add_inv_field_control",
                        Boolean(fieldError.entitySubType),
                      )}
                      value={form.entitySubType}
                      onChange={(e) =>
                        patch({ entitySubType: e.target.value }, "entitySubType")
                      }
                      aria-label="Entity, trust, or plan type"
                      aria-invalid={Boolean(fieldError.entitySubType)}
                      aria-describedby={
                        fieldError.entitySubType ? "ap-entity-type-err" : undefined
                      }
                    >
                      <option value="">Select</option>
                      {ENTITY_SUBTYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </InvestingFormField>
                  <InvestingFormField
                    id="ap-ent-federal-no"
                    label={
                      <>
                        Federal tax classification <span className="contacts_required" aria-hidden>*</span>
                      </>
                    }
                    Icon={FileText}
                    error={fieldError.federalTaxClassification}
                  >
                    <select
                      id="ap-ent-federal-no"
                      className={invClass(
                        "um_field_select deals_add_inv_field_control",
                        Boolean(fieldError.federalTaxClassification),
                      )}
                      value={form.federalTaxClassification}
                      onChange={(e) =>
                        patch(
                          { federalTaxClassification: e.target.value },
                          "federalTaxClassification",
                        )
                      }
                      aria-label="Federal tax classification"
                      aria-invalid={Boolean(fieldError.federalTaxClassification)}
                    >
                      <option value="">Select</option>
                      {FEDERAL_TAX_CLASSIFICATION_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </InvestingFormField>
                  <InvestingFormField
                    id="ap-entity-disregarded"
                    label={
                      <>
                        Is this a disregarded entity? <span className="contacts_required" aria-hidden>*</span>
                      </>
                    }
                    Icon={HelpCircle}
                    labelSuffix={
                      <FieldHelp
                        label="Is this a disregarded entity?"
                        tooltip="For example, a single-member LLC default classification for federal tax. Choose “Yes” or “No” to match your entity’s federal filing status."
                      />
                    }
                    error={fieldError.entityDisregarded}
                  >
                    <select
                      id="ap-entity-disregarded"
                      className={invClass(
                        "um_field_select deals_add_inv_field_control",
                        Boolean(fieldError.entityDisregarded),
                      )}
                      value={form.entityDisregarded}
                      onChange={(e) =>
                        patch(
                          { entityDisregarded: e.target.value as "" | "yes" | "no" },
                          "entityDisregarded",
                        )
                      }
                      aria-label="Is this a disregarded entity"
                      aria-invalid={Boolean(fieldError.entityDisregarded)}
                    >
                      <option value="">Select</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </InvestingFormField>
                  <InvestingFormField
                    id="ap-entity-ein"
                    label={
                      <>
                        EIN/Tax ID of entity <span className="contacts_required" aria-hidden>*</span>
                      </>
                    }
                    Icon={Fingerprint}
                    labelSuffix={
                      <FieldHelp
                        label="EIN/Tax ID of entity"
                        tooltip="Employer Identification Number (EIN) of this entity, not a personal SSN, unless the entity is a single-member sole prop reported under your SSN and your team instructs you to use it here."
                      />
                    }
                    error={fieldError.entityEin}
                  >
                    <div className="add_profile_input_wrap">
                      <input
                        id="ap-entity-ein"
                        className={invClass(
                          "deals_add_inv_input deals_add_inv_field_control",
                          Boolean(fieldError.entityEin),
                        )}
                        type={form.entityEinVisible ? "text" : "password"}
                        value={form.entityEin}
                        onChange={(e) => patch({ entityEin: e.target.value }, "entityEin")}
                        autoComplete="off"
                        placeholder="EIN or tax ID"
                        aria-invalid={Boolean(fieldError.entityEin)}
                        aria-label="EIN or tax ID of entity"
                      />
                      <button
                        type="button"
                        className="add_profile_ssn_toggle"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            entityEinVisible: !prev.entityEinVisible,
                          }))
                        }
                        aria-label={
                          form.entityEinVisible ? "Hide EIN" : "Show EIN"
                        }
                      >
                        {form.entityEinVisible ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                    </div>
                  </InvestingFormField>
                </>
              ) : null}

            </div>
          )}

          {step === 2 && isJointTenancy && (
            <div className="add_contact_section" aria-labelledby="ap-jt-heading">
              <p id="ap-jt-heading" className="add_contact_section_eyebrow">
                Profile details
              </p>
              <div className="um_field">
                <div className="um_field_label_row">
                  <IdCard
                    className="um_field_label_icon"
                    size={17}
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  <span className="mail_text_label" id="ap-jt-type-lbl">
                    Profile type <span className="contacts_required" aria-hidden>*</span>
                  </span>
                  <FieldHelp label="Profile type" tooltip="Type of profile" />
                </div>
                <div
                  className="add_profile_readonly_type"
                  aria-labelledby="ap-jt-type-lbl"
                >
                  {PROFILE_TYPE_JOINT_TENANCY}
                </div>
              </div>

              <p className="add_contact_section_eyebrow add_contact_section_eyebrow_spaced">
                Investor 1
              </p>
              <div className="add_contact_name_grid">
                <InvestingFormField
                  id="ap-jt-1-first"
                  label={<>First name <span className="contacts_required" aria-hidden>*</span></>}
                  Icon={UserRound}
                  tight
                  error={fieldError.firstName}
                >
                  <input
                    id="ap-jt-1-first"
                    className={invClass(
                      "deals_add_inv_input deals_add_inv_field_control",
                      Boolean(fieldError.firstName),
                    )}
                    autoComplete="given-name"
                    value={form.firstName}
                    onChange={(e) => patch({ firstName: e.target.value }, "firstName")}
                    placeholder="e.g. Jordan"
                    aria-invalid={Boolean(fieldError.firstName)}
                    aria-describedby={
                      fieldError.firstName ? "ap-jt-1-first-err" : undefined
                    }
                  />
                </InvestingFormField>
                <InvestingFormField
                  id="ap-jt-1-last"
                  label={<>Last name <span className="contacts_required" aria-hidden>*</span></>}
                  Icon={UserRound}
                  tight
                  error={fieldError.lastName}
                >
                  <input
                    id="ap-jt-1-last"
                    className={invClass(
                      "deals_add_inv_input deals_add_inv_field_control",
                      Boolean(fieldError.lastName),
                    )}
                    autoComplete="family-name"
                    value={form.lastName}
                    onChange={(e) => patch({ lastName: e.target.value }, "lastName")}
                    placeholder="e.g. Lee"
                    aria-invalid={Boolean(fieldError.lastName)}
                    aria-describedby={
                      fieldError.lastName ? "ap-jt-1-last-err" : undefined
                    }
                  />
                </InvestingFormField>
              </div>
              <InvestingFormField
                id="ap-jt-1-middle"
                label="Middle name"
                Icon={UserRound}
                tight
              >
                <input
                  id="ap-jt-1-middle"
                  className="deals_add_inv_input deals_add_inv_field_control"
                  value={form.middleName}
                  onChange={(e) => patch({ middleName: e.target.value })}
                  placeholder="Middle name"
                />
              </InvestingFormField>
              <InvestingFormField
                id="ap-jt-1-email"
                label={<>Email address 1 <span className="contacts_required" aria-hidden>*</span></>}
                Icon={Mail}
                tight
                error={fieldError.email1}
              >
                <input
                  id="ap-jt-1-email"
                  className={invClass(
                    "deals_add_inv_input deals_add_inv_field_control",
                    Boolean(fieldError.email1),
                  )}
                  type="email"
                  autoComplete="email"
                  value={form.email1}
                  onChange={(e) => patch({ email1: e.target.value }, "email1")}
                  placeholder="Email"
                  aria-invalid={Boolean(fieldError.email1)}
                  aria-describedby={
                    fieldError.email1 ? "ap-jt-1-email-err" : undefined
                  }
                />
              </InvestingFormField>

              <p className="add_contact_section_eyebrow add_contact_section_eyebrow_spaced">
                Investor 2
              </p>
              <div className="add_contact_name_grid">
                <InvestingFormField
                  id="ap-jt-2-first"
                  label={<>First name 2 <span className="contacts_required" aria-hidden>*</span></>}
                  Icon={UserRound}
                  tight
                  error={fieldError.firstName2}
                >
                  <input
                    id="ap-jt-2-first"
                    className={invClass(
                      "deals_add_inv_input deals_add_inv_field_control",
                      Boolean(fieldError.firstName2),
                    )}
                    value={form.firstName2}
                    onChange={(e) => patch({ firstName2: e.target.value }, "firstName2")}
                    placeholder="e.g. Jordan"
                    aria-invalid={Boolean(fieldError.firstName2)}
                    aria-describedby={
                      fieldError.firstName2 ? "ap-jt-2-first-err" : undefined
                    }
                  />
                </InvestingFormField>
                <InvestingFormField
                  id="ap-jt-2-last"
                  label={<>Last name 2 <span className="contacts_required" aria-hidden>*</span></>}
                  Icon={UserRound}
                  tight
                  error={fieldError.lastName2}
                >
                  <input
                    id="ap-jt-2-last"
                    className={invClass(
                      "deals_add_inv_input deals_add_inv_field_control",
                      Boolean(fieldError.lastName2),
                    )}
                    value={form.lastName2}
                    onChange={(e) => patch({ lastName2: e.target.value }, "lastName2")}
                    placeholder="e.g. Lee"
                    aria-invalid={Boolean(fieldError.lastName2)}
                    aria-describedby={
                      fieldError.lastName2 ? "ap-jt-2-last-err" : undefined
                    }
                  />
                </InvestingFormField>
              </div>
              <InvestingFormField
                id="ap-jt-2-middle"
                label="Middle name 2"
                Icon={UserRound}
                tight
              >
                <input
                  id="ap-jt-2-middle"
                  className="deals_add_inv_input deals_add_inv_field_control"
                  value={form.middleName2}
                  onChange={(e) => patch({ middleName2: e.target.value })}
                  placeholder="Middle name"
                />
              </InvestingFormField>
              <InvestingFormField
                id="ap-jt-2-email"
                label={<>Email address 2 <span className="contacts_required" aria-hidden>*</span></>}
                Icon={Mail}
                tight
                error={fieldError.email2}
              >
                <input
                  id="ap-jt-2-email"
                  className={invClass(
                    "deals_add_inv_input deals_add_inv_field_control",
                    Boolean(fieldError.email2),
                  )}
                  type="email"
                  value={form.email2}
                  onChange={(e) => patch({ email2: e.target.value }, "email2")}
                  placeholder="Email"
                  aria-invalid={Boolean(fieldError.email2)}
                  aria-describedby={
                    fieldError.email2 ? "ap-jt-2-email-err" : undefined
                  }
                />
              </InvestingFormField>
              <InvestingFormField
                id="ap-jt-2-phone"
                label="Phone number 2"
                Icon={Phone}
                tight
              >
                <input
                  id="ap-jt-2-phone"
                  className="deals_add_inv_input deals_add_inv_field_control"
                  type="tel"
                  autoComplete="tel"
                  value={form.phone2}
                  onChange={(e) => patch({ phone2: e.target.value })}
                  placeholder="Phone"
                />
              </InvestingFormField>

              <p className="add_contact_section_eyebrow add_contact_section_eyebrow_spaced">
                Additional details
              </p>
              <InvestingFormField
                id="ap-jt-ssn"
                label={<>SSN <span className="contacts_required" aria-hidden>*</span></>}
                Icon={Fingerprint}
                error={fieldError.ssn}
              >
                <div className="add_profile_input_wrap">
                  <input
                    id="ap-jt-ssn"
                    className={invClass(
                      "deals_add_inv_input deals_add_inv_field_control",
                      Boolean(fieldError.ssn),
                    )}
                    type={ssnVisible ? "text" : "password"}
                    autoComplete="off"
                    value={form.ssn}
                    onChange={(e) => patch({ ssn: e.target.value }, "ssn")}
                    placeholder="___-__-____"
                    aria-invalid={Boolean(fieldError.ssn)}
                    aria-describedby={
                      fieldError.ssn ? "ap-jt-ssn-err" : undefined
                    }
                  />
                  <button
                    type="button"
                    className="add_profile_ssn_toggle"
                    onClick={() => setSsnVisible((v) => !v)}
                    aria-label={ssnVisible ? "Hide SSN" : "Show SSN"}
                  >
                    {ssnVisible ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                </div>
              </InvestingFormField>
              <InvestingFormField
                id="ap-jt-spouse-ssn"
                label="Spouse SSN"
                Icon={Fingerprint}
              >
                <div className="add_profile_input_wrap">
                  <input
                    id="ap-jt-spouse-ssn"
                    className="deals_add_inv_input deals_add_inv_field_control"
                    type={spouseSsnVisible ? "text" : "password"}
                    autoComplete="off"
                    value={form.spouseSsn}
                    onChange={(e) => patch({ spouseSsn: e.target.value })}
                    placeholder="___-__-____"
                  />
                  <button
                    type="button"
                    className="add_profile_ssn_toggle"
                    onClick={() => setSpouseSsnVisible((v) => !v)}
                    aria-label={spouseSsnVisible ? "Hide spouse SSN" : "Show spouse SSN"}
                  >
                    {spouseSsnVisible ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                </div>
              </InvestingFormField>
            </div>
          )}

          {step === 4 && isJointTenancy && (
            <div className="add_contact_section" aria-labelledby="ap-jt-s4">
              <p id="ap-jt-s4" className="add_contact_section_eyebrow">
                Address
              </p>
              <InvestingFormField
                id="ap-jt-tax"
                label={<>Tax address <span className="contacts_required" aria-hidden>*</span></>}
                Icon={MapPin}
                error={fieldError.taxAddressId}
              >
                <SavedAddressSelect
                  id="ap-jt-tax"
                  value={form.taxAddressId}
                  onChange={(v) => patch({ taxAddressId: v }, "taxAddressId")}
                  savedAddresses={savedAddresses}
                  emptyLabel="Select a saved address"
                  ariaLabel="Tax address — select a saved address"
                  invalid={Boolean(fieldError.taxAddressId)}
                />
              </InvestingFormField>
              <div className="um_field">
                <div className="um_field_label_row" style={{ alignItems: "center" }}>
                  <LandPlot
                    className="um_field_label_icon"
                    size={17}
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  <label className="mail_text_label" htmlFor="ap-jt-mailing-mode">
                    Mailing address
                  </label>
                </div>
                <select
                  id="ap-jt-mailing-mode"
                  className="um_field_select deals_add_inv_field_control"
                  value={form.mailingAddressMode}
                  onChange={(e) => {
                    const v = e.target.value as "add_new" | "same_as_tax"
                    setForm((prev) => ({
                      ...prev,
                      mailingAddressMode: v,
                      mailingAddressId: v === "same_as_tax" ? "" : prev.mailingAddressId,
                    }))
                    if (v === "same_as_tax")
                      setFieldError((f) =>
                        f.mailingAddressId ? { ...f, mailingAddressId: undefined } : f,
                      )
                  }}
                >
                  <option value="add_new">Select a saved mailing address</option>
                  <option value="same_as_tax">Same as tax address</option>
                </select>
                {form.mailingAddressMode === "add_new" ? (
                  <div className="add_profile_mailing_search">
                    <SavedAddressSelect
                      id="ap-jt-mailing-addr"
                      value={form.mailingAddressId}
                      onChange={(v) => patch({ mailingAddressId: v }, "mailingAddressId")}
                      savedAddresses={savedAddresses}
                      emptyLabel="Select a saved mailing address"
                      ariaLabel="Mailing address — select a saved address"
                      invalid={Boolean(fieldError.mailingAddressId)}
                    />
                    {fieldError.mailingAddressId ? (
                      <p
                        id="ap-jt-mailing-addr-err"
                        className="um_field_hint um_field_hint_error"
                        role="alert"
                      >
                        {fieldError.mailingAddressId}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {step === 2 && isIndividual && (
            <div className="add_contact_section" aria-labelledby="ap-s2">
              <p id="ap-s2" className="add_contact_section_eyebrow">
                Profile details
              </p>
              <div className="add_contact_name_grid">
                <InvestingFormField
                  id="ap-first"
                  label={<>First name <span className="contacts_required" aria-hidden>*</span></>}
                  Icon={UserRound}
                  tight
                  error={fieldError.firstName}
                >
                  <input
                    id="ap-first"
                    className={invClass(
                      "deals_add_inv_input deals_add_inv_field_control",
                      Boolean(fieldError.firstName),
                    )}
                    autoComplete="given-name"
                    value={form.firstName}
                    onChange={(e) => patch({ firstName: e.target.value }, "firstName")}
                    placeholder="e.g. Jordan"
                    aria-invalid={Boolean(fieldError.firstName)}
                    aria-describedby={fieldError.firstName ? "ap-first-err" : undefined}
                  />
                </InvestingFormField>
                <InvestingFormField
                  id="ap-last"
                  label={<>Last name <span className="contacts_required" aria-hidden>*</span></>}
                  Icon={UserRound}
                  tight
                  error={fieldError.lastName}
                >
                  <input
                    id="ap-last"
                    className={invClass(
                      "deals_add_inv_input deals_add_inv_field_control",
                      Boolean(fieldError.lastName),
                    )}
                    autoComplete="family-name"
                    value={form.lastName}
                    onChange={(e) => patch({ lastName: e.target.value }, "lastName")}
                    placeholder="e.g. Lee"
                    aria-invalid={Boolean(fieldError.lastName)}
                    aria-describedby={fieldError.lastName ? "ap-last-err" : undefined}
                  />
                </InvestingFormField>
              </div>
              <InvestingFormField id="ap-middle" label="Middle name" Icon={UserRound}>
                <input
                  id="ap-middle"
                  className="deals_add_inv_input deals_add_inv_field_control"
                  autoComplete="additional-name"
                  value={form.middleName}
                  onChange={(e) => patch({ middleName: e.target.value })}
                  placeholder="Middle name"
                />
              </InvestingFormField>
              <InvestingFormField
                id="ap-ssn"
                label={<>SSN or ITIN <span className="contacts_required" aria-hidden>*</span></>}
                Icon={Fingerprint}
                error={fieldError.ssn}
              >
                <div className="add_profile_input_wrap">
                  <input
                    id="ap-ssn"
                    className={invClass(
                      "deals_add_inv_input deals_add_inv_field_control",
                      Boolean(fieldError.ssn),
                    )}
                    type={ssnVisible ? "text" : "password"}
                    autoComplete="off"
                    value={form.ssn}
                    onChange={(e) => patch({ ssn: e.target.value }, "ssn")}
                    placeholder="___-__-____"
                    aria-invalid={Boolean(fieldError.ssn)}
                    aria-describedby={fieldError.ssn ? "ap-ssn-err" : undefined}
                  />
                  <button
                    type="button"
                    className="add_profile_ssn_toggle"
                    onClick={() => setSsnVisible((v) => !v)}
                    aria-label={ssnVisible ? "Hide SSN or ITIN" : "Show SSN or ITIN"}
                  >
                    {ssnVisible ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                </div>
              </InvestingFormField>
            </div>
          )}

          {step === 3 &&
            (isIndividual || isJointTenancy || isEntity) && (
            <div className="add_contact_section" aria-labelledby="ap-s3">
              <p id="ap-s3" className="add_contact_section_eyebrow">
                Distributions
              </p>
              <InvestingFormField
                id="ap-dm"
                label={<>Distribution method <span className="contacts_required" aria-hidden>*</span></>}
                Icon={CircleDollarSign}
              >
                <select
                  id="ap-dm"
                  className="um_field_select deals_add_inv_field_control"
                  value={form.distributionMethod}
                  onChange={(e) => {
                    const v = e.target.value as DistributionMethod
                    patch(
                      {
                        distributionMethod: v,
                        ...(v === "check"
                          ? { bankAccountQuery: "" }
                          : { checkPayeeName: "", checkMailingAddressId: "" }),
                      },
                      v === "check"
                        ? "bankAccountQuery"
                        : (["checkPayeeName", "checkMailingAddressId"] as const),
                    )
                  }}
                >
                  <option value="ach">ACH (recommended)</option>
                  <option value="check">Check</option>
                  <option value="other">Other</option>
                </select>
              </InvestingFormField>
              {form.distributionMethod === "check" ? (
                <>
                  <p className="add_profile_sub" style={{ marginBottom: "0.5em" }}>
                    {distributionDetailsHint("check")}
                  </p>
                  <InvestingFormField
                    id="ap-check-payee"
                    label={<>Payee name <span className="contacts_required" aria-hidden>*</span></>}
                    Icon={UserRound}
                    error={fieldError.checkPayeeName}
                  >
                    <input
                      id="ap-check-payee"
                      className={invClass(
                        "deals_add_inv_input deals_add_inv_field_control",
                        Boolean(fieldError.checkPayeeName),
                      )}
                      value={form.checkPayeeName}
                      onChange={(e) =>
                        patch({ checkPayeeName: e.target.value }, "checkPayeeName")
                      }
                      autoComplete="name"
                      placeholder="Name on the check"
                      aria-invalid={Boolean(fieldError.checkPayeeName)}
                      aria-describedby={
                        fieldError.checkPayeeName ? "ap-check-payee-err" : undefined
                      }
                    />
                  </InvestingFormField>
                  <InvestingFormField
                    id="ap-check-mail"
                    label={
                      <>Check mailing address <span className="contacts_required" aria-hidden>*</span></>
                    }
                    Icon={MapPin}
                    error={fieldError.checkMailingAddressId}
                  >
                    <SavedAddressSelect
                      id="ap-check-mail"
                      value={form.checkMailingAddressId}
                      onChange={(v) =>
                        patch({ checkMailingAddressId: v }, "checkMailingAddressId")
                      }
                      savedAddresses={savedAddresses}
                      emptyLabel="Select a saved address for check mailing"
                      ariaLabel="Check mailing address — select a saved address"
                      invalid={Boolean(fieldError.checkMailingAddressId)}
                    />
                  </InvestingFormField>
                </>
              ) : (
                <InvestingFormField
                  id="ap-bank"
                  label={
                    <>
                      {distributionDetailsLabel(form.distributionMethod)}{" "}
                      <span className="contacts_required" aria-hidden>*</span>
                    </>
                  }
                  Icon={Search}
                  error={fieldError.bankAccountQuery}
                >
                  <span className="add_profile_sub">
                    {distributionDetailsHint(form.distributionMethod)}
                  </span>
                  <div className="add_profile_search_wrap">
                    <Search
                      className="add_profile_search_icon"
                      size={16}
                      strokeWidth={2}
                      aria-hidden
                    />
                    <input
                      id="ap-bank"
                      className={invClass(
                        "deals_add_inv_input deals_add_inv_field_control add_profile_search",
                        Boolean(fieldError.bankAccountQuery),
                      )}
                      value={form.bankAccountQuery}
                      onChange={(e) =>
                        patch({ bankAccountQuery: e.target.value }, "bankAccountQuery")
                      }
                      placeholder={distributionDetailsPlaceholder(
                        form.distributionMethod,
                      )}
                      autoComplete="off"
                      aria-label={distributionDetailsInputAria(form.distributionMethod)}
                      aria-invalid={Boolean(fieldError.bankAccountQuery)}
                      aria-describedby={
                        fieldError.bankAccountQuery ? "ap-bank-err" : undefined
                      }
                    />
                  </div>
                </InvestingFormField>
              )}
            </div>
          )}

          {step === 4 && (isIndividual || isEntity) && (
            <div className="add_contact_section" aria-labelledby="ap-s4">
              <p id="ap-s4" className="add_contact_section_eyebrow">
                Address
              </p>
              <InvestingFormField
                id="ap-tax-addr"
                label={<>Tax address <span className="contacts_required" aria-hidden>*</span></>}
                Icon={MapPin}
                error={fieldError.taxAddressId}
              >
                <SavedAddressSelect
                  id="ap-tax-addr"
                  value={form.taxAddressId}
                  onChange={(v) => patch({ taxAddressId: v }, "taxAddressId")}
                  savedAddresses={savedAddresses}
                  emptyLabel="Select a saved address"
                  ariaLabel="Tax address — select a saved address"
                  invalid={Boolean(fieldError.taxAddressId)}
                />
              </InvestingFormField>
              <InvestingFormField id="ap-mail-addr" label="Mailing address" Icon={MapPin}>
                <SavedAddressSelect
                  id="ap-mail-addr"
                  value={form.mailingAddressId}
                  onChange={(v) => patch({ mailingAddressId: v })}
                  savedAddresses={savedAddresses}
                  emptyLabel="Optional — select a saved address"
                  ariaLabel="Mailing address — select a saved address (optional)"
                />
              </InvestingFormField>
            </div>
          )}

          {step === 5 && hasBeneficiaryStep && (
            <div className="add_contact_section" aria-labelledby="ap-s5">
              <p id="ap-s5" className="add_contact_section_eyebrow">
                Beneficiary info
              </p>
              <p className="add_profile_sub add_profile_ben_lead">
                Choose a saved beneficiary, or continue without one. If the list is empty, add
                one under the <strong>Beneficiaries</strong> tab, then return to this step.
              </p>
              <div className="um_field">
                <div className="um_field_label_row" style={{ alignItems: "center" }}>
                  <UserPlus
                    className="um_field_label_icon"
                    size={17}
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  <span className="mail_text_label" id="ap-ben-label">
                    Beneficiary
                  </span>
                  <FieldHelp
                    label="Beneficiary"
                    tooltip={BENEFICIARY_LEGAL_DISCLAIMER}
                  />
                </div>
                <SavedBeneficiarySelect
                  id="ap-ben-saved"
                  value={form.beneficiaryPickId}
                  onChange={(nextId) => {
                    if (!nextId) {
                      patch({ beneficiary: null, beneficiaryPickId: "" })
                      return
                    }
                    const row = activeSavedBeneficiaries.find((b) => b.id === nextId)
                    if (row) {
                      patch({
                        beneficiary: beneficiaryToDraft(row),
                        beneficiaryPickId: nextId,
                      })
                    }
                  }}
                  rows={activeSavedBeneficiaries}
                  emptyLabel="No beneficiary (optional)"
                  ariaLabel="Designated beneficiary — choose a saved beneficiary"
                />
                {form.beneficiary ? (
                  <p
                    className="add_profile_ben_sub"
                    style={{ marginTop: "0.45em" }}
                    aria-live="polite"
                  >
                    {[form.beneficiary.email, form.beneficiary.phone]
                      .map((s) => String(s ?? "").trim())
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : null}
              </div>
            </div>
          )}

          {isEdit && step === totalSteps && (
            <div className="add_contact_section" aria-labelledby="ap-s6-reason">
              <p id="ap-s6-reason" className="add_contact_section_eyebrow">
                {EDIT_WIZARD_REASON_LABEL}
              </p>
              <p className="add_profile_sub" style={{ marginBottom: "0.65em" }}>
                Required. This note is stored on the profile for the audit log.
              </p>
              <div className="um_field">
                <label className="um_field_label_row" htmlFor="ap-reason-ta">
                  <FileText
                    className="um_field_label_icon"
                    size={17}
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  <span>Change notes</span>
                </label>
                <textarea
                  id="ap-reason-ta"
                  className={invClass(
                    "deals_add_inv_input deals_add_inv_field_control",
                    Boolean(lastEditReasonError),
                  )}
                  rows={5}
                  value={lastEditReason}
                  onChange={(e) => {
                    setLastEditReason(e.target.value)
                    setLastEditReasonError(null)
                  }}
                  placeholder="Describe why you are saving these changes (e.g. new bank details, name correction, …)"
                  autoComplete="off"
                  aria-invalid={Boolean(lastEditReasonError)}
                  aria-describedby={lastEditReasonError ? "ap-reason-err" : undefined}
                />
                {lastEditReasonError ? (
                  <p id="ap-reason-err" className="um_field_hint um_field_hint_error" role="alert">
                    {lastEditReasonError}
                  </p>
                ) : null}
              </div>
            </div>
          )}
          </div>

        <div
          className={
            isPage
              ? "um_modal_actions deal_inv_ic_add_panel_actions deals_add_deal_asset_footer_actions"
              : "um_modal_actions add_contact_modal_actions"
          }
        >
          <button
            type="button"
            className="um_btn_secondary"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} strokeWidth={2} aria-hidden />
            Cancel
          </button>
          <div className="add_contact_modal_actions_trailing">
            {((isIndividual || isJointTenancy || isEntity) && step > 1) && (
              <button
                type="button"
                className="um_btn_secondary"
                onClick={() => {
                  if (isEdit && step === totalSteps) setLastEditReasonError(null)
                  goBack()
                }}
              >
                <ArrowLeft size={16} strokeWidth={2} aria-hidden />
                Back
              </button>
            )}
            {step < totalSteps &&
              (step === 1 ||
                isIndividual ||
                isJointTenancy ||
                isEntity) && (
              <button
                type="button"
                className="um_btn_primary"
                onClick={() => void goNext()}
              >
                Next
                <ChevronRight size={18} strokeWidth={2} aria-hidden />
              </button>
            )}
            {((isIndividual || isJointTenancy || isEntity) &&
              step === addFlowLastContentStep &&
              !isEdit) && (
              <button
                type="button"
                className="um_btn_primary"
                onClick={() => void handleSubmit()}
              >
                <UserPlus size={18} strokeWidth={2} aria-hidden />
                Add profile
              </button>
            )}
            {isEdit && step === totalSteps && (isIndividual || isJointTenancy || isEntity) && (
              <button type="button" className="um_btn_primary" onClick={() => void handleEditSave()}>
                <Save size={18} strokeWidth={2} aria-hidden />
                Save changes
              </button>
            )}
          </div>
        </div>
        </form>
    )

    if (isPage) return formNode

    return (
      <div
        className={`um_modal um_modal_view deals_add_inv_modal_panel add_contact_panel investing_add_profile_form_panel${
          isListInline ? " investing_add_profile_form_panel--inline" : ""
        }`}
        role={isListInline ? "region" : "dialog"}
        aria-modal={isListInline ? undefined : true}
        aria-labelledby="add-profile-modal-title"
        aria-describedby="add-profile-step-label"
        onClick={isListInline ? undefined : (e) => e.stopPropagation()}
      >
        <div className="um_modal_head add_contact_modal_head">
          <div className="add_contact_modal_head_main">
            <h3
              id="add-profile-modal-title"
              className="um_modal_title add_contact_modal_title"
            >
              {isEdit ? "Edit profile" : "Add profile"}
            </h3>
            <div
              className="add_contact_stepper"
              role="group"
              aria-label="Progress"
            >
              {stepperGroup()}
            </div>
          </div>
          <button
            type="button"
            className="um_modal_close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} strokeWidth={2} aria-hidden />
          </button>
        </div>
        {formNode}
      </div>
    )
  }

  if (isPage) {
    return (
      <>
        <div className="deals_list_page deals_detail_page deals_add_investor_class_page deals_add_deal_asset_page deals_create_flow">
          <header className="deals_list_head deals_add_investor_class_page_head deals_create_page_head">
            <div className="deals_add_deal_asset_head_main deals_create_head_main">
              <div className="deals_list_title_row deals_add_deal_asset_title_row">
                <button
                  type="button"
                  className="deals_list_back_circle"
                  onClick={onClose}
                  aria-label="Back to profiles"
                >
                  <ArrowLeft size={20} strokeWidth={2} aria-hidden />
                </button>
                <div className="deals_add_deal_asset_title_stack">
                  <h1 id={addProfilePageTitleId} className="deals_list_title">
                    {isEdit ? "Edit profile" : "Add profile"}
                  </h1>
                  <p className="deals_create_subtitle">{addProfilePageSubtitle}</p>
                </div>
              </div>
              <div
                className="add_contact_stepper deals_add_deal_asset_stepper deals_create_stepper"
                role="group"
                aria-label={isEdit ? "Edit profile steps" : "Add profile steps"}
              >
                {stepperGroup()}
              </div>
            </div>
          </header>

          <section
            className="deals_create_deal_section"
            aria-labelledby={addProfilePageTitleId}
          >
            {renderFormPanel()}
          </section>
        </div>
      </>
    )
  }

  return (
  <>
  {isListInline ? (
    <section
      className="investing_add_profile_inline_root"
      aria-label={isEdit ? "Edit profile" : "Add profile"}
    >
      {renderFormPanel()}
    </section>
  ) : createPortal(
    <div
      className="um_modal_overlay deals_add_inv_modal_overlay portal_modal_z_boost"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {renderFormPanel()}
    </div>,
    document.body,
  )}
  </>
  )
}
