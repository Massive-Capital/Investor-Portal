import type {
  ClassSetupClass,
  ClassSetupPreferredReturn,
  ClassSetupValidation,
} from "../types/class-setup.types"
import { fieldErrorFor } from "../utils/classSetupValidation"

interface PreferredReturnSectionProps {
  value: ClassSetupPreferredReturn
  classItem: ClassSetupClass
  validation: ClassSetupValidation
  onChange: (next: ClassSetupPreferredReturn) => void
}

export function PreferredReturnSection({
  value,
  classItem,
  validation,
  onChange,
}: PreferredReturnSectionProps) {
  function patch(partial: Partial<ClassSetupPreferredReturn>) {
    onChange({ ...value, ...partial })
  }

  return (
    <section className="cs_section">
      <h3 className="cs_section_title">Preferred Return</h3>
      <label className="cs_toggle">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => patch({ enabled: e.target.checked })}
        />
        <span className="track" />
        <span>{value.enabled ? "Enabled" : "Disabled"}</span>
      </label>

      {value.enabled ? (
        <div className="cs_pref_panel">
          <div className="cs_fields">
            <div className="cs_field">
              <label>Preferred Rate (%/yr)</label>
              <input
                type="number"
                min={0}
                step={0.25}
                value={value.rate}
                onChange={(e) => patch({ rate: e.target.value })}
              />
            </div>
            <div className="cs_field">
              <label>Preferred Type</label>
              <select
                value={value.preferredType}
                onChange={(e) =>
                  patch({
                    preferredType: e.target.value as "single" | "split",
                  })
                }
              >
                <option value="single">Single</option>
                <option value="split">Split</option>
              </select>
            </div>
            <div className="cs_field">
              <label>Compounding</label>
              <select
                value={value.compounding}
                onChange={(e) =>
                  patch({
                    compounding: e.target.value as "simple" | "compound",
                  })
                }
              >
                <option value="simple">Simple</option>
                <option value="compound">Compound</option>
              </select>
            </div>
            <div className="cs_field">
              <label>Distribution Frequency</label>
              <select
                value={value.distributionFrequency}
                onChange={(e) =>
                  patch({
                    distributionFrequency: e.target
                      .value as ClassSetupPreferredReturn["distributionFrequency"],
                  })
                }
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annually">Annually</option>
              </select>
            </div>
          </div>

          {value.preferredType === "split" ? (
            <div className="cs_fields" style={{ marginTop: 10 }}>
              <div
                className={`cs_field${
                  fieldErrorFor(
                    validation,
                    classItem,
                    "preferredReturn.currentPortion",
                  )
                    ? " invalid"
                    : ""
                }`}
              >
                <label>Current Portion (%/yr)</label>
                <input
                  type="number"
                  min={0}
                  step={0.25}
                  value={value.currentPortion}
                  onChange={(e) => {
                    const currentPortion = e.target.value
                    const accruedPortion = String(
                      Math.max(
                        0,
                        Number(value.rate || 0) - Number(currentPortion || 0),
                      ),
                    )
                    patch({ currentPortion, accruedPortion })
                  }}
                />
                {fieldErrorFor(
                  validation,
                  classItem,
                  "preferredReturn.currentPortion",
                ) ? (
                  <p className="cs_field_error">
                    {fieldErrorFor(
                      validation,
                      classItem,
                      "preferredReturn.currentPortion",
                    )}
                  </p>
                ) : null}
              </div>
              <div
                className={`cs_field${
                  fieldErrorFor(
                    validation,
                    classItem,
                    "preferredReturn.accruedPortion",
                  )
                    ? " invalid"
                    : ""
                }`}
              >
                <label>Accrued Portion (%/yr)</label>
                <input
                  type="number"
                  min={0}
                  step={0.25}
                  value={value.accruedPortion}
                  onChange={(e) => patch({ accruedPortion: e.target.value })}
                />
                {fieldErrorFor(
                  validation,
                  classItem,
                  "preferredReturn.accruedPortion",
                ) ? (
                  <p className="cs_field_error">
                    {fieldErrorFor(
                      validation,
                      classItem,
                      "preferredReturn.accruedPortion",
                    )}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
