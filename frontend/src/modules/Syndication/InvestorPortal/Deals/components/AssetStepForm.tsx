import { Image } from "lucide-react"
import { useRef, type Dispatch, type SetStateAction } from "react"
import {
  FormTooltip,
  MandatoryFieldMark,
} from "../../../../../common/components/form-tooltip/FormTooltip"
import {
  COUNTRY_OPTIONS,
  type AssetStepDraft,
} from "../types/deals.types"
import "./asset-step-form.css"

interface AssetStepFormProps {
  draft: AssetStepDraft
  errors: Partial<Record<keyof AssetStepDraft, string>>
  imageFiles: File[]
  onChange: (patch: Partial<AssetStepDraft>) => void
  onImageFilesChange: Dispatch<SetStateAction<File[]>>
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
}: AssetStepFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  function mergeFiles(incoming: FileList | File[]) {
    onImageFilesChange((prev) => {
      const list = [...prev]
      for (const f of Array.from(incoming)) {
        if (f.type.startsWith("image/")) list.push(f)
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
      aria-labelledby="create-step-assets"
    >
      <h2 id="create-step-assets" className="deals_create_section_title">
        Assets
      </h2>
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
          <select
            className="deals_create_select asset_step_input_underline"
            value={draft.country}
            onChange={(e) => onChange({ country: e.target.value })}
          >
            {COUNTRY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
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
          City
          <input
            className="deals_create_input asset_step_input_underline"
            value={draft.city}
            onChange={(e) => onChange({ city: e.target.value })}
          />
        </label>

        <label className="deals_create_label">
          State
          <input
            className="deals_create_input asset_step_input_underline"
            value={draft.state}
            onChange={(e) => onChange({ state: e.target.value })}
          />
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
          <span className="deals_create_label_text">Upload images</span>
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
