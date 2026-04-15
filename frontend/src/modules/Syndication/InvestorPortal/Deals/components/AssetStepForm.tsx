import { Image } from "lucide-react"
import { useEffect, useMemo, useRef, type Dispatch, type SetStateAction } from "react"
import {
  FormTooltip,
  MandatoryFieldMark,
} from "../../../../../common/components/form-tooltip/FormTooltip"
import { useUsCountriesNowLocations } from "../hooks/useUsCountriesNowLocations"
import {
  getUsCitiesForStateCode,
  getUsStateDropdownOptions,
  isUnitedStatesCountry,
  resolveUsStateCodeForDraft,
} from "../constants/usLocations"
import {
  COUNTRY_OPTIONS,
  type AssetStepDraft,
} from "../types/deals.types"
import { DealsCreateDropdownSelect } from "./DealsCreateDropdownSelect"
import "./asset-step-form.css"

interface AssetStepFormProps {
  draft: AssetStepDraft
  errors: Partial<Record<keyof AssetStepDraft, string>>
  imageFiles: File[]
  onChange: (patch: Partial<AssetStepDraft>) => void
  onImageFilesChange: Dispatch<SetStateAction<File[]>>
  /** Shown in edit: API URLs or saved data URLs for this asset. */
  existingImageUrls?: string[]
  onRemoveExistingImage?: (index: number) => void
  /** When false, omit the section heading (e.g. modal already has a title). */
  showSectionTitle?: boolean
  /**
   * US only: `countriesNow` loads states/cities from CountriesNow.space (with static fallback).
   * `static` uses bundled `us-locations.json` only.
   */
  usLocationSource?: "static" | "countriesNow"
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="deals_create_field_error">{message}</p>
}

export function AssetStepForm({
  draft,
  errors,
  imageFiles,
  onChange,
  onImageFilesChange,
  existingImageUrls = [],
  onRemoveExistingImage,
  showSectionTitle = true,
  usLocationSource = "countriesNow",
}: AssetStepFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isUs = isUnitedStatesCountry(draft.country)
  const usStateCode = useMemo(
    () => (isUs ? resolveUsStateCodeForDraft(draft.state) : ""),
    [isUs, draft.state],
  )

  const countriesNow = useUsCountriesNowLocations({
    enabled: isUs && usLocationSource === "countriesNow",
    selectedStateCode: usStateCode,
    selectedCity: draft.city,
  })

  const usStateOptions = useMemo(() => {
    if (!isUs) return []
    if (usLocationSource === "static") return getUsStateDropdownOptions()
    if (countriesNow.stateOptions.length > 0) return countriesNow.stateOptions
    return getUsStateDropdownOptions()
  }, [isUs, usLocationSource, countriesNow.stateOptions])

  const usCityOptions = useMemo(() => {
    if (!isUs || !usStateCode) return []
    if (usLocationSource === "static") {
      const list = getUsCitiesForStateCode(usStateCode)
      const c = draft.city.trim()
      if (c && !list.includes(c))
        return [...list, c].sort((a, b) => a.localeCompare(b))
      return list
    }
    return countriesNow.cityNames
  }, [
    isUs,
    usStateCode,
    usLocationSource,
    countriesNow.cityNames,
    draft.city,
  ])

  const usStatesLoading =
    isUs &&
    usLocationSource === "countriesNow" &&
    countriesNow.statesLoading &&
    countriesNow.stateOptions.length === 0
  const usCitiesLoading =
    isUs &&
    usLocationSource === "countriesNow" &&
    usStateCode &&
    countriesNow.citiesLoading

  useEffect(() => {
    if (!isUs || !draft.state?.trim()) return
    const code = resolveUsStateCodeForDraft(draft.state)
    if (code && code !== draft.state) onChange({ state: code })
  }, [isUs, draft.state, onChange])

  function mergeFiles(incoming: FileList | File[]) {
    onImageFilesChange((prev) => {
      const key = (f: File) => `${f.name}\0${f.size}\0${f.lastModified}`
      const seen = new Set(prev.map(key))
      const list = [...prev]
      for (const f of Array.from(incoming)) {
        if (!f.type.startsWith("image/")) continue
        const k = key(f)
        if (seen.has(k)) continue
        seen.add(k)
        list.push(f)
      }
      return list
    })
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    if (e.dataTransfer.files.length)
      mergeFiles(e.dataTransfer.files)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) mergeFiles(e.target.files)
    e.target.value = ""
  }

  return (
    <section
      className="deals_create_card deals_create_assets"
      aria-labelledby={
        showSectionTitle ? "create-step-assets" : undefined
      }
      aria-label={showSectionTitle ? undefined : "Property and asset details"}
    >
      {showSectionTitle ? (
        <h2
          id="create-step-assets"
          className="deals_create_section_title deals_create_step_card_title"
        >
          Assets
        </h2>
      ) : null}
      <div className="deals_create_fields asset_step_fields">
        <label className="deals_create_label asset_step_label_full">
          <span className="form_label_toolbar">
            <span className="form_label_inline_row">
              <span>Name of property</span>
              <MandatoryFieldMark />
            </span>
            <FormTooltip
              label="About property name"
              content={
                <p>
                  Enter the primary property or asset name for this deal. It
                  appears on documents and summaries.
                </p>
              }
            />
          </span>
          <input
            className="deals_create_input asset_step_input_underline"
            value={draft.propertyName}
            onChange={(e) => onChange({ propertyName: e.target.value })}
            aria-invalid={Boolean(errors.propertyName)}
          />
          <FieldError message={errors.propertyName} />
        </label>

        <label className="deals_create_label">
          Country
          <DealsCreateDropdownSelect
            options={COUNTRY_OPTIONS.map((o) => ({
              value: o.value,
              label: o.label,
            }))}
            value={draft.country}
            onChange={(next) => {
              const wasUs = isUnitedStatesCountry(draft.country)
              const nowUs = isUnitedStatesCountry(next)
              if (!wasUs && nowUs)
                onChange({
                  country: next,
                  state: resolveUsStateCodeForDraft(draft.state) || "",
                  city: "",
                })
              else onChange({ country: next })
            }}
            searchable
            searchPlaceholder="Search countries…"
            searchAriaLabel="Filter country list"
            searchShowOptionCountHint
            triggerClassName="asset_step_input_underline"
          />
        </label>

        <label className="deals_create_label asset_step_label_full">
          Street address line 1
          <input
            type="text"
            className="deals_create_input asset_step_input_underline"
            value={draft.streetAddress1}
            onChange={(e) => onChange({ streetAddress1: e.target.value })}
            autoComplete="street-address"
          />
        </label>

        <label className="deals_create_label asset_step_label_full">
          Street address line 2
          <input
            className="deals_create_input asset_step_input_underline"
            value={draft.streetAddress2}
            onChange={(e) => onChange({ streetAddress2: e.target.value })}
          />
        </label>

        <label className="deals_create_label">
          State
          {isUs ? (
            <>
              <DealsCreateDropdownSelect
                options={[
                  {
                    value: "",
                    label: usStatesLoading
                      ? "Loading states…"
                      : "Select state",
                  },
                  ...usStateOptions,
                ]}
                value={usStateCode}
                onChange={(v) => onChange({ state: v, city: "" })}
                disabled={usStatesLoading}
                invalid={Boolean(errors.state)}
                placeholder={
                  usStatesLoading ? "Loading states…" : "Select state"
                }
                searchable
                searchPlaceholder="Search states…"
                searchAriaLabel="Filter state list"
                searchShowOptionCountHint
                triggerClassName="asset_step_input_underline"
              />
              {usLocationSource === "countriesNow" &&
              countriesNow.statesError ? (
                <p className="deals_create_field_hint deals_create_field_hint_warn" role="status">
                  Could not load states from the directory service. Using
                  offline list.
                </p>
              ) : null}
            </>
          ) : (
            <input
              className="deals_create_input asset_step_input_underline"
              value={draft.state}
              onChange={(e) => onChange({ state: e.target.value })}
              aria-invalid={Boolean(errors.state)}
            />
          )}
          <FieldError message={errors.state} />
        </label>

        <label className="deals_create_label">
          City
          {isUs ? (
            <>
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
                  ...usCityOptions.map((name) => ({
                    value: name,
                    label: name,
                  })),
                ]}
                value={
                  draft.city && usCityOptions.includes(draft.city)
                    ? draft.city
                    : ""
                }
                onChange={(v) => onChange({ city: v })}
                disabled={!usStateCode || Boolean(usCitiesLoading)}
                invalid={Boolean(errors.city)}
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
                triggerClassName="asset_step_input_underline"
              />
              {usLocationSource === "countriesNow" &&
              usStateCode &&
              countriesNow.citiesError ? (
                <p className="deals_create_field_hint deals_create_field_hint_warn" role="status">
                  Could not load cities from the directory service. Showing
                  offline list for this state.
                </p>
              ) : null}
            </>
          ) : (
            <input
              className="deals_create_input asset_step_input_underline"
              value={draft.city}
              onChange={(e) => onChange({ city: e.target.value })}
              aria-invalid={Boolean(errors.city)}
            />
          )}
          <FieldError message={errors.city} />
        </label>

        <label className="deals_create_label">
          Zip code
          <input
            className="deals_create_input asset_step_input_underline"
            value={draft.zipCode}
            onChange={(e) => onChange({ zipCode: e.target.value })}
          />
        </label>

        <div className="asset_step_label_full asset_step_upload_block">
          {existingImageUrls.length > 0 ? (
            <>
              <span className="deals_create_label_text">Images</span>
              <ul
                className="asset_step_existing_images"
                aria-label="Images for this asset"
              >
                {existingImageUrls.map((src, i) => (
                  <li
                    key={`existing-img-${i}`}
                    className="asset_step_existing_item"
                  >
                    <div className="asset_step_existing_thumb_wrap">
                      <img
                        src={src}
                        alt=""
                        className="asset_step_existing_thumb"
                        loading="lazy"
                      />
                    </div>
                    {onRemoveExistingImage ? (
                      <button
                        type="button"
                        className="asset_step_remove_file"
                        onClick={() => onRemoveExistingImage(i)}
                      >
                        Remove
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
              <span className="deals_create_label_text asset_step_upload_eyebrow">
                Add more images
              </span>
            </>
          ) : (
            <span className="deals_create_label_text">Upload images</span>
          )}
          <div
            className="asset_step_dropzone"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            role="region"
            aria-label="Upload property images"
          >
            <Image
              className="asset_step_dropzone_icon"
              size={40}
              strokeWidth={1.25}
              aria-hidden
            />
            <p className="asset_step_dropzone_text">
              Drag and drop photos or{" "}
              <button
                type="button"
                className="asset_step_browse"
                onClick={() => fileInputRef.current?.click()}
              >
                browse
              </button>{" "}
              to choose files.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              className="asset_step_file_input"
              accept="image/*"
              multiple
              onChange={handleFileInput}
            />
          </div>
          {imageFiles.length > 0 ? (
            <ul className="asset_step_file_list">
              {imageFiles.map((f, i) => (
                <li key={`${f.name}-${i}`}>
                  {f.name}
                  <button
                    type="button"
                    className="asset_step_remove_file"
                    onClick={() =>
                      onImageFilesChange((prev) =>
                        prev.filter((_, j) => j !== i),
                      )
                    }
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  )
}
