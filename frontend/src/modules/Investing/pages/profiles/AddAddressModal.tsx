import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  FileText,
  Globe,
  Hash,
  Info,
  MapPin,
  MapPinned,
  MessageSquare,
  X,
} from "lucide-react"
import { toast } from "@/common/components/Toast"
import { useUsCountriesNowLocations } from "@/modules/Syndication/InvestorPortal/Deals/hooks/useUsCountriesNowLocations"
import {
  getUsCitiesForStateCode,
  getUsStateDropdownOptions,
  isUnitedStatesCountry,
  resolveUsStateCodeForDraft,
} from "@/modules/Syndication/InvestorPortal/Deals/constants/usLocations"
import { DealsCreateDropdownSelect } from "@/modules/Syndication/InvestorPortal/Deals/components/DealsCreateDropdownSelect"
import {
  COUNTRY_OPTIONS,
  DEFAULT_ASSET_COUNTRY,
} from "@/modules/Syndication/InvestorPortal/Deals/types/deals.types"
import { normalizeZipCodeDigits, zipCodeFieldError } from "@/modules/Syndication/InvestorPortal/Deals/utils/dealZipCode"
import type { AddressFormDraft } from "./address.types"
import { InvestingFormField } from "./InvestingFormField"
import "@/modules/Syndication/InvestorPortal/Deals/components/add-investment-modal.css"
import "@/modules/contacts/contacts.css"
import "@/modules/usermanagement/user_management.css"
import "./add-investor-profile-modal.css"
import "./investing-profiles-form-modals.css"

const empty: AddressFormDraft = {
  fullNameOrCompany: "",
  country: DEFAULT_ASSET_COUNTRY,
  street1: "",
  street2: "",
  city: "",
  state: "",
  zip: "",
  checkMemo: "",
  distributionNote: "",
}

/** Match Add deal asset step: CountriesNow for US state/city when available, static JSON fallback. */
const US_LOCATION_SOURCE: "static" | "countriesNow" = "countriesNow"

const TOTAL_STEPS = 2
const STEPPER_LABELS = ["Address", "Check memo & distribution"] as const

function AddrFieldHelp({
  label,
  tooltip,
}: {
  label: string
  tooltip: string
}) {
  return (
    <button
      type="button"
      className="investing_field_hint"
      aria-label={`${label} — ${tooltip}`}
      title={tooltip}
    >
      <Info size={16} strokeWidth={1.75} aria-hidden />
    </button>
  )
}

interface AddAddressModalProps {
  open: boolean
  onClose: () => void
  onSave: (a: AddressFormDraft) => void
  /** Prefill (e.g. when editing a saved address). */
  initialDraft?: AddressFormDraft | null
  isEdit?: boolean
}

export function AddAddressModal({
  open,
  onClose,
  onSave,
  initialDraft = null,
  isEdit = false,
}: AddAddressModalProps) {
  const [form, setForm] = useState<AddressFormDraft>(empty)
  const [step, setStep] = useState(1)

  const patch = useCallback((p: Partial<AddressFormDraft>) => {
    setForm((prev) => ({ ...prev, ...p }))
  }, [])

  const isUs = isUnitedStatesCountry(form.country)
  const usStateCode = useMemo(
    () => (isUs ? resolveUsStateCodeForDraft(form.state) : ""),
    [isUs, form.state],
  )

  const countriesNow = useUsCountriesNowLocations({
    enabled: isUs && US_LOCATION_SOURCE === "countriesNow",
    selectedStateCode: usStateCode,
    selectedCity: form.city,
  })

  const usStateOptions = useMemo(() => {
    if (!isUs) return []
    if (US_LOCATION_SOURCE === "static") return getUsStateDropdownOptions()
    if (countriesNow.stateOptions.length > 0) return countriesNow.stateOptions
    return getUsStateDropdownOptions()
  }, [isUs, countriesNow.stateOptions])

  const usCityOptions = useMemo(() => {
    if (!isUs || !usStateCode) return []
    if (US_LOCATION_SOURCE === "static") {
      const list = getUsCitiesForStateCode(usStateCode)
      const c = form.city.trim()
      if (c && !list.includes(c)) return [...list, c].sort((a, b) => a.localeCompare(b))
      return list
    }
    return countriesNow.cityNames
  }, [isUs, usStateCode, US_LOCATION_SOURCE, countriesNow.cityNames, form.city])

  const usStatesLoading =
    isUs &&
    US_LOCATION_SOURCE === "countriesNow" &&
    countriesNow.statesLoading &&
    countriesNow.stateOptions.length === 0
  const usCitiesLoading =
    isUs && US_LOCATION_SOURCE === "countriesNow" && usStateCode && countriesNow.citiesLoading

  useEffect(() => {
    if (!isUs || !form.state?.trim()) return
    const code = resolveUsStateCodeForDraft(form.state)
    if (code && code !== form.state) patch({ state: code })
  }, [isUs, form.state, patch])

  const stepHeading = useMemo(
    () => (step === 1 ? "Address" : "Check memo & distribution"),
    [step],
  )

  useEffect(() => {
    if (!open) return
    if (initialDraft) {
      setForm({
        ...empty,
        ...initialDraft,
        country: (initialDraft.country || DEFAULT_ASSET_COUNTRY).trim() || DEFAULT_ASSET_COUNTRY,
      })
    } else {
      setForm({ ...empty })
    }
    setStep(1)
  }, [open, initialDraft])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  const validateAddressStep = useCallback((): boolean => {
    if (!form.fullNameOrCompany.trim()) {
      toast.error("Name required", "Enter a full name or company name.")
      return false
    }
    if (!form.street1.trim()) {
      toast.error("Address incomplete", "Enter street address line 1.")
      return false
    }
    if (isUs) {
      if (!usStateCode) {
        toast.error("State required", "Select a state.")
        return false
      }
      if (!form.city.trim()) {
        toast.error("City required", "Select or enter a city.")
        return false
      }
      if (
        usCityOptions.length > 0 &&
        !usCityOptions.includes(form.city.trim())
      ) {
        toast.error("City required", "Choose a city from the list for the selected state.")
        return false
      }
      if (!form.zip.trim()) {
        toast.error("Zip code", "Enter a 5-digit zip code.")
        return false
      }
      const zipErr = zipCodeFieldError(form.zip)
      if (zipErr) {
        toast.error("Zip code", zipErr)
        return false
      }
    } else {
      if (!form.state.trim() || !form.city.trim() || !form.zip.trim()) {
        toast.error("Address incomplete", "Fill in state, city, and zip.")
        return false
      }
    }
    return true
  }, [form, isUs, usStateCode, usCityOptions])

  const goNext = useCallback(() => {
    if (step !== 1) return
    if (!validateAddressStep()) return
    setStep(2)
  }, [step, validateAddressStep])

  const goBack = useCallback(() => {
    setStep(1)
  }, [])

  function handleAdd() {
    if (!validateAddressStep()) {
      if (step === 2) setStep(1)
      return
    }

    onSave({
      ...form,
      fullNameOrCompany: form.fullNameOrCompany.trim(),
      street1: form.street1.trim(),
      street2: form.street2.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      zip: isUs ? normalizeZipCodeDigits(form.zip) : form.zip.trim(),
      checkMemo: form.checkMemo.trim(),
      distributionNote: form.distributionNote.trim(),
    })
    onClose()
  }

  if (!open) return null

  return createPortal(
    <div
      className="um_modal_overlay deals_add_inv_modal_overlay investing_ben_modal_overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="um_modal um_modal_view deals_add_inv_modal_panel add_contact_panel investing_add_profile_form_panel investing_add_beneficiary_form_panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-address-title"
        aria-describedby="add-address-step-label"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="um_modal_head add_contact_modal_head">
          <div className="add_contact_modal_head_main">
            <h2
              id="add-address-title"
              className="um_modal_title add_contact_modal_title"
            >
              {isEdit ? "Edit address" : "Add address"}
            </h2>
            <div
              className="add_contact_stepper"
              role="group"
              aria-label="Form progress"
            >
              <p id="add-address-step-label" className="add_profile_sronly">
                Step {step} of {TOTAL_STEPS}: {stepHeading}
              </p>
              {STEPPER_LABELS.map((label, i) => {
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
          onSubmit={(e) => {
            e.preventDefault()
            if (step === 1) {
              goNext()
              return
            }
            handleAdd()
          }}
          noValidate
        >
          <div className="deals_add_inv_modal_scroll">
            {step === 1 ? (
            <div className="add_contact_name_grid add_beneficiary_field_grid">
              <InvestingFormField
                id="addr-name"
                label={
                  <>
                    Full name/Company name{" "}
                    <span className="investing_form_req" aria-label="required">
                      *
                    </span>
                  </>
                }
                Icon={Building2}
                tight
              >
                <input
                  id="addr-name"
                  className="deals_add_inv_input deals_add_inv_field_control"
                  value={form.fullNameOrCompany}
                  onChange={(e) => patch({ fullNameOrCompany: e.target.value })}
                  placeholder="Enter full name or company name"
                  autoComplete="name"
                />
              </InvestingFormField>

              <InvestingFormField
                id="addr-country"
                label={
                  <>
                    Country{" "}
                    <span className="investing_form_req" aria-label="required">
                      *
                    </span>
                  </>
                }
                Icon={Globe}
                tight
              >
                <DealsCreateDropdownSelect
                  options={COUNTRY_OPTIONS.map((o) => ({
                    value: o.value,
                    label: o.label,
                  }))}
                  value={form.country}
                  onChange={(next) => {
                    const wasUs = isUnitedStatesCountry(form.country)
                    const nowUs = isUnitedStatesCountry(next)
                    if (!wasUs && nowUs) {
                      patch({
                        country: next,
                        state: resolveUsStateCodeForDraft(form.state) || "",
                        city: "",
                      })
                    } else {
                      patch({ country: next })
                    }
                  }}
                  searchable
                  searchPlaceholder="Search countries…"
                  searchAriaLabel="Filter country list"
                  searchShowOptionCountHint
                  triggerClassName="deals_add_inv_field_control"
                  placeholder="Select country"
                />
              </InvestingFormField>

              <div className="add_beneficiary_field_grid__full">
                <InvestingFormField
                  id="addr-line1"
                  label={
                    <>
                      Street address line 1{" "}
                      <span className="investing_form_req" aria-label="required">
                        *
                      </span>
                    </>
                  }
                  Icon={MapPin}
                >
                  <input
                    id="addr-line1"
                    className="deals_add_inv_input deals_add_inv_field_control"
                    value={form.street1}
                    onChange={(e) => patch({ street1: e.target.value })}
                    placeholder="Enter address line 1"
                    autoComplete="address-line1"
                  />
                </InvestingFormField>
              </div>

              <div className="add_beneficiary_field_grid__full">
                <InvestingFormField id="addr-line2" label="Street address line 2" Icon={MapPinned}>
                  <input
                    id="addr-line2"
                    className="deals_add_inv_input deals_add_inv_field_control"
                    value={form.street2}
                    onChange={(e) => patch({ street2: e.target.value })}
                    placeholder="Enter address line 2"
                    autoComplete="address-line2"
                  />
                </InvestingFormField>
              </div>

              {isUs ? (
                <>
                  <InvestingFormField
                    id="addr-state"
                    label={
                      <>
                        State{" "}
                        <span className="investing_form_req" aria-label="required">
                          *
                        </span>
                      </>
                    }
                    Icon={MapPin}
                    tight
                  >
                    <DealsCreateDropdownSelect
                      options={[
                        {
                          value: "",
                          label: usStatesLoading ? "Loading states…" : "Select state",
                        },
                        ...usStateOptions,
                      ]}
                      value={usStateCode}
                      onChange={(v) => patch({ state: v, city: "" })}
                      disabled={usStatesLoading}
                      placeholder={usStatesLoading ? "Loading states…" : "Select state"}
                      searchable
                      searchPlaceholder="Search states…"
                      searchAriaLabel="Filter state list"
                      searchShowOptionCountHint
                      triggerClassName="deals_add_inv_field_control"
                    />
                    {US_LOCATION_SOURCE === "countriesNow" && countriesNow.statesError ? (
                      <p
                        className="investing_form_subline"
                        style={{ marginTop: "0.35em" }}
                        role="status"
                      >
                        Could not load states from the directory service. Using offline list.
                      </p>
                    ) : null}
                  </InvestingFormField>

                  <InvestingFormField
                    id="addr-city"
                    label={
                      <>
                        City{" "}
                        <span className="investing_form_req" aria-label="required">
                          *
                        </span>
                      </>
                    }
                    Icon={Building2}
                    tight
                  >
                    <DealsCreateDropdownSelect
                      options={[
                        {
                          value: "",
                          label: !usStateCode
                            ? "Select state first"
                            : usCitiesLoading
                              ? "Loading cities…"
                              : "Select city",
                        },
                        ...usCityOptions.map((name) => ({ value: name, label: name })),
                      ]}
                      value={
                        form.city && usCityOptions.includes(form.city.trim())
                          ? form.city.trim()
                          : ""
                      }
                      onChange={(v) => patch({ city: v })}
                      disabled={!usStateCode || Boolean(usCitiesLoading)}
                      placeholder={
                        !usStateCode
                          ? "Select state first"
                          : usCitiesLoading
                            ? "Loading cities…"
                            : "Select city"
                      }
                      searchable
                      searchPlaceholder="Search cities…"
                      searchAriaLabel="Filter city list"
                      searchShowOptionCountHint
                      triggerClassName="deals_add_inv_field_control"
                    />
                    {US_LOCATION_SOURCE === "countriesNow" && usStateCode && countriesNow.citiesError ? (
                      <p
                        className="investing_form_subline"
                        style={{ marginTop: "0.35em" }}
                        role="status"
                      >
                        Could not load cities from the directory service. Showing offline list for
                        this state.
                      </p>
                    ) : null}
                  </InvestingFormField>
                </>
              ) : (
                <>
                  <InvestingFormField
                    id="addr-state"
                    label={
                      <>
                        State / Province / Region{" "}
                        <span className="investing_form_req" aria-label="required">
                          *
                        </span>
                      </>
                    }
                    Icon={MapPin}
                    tight
                  >
                    <input
                      id="addr-state"
                      className="deals_add_inv_input deals_add_inv_field_control"
                      value={form.state}
                      onChange={(e) => patch({ state: e.target.value })}
                      placeholder="Enter state or region"
                      autoComplete="address-level1"
                    />
                  </InvestingFormField>

                  <InvestingFormField
                    id="addr-city"
                    label={
                      <>
                        City{" "}
                        <span className="investing_form_req" aria-label="required">
                          *
                        </span>
                      </>
                    }
                    Icon={Building2}
                    tight
                  >
                    <input
                      id="addr-city"
                      className="deals_add_inv_input deals_add_inv_field_control"
                      value={form.city}
                      onChange={(e) => patch({ city: e.target.value })}
                      placeholder="Enter city"
                      autoComplete="address-level2"
                    />
                  </InvestingFormField>
                </>
              )}

              <InvestingFormField
                id="addr-zip"
                label={
                  <>
                    {isUs ? "Zip code" : "Zip / postal code"}{" "}
                    <span className="investing_form_req" aria-label="required">
                      *
                    </span>
                  </>
                }
                Icon={Hash}
                tight
              >
                <input
                  id="addr-zip"
                  className="deals_add_inv_input deals_add_inv_field_control"
                  value={form.zip}
                  onChange={(e) =>
                    patch({
                      zip: isUs
                        ? normalizeZipCodeDigits(e.target.value)
                        : e.target.value,
                    })
                  }
                  placeholder={isUs ? "5-digit zip" : "Enter zip or postal code"}
                  autoComplete="postal-code"
                  inputMode={isUs ? "numeric" : undefined}
                  maxLength={isUs ? 5 : undefined}
                />
              </InvestingFormField>
            </div>
            ) : (
            <div
              className="add_contact_section"
              aria-labelledby="addr-distribution-section-title"
            >
              <p
                id="addr-distribution-section-title"
                className="add_contact_section_eyebrow"
              >
                {"Check memo & distribution"}
              </p>
              <div className="add_contact_name_grid add_beneficiary_field_grid">
                <div className="add_beneficiary_field_grid__full">
                  <div className="um_field">
                    <div
                      className="um_field_label_row"
                      style={{ alignItems: "flex-start" }}
                    >
                      <FileText className="um_field_label_icon" size={17} strokeWidth={1.75} aria-hidden />
                      <div className="investing_form_label_stack">
                        <span
                          id="addr-check-memo-lbl"
                          className="mail_text_label"
                          style={{ display: "block" }}
                        >
                          Check memo
                        </span>
                        <p id="addr-check-memo-hint" className="investing_form_subline">
                          To be printed on the check
                        </p>
                      </div>
                      <AddrFieldHelp label="Check memo" tooltip="To be printed on the check" />
                    </div>
                    <input
                      id="addr-check-memo"
                      className="deals_add_inv_input deals_add_inv_field_control"
                      value={form.checkMemo}
                      onChange={(e) => patch({ checkMemo: e.target.value })}
                      placeholder="Enter check memo"
                      autoComplete="off"
                      aria-labelledby="addr-check-memo-lbl"
                      aria-describedby="addr-check-memo-hint"
                    />
                  </div>
                </div>

                <div className="add_beneficiary_field_grid__full">
                  <div className="um_field">
                    <div
                      className="um_field_label_row"
                      style={{ alignItems: "flex-start" }}
                    >
                      <MessageSquare
                        className="um_field_label_icon"
                        size={17}
                        strokeWidth={1.75}
                        aria-hidden
                      />
                      <div className="investing_form_label_stack">
                        <span
                          id="addr-dist-note-lbl"
                          className="mail_text_label"
                          style={{ display: "block" }}
                        >
                          Distribution note
                        </span>
                        <p id="addr-dist-note-hint" className="investing_form_subline">
                          Additional notes for your sponsor
                        </p>
                      </div>
                      <AddrFieldHelp
                        label="Distribution note"
                        tooltip="Additional notes for your sponsor"
                      />
                    </div>
                    <input
                      id="addr-dist-note"
                      className="deals_add_inv_input deals_add_inv_field_control"
                      value={form.distributionNote}
                      onChange={(e) => patch({ distributionNote: e.target.value })}
                      placeholder="Enter note"
                      autoComplete="off"
                      aria-labelledby="addr-dist-note-lbl"
                      aria-describedby="addr-dist-note-hint"
                    />
                  </div>
                </div>
              </div>
            </div>
            )}
          </div>

          <div className="um_modal_actions add_contact_modal_actions">
            <button type="button" className="um_btn_secondary" onClick={onClose}>
              <X size={16} strokeWidth={2} aria-hidden />
              Cancel
            </button>
            <div className="add_contact_modal_actions_trailing">
              {step > 1 ? (
                <button
                  type="button"
                  className="um_btn_secondary"
                  onClick={goBack}
                >
                  <ArrowLeft size={16} strokeWidth={2} aria-hidden />
                  Back
                </button>
              ) : null}
              {step < TOTAL_STEPS ? (
                <button type="submit" className="um_btn_primary">
                  Next
                  <ChevronRight size={18} strokeWidth={2} aria-hidden />
                </button>
              ) : (
              <button type="submit" className="um_btn_primary">
                <MapPin size={18} strokeWidth={2} aria-hidden />
                {isEdit ? "Save changes" : "Add address"}
              </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}
