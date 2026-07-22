import { Trash2 } from "lucide-react"
import type {
  ClassSetupClass,
  ClassSetupValidation,
} from "../types/class-setup.types"
import { fieldErrorFor } from "../utils/classSetupValidation"
import { newTierId } from "../utils/classSetupTotals"

interface WaterfallTiersSectionProps {
  classItem: ClassSetupClass
  validation: ClassSetupValidation
  onChange: (next: ClassSetupClass) => void
}

export function WaterfallTiersSection({
  classItem,
  validation,
  onChange,
}: WaterfallTiersSectionProps) {
  function updateTier(
    index: number,
    patch: Partial<ClassSetupClass["waterfallTiers"][number]>,
  ) {
    const waterfallTiers = classItem.waterfallTiers.map((t, i) =>
      i === index ? { ...t, ...patch } : t,
    )
    onChange({ ...classItem, waterfallTiers })
  }

  function addTier() {
    onChange({
      ...classItem,
      waterfallTiers: [
        ...classItem.waterfallTiers,
        { id: newTierId(), hurdleRate: "12", lpPct: "60", gpPct: "40" },
      ],
    })
  }

  function removeTier(index: number) {
    onChange({
      ...classItem,
      waterfallTiers: classItem.waterfallTiers.filter((_, i) => i !== index),
    })
  }

  function moveTier(index: number, direction: -1 | 1) {
    const next = [...classItem.waterfallTiers]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    const tmp = next[index]!
    next[index] = next[target]!
    next[target] = tmp
    onChange({ ...classItem, waterfallTiers: next })
  }

  return (
    <section className="cs_section">
      <h3 className="cs_section_title">Waterfall</h3>
      <div className="cs_waterfall_panel">
        {classItem.waterfallTiers.length === 0 ? (
          <p style={{ margin: "0 0 8px", fontSize: 12.5, color: "var(--cs-muted)" }}>
            No hurdle tiers yet. Add a tier to configure LP / GP splits.
          </p>
        ) : null}

        {classItem.waterfallTiers.map((tier, index) => {
          const tierError = fieldErrorFor(
            validation,
            classItem,
            `waterfallTiers.${index}`,
          )
          return (
            <div key={tier.id} className="cs_tier_row">
              <div className="cs_tier_label">
                Tier {index + 1}
                <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                  <button
                    type="button"
                    className="cs_subtle_btn"
                    disabled={index === 0}
                    onClick={() => moveTier(index, -1)}
                    aria-label={`Move tier ${index + 1} up`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="cs_subtle_btn"
                    disabled={index >= classItem.waterfallTiers.length - 1}
                    onClick={() => moveTier(index, 1)}
                    aria-label={`Move tier ${index + 1} down`}
                  >
                    ↓
                  </button>
                </div>
              </div>
              <div className={`cs_field${tierError ? " invalid" : ""}`}>
                <label>Hurdle Rate %</label>
                <input
                  type="number"
                  min={0}
                  step={0.25}
                  value={tier.hurdleRate}
                  onChange={(e) =>
                    updateTier(index, { hurdleRate: e.target.value })
                  }
                />
              </div>
              <div className={`cs_field${tierError ? " invalid" : ""}`}>
                <label>LP %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={tier.lpPct}
                  onChange={(e) => updateTier(index, { lpPct: e.target.value })}
                />
              </div>
              <div className={`cs_field${tierError ? " invalid" : ""}`}>
                <label>GP %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={tier.gpPct}
                  onChange={(e) => updateTier(index, { gpPct: e.target.value })}
                />
                {tierError ? <p className="cs_field_error">{tierError}</p> : null}
              </div>
              <button
                type="button"
                className="cs_subtle_btn danger"
                aria-label={`Delete tier ${index + 1}`}
                onClick={() => removeTier(index)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          )
        })}

        <div style={{ marginTop: 10 }}>
          <button type="button" className="cs_add_btn" onClick={addTier}>
            ＋ Add Tier
          </button>
        </div>

        <div style={{ marginTop: 14 }}>
          <h4
            className="cs_section_title"
            style={{ marginBottom: 8 }}
          >
            Final Tier
          </h4>
          <div className="cs_fields">
            <div
              className={`cs_field${
                fieldErrorFor(validation, classItem, "finalTier")
                  ? " invalid"
                  : ""
              }`}
            >
              <label>LP %</label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={classItem.finalTier.lpPct}
                onChange={(e) =>
                  onChange({
                    ...classItem,
                    finalTier: {
                      ...classItem.finalTier,
                      lpPct: e.target.value,
                    },
                  })
                }
              />
            </div>
            <div
              className={`cs_field${
                fieldErrorFor(validation, classItem, "finalTier")
                  ? " invalid"
                  : ""
              }`}
            >
              <label>GP %</label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={classItem.finalTier.gpPct}
                onChange={(e) =>
                  onChange({
                    ...classItem,
                    finalTier: {
                      ...classItem.finalTier,
                      gpPct: e.target.value,
                    },
                  })
                }
              />
              {fieldErrorFor(validation, classItem, "finalTier") ? (
                <p className="cs_field_error">
                  {fieldErrorFor(validation, classItem, "finalTier")}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
