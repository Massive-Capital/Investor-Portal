import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import {
  ArrowLeft,
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
  Pencil,
  Phone,
  Search,
  Trash2,
  UserPlus,
  UserRound,
  X,
} from "lucide-react"
import { toast } from "@/common/components/Toast"
import { AddBeneficiaryModal, type BeneficiaryDraft } from "./AddBeneficiaryModal"
import { BENEFICIARY_LEGAL_DISCLAIMER } from "./beneficiary-legal"
import { InvestingFormField } from "./InvestingFormField"
import { formatSavedAddressLabel, type SavedAddress } from "./address.types"
import type { NewInvestorProfilePayload } from "./investor-profiles.types"
import "@/modules/Syndication/InvestorPortal/Deals/deal-members/add-investment/add_deal_modal.css"
import "@/modules/contacts/contacts.css"
import "@/modules/usermanagement/user_management.css"
import "./add-investor-profile-modal.css"
import "./investing-profiles-form-modals.css"

const PROFILE_TYPE_INDIVIDUAL = "Individual"
const PROFILE_TYPE_JOINT_TENANCY = "Joint tenancy"
const PROFILE_TYPE_ENTITY = "Entity"
const TOTAL_STEPS_INDIVIDUAL = 5
const TOTAL_STEPS_JOINT = 2
const TOTAL_STEPS_ENTITY = 2

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

const STEP_HEADINGS = [
  "Profile type",
  "Profile details",
  "Distributions",
  "Address",
  "Beneficiary",
] as const

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
}

type FormState = typeof initialState

const REQUIRED_MSG = "This field is required."

type AddProfileFieldErrorKey =
  | "profileType"
  | "entitySubType"
  | "entityLegalName"
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

interface AddInvestorProfileModalProps {
  open: boolean
  onClose: () => void
  /** Saved addresses from the Address tab, shown in tax / mailing dropdowns. */
  savedAddresses?: SavedAddress[]
  /** Fired with display fields after validation; parent may persist the profile. May return a Promise. */
  onProfileCreated?: (p: NewInvestorProfilePayload) => void | Promise<void>
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

export function AddInvestorProfileModal({
  open,
  onClose,
  savedAddresses = [],
  onProfileCreated,
}: AddInvestorProfileModalProps) {
  const [form, setForm] = useState<FormState>(initialState)
  const [fieldError, setFieldError] = useState<AddProfileFieldErrors>({})
  const [ssnVisible, setSsnVisible] = useState(false)
  const [spouseSsnVisible, setSpouseSsnVisible] = useState(false)
  const [benModalOpen, setBenModalOpen] = useState(false)
  const [step, setStep] = useState(1)

  const isIndividual = form.profileType === PROFILE_TYPE_INDIVIDUAL
  const isJointTenancy = form.profileType === PROFILE_TYPE_JOINT_TENANCY
  const isEntity = form.profileType === PROFILE_TYPE_ENTITY
  const totalSteps = isIndividual
    ? TOTAL_STEPS_INDIVIDUAL
    : isJointTenancy
      ? TOTAL_STEPS_JOINT
      : isEntity
        ? TOTAL_STEPS_ENTITY
        : 1
  const effectiveMaxStep = totalSteps

  const stepHeading = useMemo(() => {
    if (step === 1) return "Profile type"
    if (isEntity && step === 2) return "Entity or plan details"
    if (isJointTenancy) return "Profile details"
    return (
      STEP_HEADINGS[Math.min(Math.max(step, 1), TOTAL_STEPS_INDIVIDUAL) - 1] ??
      "Add profile"
    )
  }, [step, isJointTenancy, isEntity])

  const stepperLabels = useMemo((): string[] => {
    if (totalSteps === 1) return [STEP_HEADINGS[0]]
    if (isIndividual) return [...STEP_HEADINGS]
    if (isJointTenancy) return [STEP_HEADINGS[0], STEP_HEADINGS[1]]
    if (isEntity) return [STEP_HEADINGS[0], "Entity or plan details"]
    return [STEP_HEADINGS[0]]
  }, [totalSteps, isIndividual, isJointTenancy, isEntity])

  useEffect(() => {
    if (!open) return
    setForm(initialState)
    setFieldError({})
    setSsnVisible(false)
    setSpouseSsnVisible(false)
    setBenModalOpen(false)
    setStep(1)
  }, [open])

  useEffect(() => {
    if (!isIndividual && !isJointTenancy && !isEntity && step > 1) setStep(1)
  }, [isIndividual, isJointTenancy, isEntity, step])

  useEffect(() => {
    if (!open || benModalOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose, benModalOpen])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

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
        if (!form.entitySubType.trim()) err.entitySubType = REQUIRED_MSG
        if (!form.entityLegalName.trim()) {
          err.entityLegalName = "Enter the legal name of the entity or the plan name."
        }
      }
      addDistributionValidationErrors(form, err)
      if (!form.taxAddressId.trim()) {
        err.taxAddressId = "Select a tax address, or add one in the Address tab first."
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
      addDistributionValidationErrors(form, err)
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
    if (step === 2 && isIndividual) {
      const err: AddProfileFieldErrors = {}
      if (!form.firstName.trim()) err.firstName = REQUIRED_MSG
      if (!form.lastName.trim()) err.lastName = REQUIRED_MSG
      if (!form.ssn.trim()) err.ssn = REQUIRED_MSG
      setFieldError(err)
      return Object.keys(err).length === 0
    }
    if (step === 3) {
      const err: AddProfileFieldErrors = {}
      addDistributionValidationErrors(form, err)
      setFieldError(err)
      return Object.keys(err).length === 0
    }
    if (step === 4) {
      const err: AddProfileFieldErrors = {}
      if (!form.taxAddressId.trim()) {
        err.taxAddressId = "Select a tax address, or add one in the Address tab first."
      }
      setFieldError(err)
      return Object.keys(err).length === 0
    }
    setFieldError(noErr)
    return true
  }, [step, form, isIndividual, isJointTenancy, isEntity])

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
      ...(value !== PROFILE_TYPE_ENTITY
        ? {
            entitySubType: "",
            entityLegalName: "",
            custodianIra: "" as const,
            legalIraName: "",
            iraCompany: "",
            federalTaxClassification: "",
            iraPartnerEin: "",
            iraCustodianEin: "",
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

  function handleSubmit() {
    if (isJointTenancy) {
      if (step !== 2 || !validateStep()) return
    } else if (isIndividual) {
      if (step !== TOTAL_STEPS_INDIVIDUAL) return
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
        return
      }
    } else if (isEntity) {
      if (step !== 2 || !validateStep()) return
    } else {
      setFieldError({
        profileType: "Choose a profile type to continue.",
      })
      return
    }

    const payload: NewInvestorProfilePayload = {
      profileName: buildDisplayProfileName(form),
      profileType: form.profileType,
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

  if (!open) return null

  return (
  <>
  {createPortal(
    <div
      className="um_modal_overlay deals_add_inv_modal_overlay portal_modal_z_boost"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="um_modal um_modal_view deals_add_inv_modal_panel add_contact_panel investing_add_profile_form_panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-profile-modal-title"
        aria-describedby="add-profile-step-label"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="um_modal_head add_contact_modal_head">
          <div className="add_contact_modal_head_main">
            <h3
              id="add-profile-modal-title"
              className="um_modal_title add_contact_modal_title"
            >
              Add profile
            </h3>
            <div
              className="add_contact_stepper"
              role="group"
              aria-label="Progress"
            >
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

        <form
          className="deals_add_inv_modal_form"
          onSubmit={(e) => e.preventDefault()}
          noValidate
        >
          <div className="deals_add_inv_modal_scroll">
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
                Entity or plan details
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
                          entitySubType: "",
                          entityLegalName: "",
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
                    id="ap-entity-legal"
                    label={
                      <>
                        Legal name <span className="contacts_required" aria-hidden>*</span>
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
                      placeholder="Legal entity name, trust name, or plan name"
                      autoComplete="organization"
                      aria-invalid={Boolean(fieldError.entityLegalName)}
                      aria-describedby={
                        fieldError.entityLegalName ? "ap-entity-legal-err" : undefined
                      }
                    />
                  </InvestingFormField>
                </>
              ) : null}

              <p
                className="add_contact_section_eyebrow add_contact_section_eyebrow_spaced"
                style={{ marginTop: "1.25em" }}
              >
                Distributions
              </p>
              <InvestingFormField
                id="ap-ent-dm"
                label={<>Distribution method <span className="contacts_required" aria-hidden>*</span></>}
                Icon={CircleDollarSign}
              >
                <select
                  id="ap-ent-dm"
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
                    id="ap-ent-check-payee"
                    label={<>Payee name <span className="contacts_required" aria-hidden>*</span></>}
                    Icon={UserRound}
                    error={fieldError.checkPayeeName}
                  >
                    <input
                      id="ap-ent-check-payee"
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
                        fieldError.checkPayeeName ? "ap-ent-check-payee-err" : undefined
                      }
                    />
                  </InvestingFormField>
                  <InvestingFormField
                    id="ap-ent-check-mail"
                    label={
                      <>Check mailing address <span className="contacts_required" aria-hidden>*</span></>
                    }
                    Icon={MapPin}
                    error={fieldError.checkMailingAddressId}
                  >
                    <SavedAddressSelect
                      id="ap-ent-check-mail"
                      value={form.checkMailingAddressId}
                      onChange={(v) =>
                        patch({ checkMailingAddressId: v }, "checkMailingAddressId")
                      }
                      savedAddresses={savedAddresses}
                      emptyLabel="Search"
                      ariaLabel="Check mailing address — select a saved address"
                      invalid={Boolean(fieldError.checkMailingAddressId)}
                    />
                  </InvestingFormField>
                </>
              ) : (
                <InvestingFormField
                  id="ap-ent-bank"
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
                      id="ap-ent-bank"
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
                        fieldError.bankAccountQuery ? "ap-ent-bank-err" : undefined
                      }
                    />
                  </div>
                </InvestingFormField>
              )}

              <p
                className="add_contact_section_eyebrow add_contact_section_eyebrow_spaced"
                style={{ marginTop: "1.25em" }}
              >
                Address
              </p>
              <InvestingFormField
                id="ap-ent-tax-addr"
                label={<>Tax address <span className="contacts_required" aria-hidden>*</span></>}
                Icon={MapPin}
                error={fieldError.taxAddressId}
              >
                <SavedAddressSelect
                  id="ap-ent-tax-addr"
                  value={form.taxAddressId}
                  onChange={(v) => patch({ taxAddressId: v }, "taxAddressId")}
                  savedAddresses={savedAddresses}
                  emptyLabel="Search"
                  ariaLabel="Tax address — select a saved address"
                  invalid={Boolean(fieldError.taxAddressId)}
                />
              </InvestingFormField>
              <InvestingFormField
                id="ap-ent-mail-addr"
                label="Mailing address"
                Icon={MapPin}
              >
                <SavedAddressSelect
                  id="ap-ent-mail-addr"
                  value={form.mailingAddressId}
                  onChange={(v) => patch({ mailingAddressId: v })}
                  savedAddresses={savedAddresses}
                  emptyLabel="Search"
                  ariaLabel="Mailing address — select a saved address (optional)"
                />
              </InvestingFormField>
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

              <p className="add_contact_section_eyebrow add_contact_section_eyebrow_spaced">
                Distributions
              </p>
              <InvestingFormField
                id="ap-jt-dm"
                label={<>Distribution method <span className="contacts_required" aria-hidden>*</span></>}
                Icon={CircleDollarSign}
              >
                <select
                  id="ap-jt-dm"
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
                    id="ap-jt-check-payee"
                    label={<>Payee name <span className="contacts_required" aria-hidden>*</span></>}
                    Icon={UserRound}
                    error={fieldError.checkPayeeName}
                  >
                    <input
                      id="ap-jt-check-payee"
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
                        fieldError.checkPayeeName ? "ap-jt-check-payee-err" : undefined
                      }
                    />
                  </InvestingFormField>
                  <InvestingFormField
                    id="ap-jt-check-mail"
                    label={
                      <>Check mailing address <span className="contacts_required" aria-hidden>*</span></>
                    }
                    Icon={MapPin}
                    error={fieldError.checkMailingAddressId}
                  >
                    <SavedAddressSelect
                      id="ap-jt-check-mail"
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
                  id="ap-jt-bank"
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
                      id="ap-jt-bank"
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
                        fieldError.bankAccountQuery ? "ap-jt-bank-err" : undefined
                      }
                    />
                  </div>
                </InvestingFormField>
              )}

              <p className="add_contact_section_eyebrow add_contact_section_eyebrow_spaced">
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

          {step === 3 && isIndividual && (
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

          {step === 4 && isIndividual && (
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

          {step === 5 && isIndividual && (
            <div className="add_contact_section" aria-labelledby="ap-s5">
              <p id="ap-s5" className="add_contact_section_eyebrow">
                Beneficiary info
              </p>
              <p className="add_profile_sub add_profile_ben_lead">
                Add a beneficiary now, or continue without one. You can add one later from your
                account.
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
                {form.beneficiary ? (
                  <div
                    className="add_profile_ben_row"
                    aria-labelledby="ap-ben-label"
                  >
                    <p className="add_profile_ben_text">
                      <strong>{form.beneficiary.fullName}</strong>
                      <span className="add_profile_ben_sub">
                        {[form.beneficiary.relationship, form.beneficiary.email]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </p>
                    <div>
                      <button
                        type="button"
                        className="add_profile_ben_link"
                        onClick={() => setBenModalOpen(true)}
                      >
                        <Pencil size={14} strokeWidth={2} aria-hidden />
                        Edit
                      </button>
                      <button
                        type="button"
                        className="add_profile_ben_link"
                        onClick={() => patch({ beneficiary: null })}
                      >
                        <Trash2 size={14} strokeWidth={2} aria-hidden />
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="add_profile_ben_add"
                    onClick={() => setBenModalOpen(true)}
                  >
                    <UserPlus size={16} strokeWidth={2} aria-hidden />
                    Add beneficiary
                  </button>
                )}
              </div>
            </div>
          )}
          </div>

        <div className="um_modal_actions add_contact_modal_actions">
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
            {((isIndividual && step > 1) ||
              (isJointTenancy && step > 1) ||
              (isEntity && step > 1)) && (
              <button
                type="button"
                className="um_btn_secondary"
                onClick={goBack}
              >
                <ArrowLeft size={16} strokeWidth={2} aria-hidden />
                Back
              </button>
            )}
            {((isIndividual && step < TOTAL_STEPS_INDIVIDUAL) ||
              (isJointTenancy && step === 1) ||
              (isEntity && step === 1)) && (
              <button
                type="button"
                className="um_btn_primary"
                onClick={() => void goNext()}
              >
                Next
                <ChevronRight size={18} strokeWidth={2} aria-hidden />
              </button>
            )}
            {((isIndividual && step === TOTAL_STEPS_INDIVIDUAL) ||
              (isJointTenancy && step === 2) ||
              (isEntity && step === 2)) && (
              <button
                type="button"
                className="um_btn_primary"
                onClick={() => void handleSubmit()}
              >
                <UserPlus size={18} strokeWidth={2} aria-hidden />
                Add profile
              </button>
            )}
          </div>
        </div>
        </form>
      </div>
    </div>,
    document.body,
  )}
  <AddBeneficiaryModal
    open={benModalOpen}
    onClose={() => setBenModalOpen(false)}
    initial={form.beneficiary}
    onSave={(b) => {
      patch({ beneficiary: b })
    }}
  />
  </>
  )
}
