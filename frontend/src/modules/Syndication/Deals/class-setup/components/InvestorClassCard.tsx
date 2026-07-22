import type { ReactNode } from "react"
import { ChevronDown, Copy, Trash2, ArrowUp, ArrowDown } from "lucide-react"
import type {
  ClassSetupClass,
  ClassSetupType,
  ClassSetupValidation,
} from "../types/class-setup.types"
import { CLASS_TYPE_META } from "../types/class-setup.types"
import { fieldErrorFor } from "../utils/classSetupValidation"
import {
  blurFormatMoneyInput,
  formatCurrencyUsdTypeInput,
} from "../../utils/offeringMoneyFormat"
import { formatPct, newTierId } from "../utils/classSetupTotals"
import { PreferredReturnSection } from "./PreferredReturnSection"
import { WaterfallTiersSection } from "./WaterfallTiersSection"

interface InvestorClassCardProps {
  classItem: ClassSetupClass
  index: number
  totalCount: number
  ownershipTotal: number
  validation: ClassSetupValidation
  confirmDeleteKey: string | null
  onToggleExpand: () => void
  onChange: (next: ClassSetupClass) => void
  onDuplicate: () => void
  onDeleteRequest: () => void
  onDeleteConfirm: () => void
  onDeleteCancel: () => void
  onMove: (direction: -1 | 1) => void
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className={`cs_field${error ? " invalid" : ""}`}>
      <label>{label}</label>
      {children}
      {error ? <p className="cs_field_error">{error}</p> : null}
    </div>
  )
}

export function InvestorClassCard({
  classItem,
  index,
  totalCount,
  ownershipTotal,
  validation,
  confirmDeleteKey,
  onToggleExpand,
  onChange,
  onDuplicate,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
  onMove,
}: InvestorClassCardProps) {
  const meta = CLASS_TYPE_META[classItem.classType]
  const isEquity =
    classItem.classType === "lp" || classItem.classType === "gp"
  const isPrefEquity = classItem.classType === "preferred_equity"
  const isMezz = classItem.classType === "mezzanine"
  const key = classItem.id || classItem.clientKey
  const showDeleteConfirm = confirmDeleteKey === key
  const ownershipOk = Math.abs(ownershipTotal - 100) < 0.05

  function patch(partial: Partial<ClassSetupClass>) {
    onChange({ ...classItem, ...partial })
  }

  function onTypeChange(nextType: ClassSetupType) {
    const next: ClassSetupClass = {
      ...classItem,
      classType: nextType,
      equityPct:
        nextType === "preferred_equity" || nextType === "mezzanine"
          ? "0"
          : classItem.equityPct,
      waterfallTiers:
        nextType === "lp" || nextType === "gp"
          ? classItem.waterfallTiers.length
            ? classItem.waterfallTiers
            : [{ id: newTierId(), hurdleRate: "7", lpPct: "70", gpPct: "30" }]
          : [],
      preferredReturn: {
        ...classItem.preferredReturn,
        enabled:
          nextType === "lp" ? classItem.preferredReturn.enabled || true : false,
      },
    }
    onChange(next)
  }

  return (
    <article className={`cs_card cs_class_card tone-${meta.tone}`}>
      <div className="cs_class_head">
        <button
          type="button"
          className="cs_class_head_toggle"
          onClick={onToggleExpand}
          aria-expanded={classItem.expanded}
        >
          <div className="cs_class_head_main">
            <strong>{classItem.name || "Untitled class"}</strong>
            <span className={`cs_type_chip tone-${meta.tone}`}>{meta.label}</span>
          </div>
          <ChevronDown
            className={`cs_chevron${classItem.expanded ? " open" : ""}`}
            size={18}
            aria-hidden
          />
        </button>
        <span className="cs_class_actions">
          <button
            type="button"
            className="cs_subtle_btn"
            aria-label="Move up"
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            <ArrowUp size={14} />
          </button>
          <button
            type="button"
            className="cs_subtle_btn"
            aria-label="Move down"
            disabled={index >= totalCount - 1}
            onClick={() => onMove(1)}
          >
            <ArrowDown size={14} />
          </button>
          <button
            type="button"
            className="cs_subtle_btn"
            aria-label="Duplicate class"
            onClick={onDuplicate}
          >
            <Copy size={14} />
          </button>
          <button
            type="button"
            className="cs_subtle_btn danger"
            aria-label="Delete class"
            onClick={onDeleteRequest}
          >
            <Trash2 size={14} />
          </button>
        </span>
      </div>

      <div className={`cs_class_body${classItem.expanded ? " open" : ""}`}>
        <div className="cs_class_body_inner">
          {showDeleteConfirm ? (
            <div className="cs_confirm_inline" role="alert">
              <span>Delete {classItem.name || "this class"}? This cannot be undone.</span>
              <button type="button" className="cs_add_btn" onClick={onDeleteCancel}>
                Cancel
              </button>
              <button
                type="button"
                className="cs_subtle_btn danger"
                onClick={onDeleteConfirm}
              >
                Confirm delete
              </button>
            </div>
          ) : null}

          <section className="cs_section">
            <h3 className="cs_section_title">Basic Details</h3>
            <div className="cs_fields">
              <Field label="Class Name" error={fieldErrorFor(validation, classItem, "name")}>
                <input
                  value={classItem.name}
                  onChange={(e) => patch({ name: e.target.value })}
                />
              </Field>
              <Field label="Class Type">
                <select
                  value={classItem.classType}
                  onChange={(e) =>
                    onTypeChange(e.target.value as ClassSetupType)
                  }
                >
                  <option value="lp">Limited Partner</option>
                  <option value="gp">General Partner</option>
                  <option value="preferred_equity">Preferred Equity</option>
                  <option value="mezzanine">Mezzanine</option>
                </select>
              </Field>
              <Field label="Display Order">
                <input
                  type="number"
                  min={0}
                  value={classItem.displayOrder}
                  onChange={(e) =>
                    patch({ displayOrder: Number(e.target.value) || 0 })
                  }
                />
              </Field>
              <Field label="Status">
                <select
                  value={classItem.status}
                  onChange={(e) =>
                    patch({
                      status: e.target.value as ClassSetupClass["status"],
                    })
                  }
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="closed">Closed</option>
                </select>
              </Field>
            </div>
          </section>

          <section className="cs_section">
            <h3 className="cs_section_title">Capital</h3>
            <div className="cs_fields">
              <Field label="Committed Capital">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="$0"
                  value={classItem.committedCapital}
                  onChange={(e) =>
                    patch({
                      committedCapital: formatCurrencyUsdTypeInput(
                        e.target.value,
                      ),
                    })
                  }
                  onBlur={(e) =>
                    patch({
                      committedCapital: blurFormatMoneyInput(e.target.value),
                    })
                  }
                />
              </Field>
              <Field label="Actually Funded">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="$0"
                  value={classItem.actuallyFunded}
                  onChange={(e) =>
                    patch({
                      actuallyFunded: formatCurrencyUsdTypeInput(e.target.value),
                    })
                  }
                  onBlur={(e) =>
                    patch({
                      actuallyFunded: blurFormatMoneyInput(e.target.value),
                    })
                  }
                />
              </Field>
              {classItem.classType !== "gp" ? (
                <Field label="Minimum Investment">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="$0"
                    value={classItem.minimumInvestment}
                    onChange={(e) =>
                      patch({
                        minimumInvestment: formatCurrencyUsdTypeInput(
                          e.target.value,
                        ),
                      })
                    }
                    onBlur={(e) =>
                      patch({
                        minimumInvestment: blurFormatMoneyInput(e.target.value),
                      })
                    }
                  />
                </Field>
              ) : null}
              {isEquity ? (
                <Field
                  label="Equity %"
                  error={fieldErrorFor(validation, classItem, "equityPct")}
                >
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={classItem.equityPct}
                    onChange={(e) => patch({ equityPct: e.target.value })}
                  />
                </Field>
              ) : (
                <Field label="Equity %">
                  <input value="— fixed return" disabled />
                </Field>
              )}
            </div>
            {isEquity ? (
              <p
                className={`cs_ownership_live ${ownershipOk ? "ok" : "bad"}`}
              >
                Live ownership total across LP + GP: {formatPct(ownershipTotal)}
              </p>
            ) : null}
          </section>

          {classItem.classType === "lp" ? (
            <PreferredReturnSection
              value={classItem.preferredReturn}
              validation={validation}
              classItem={classItem}
              onChange={(preferredReturn) => patch({ preferredReturn })}
            />
          ) : null}

          {isPrefEquity ? (
            <section className="cs_section">
              <h3 className="cs_section_title">Preferred Equity Terms</h3>
              <div className="cs_pref_panel">
                <div className="cs_fields">
                  <Field label="Total Preferred Rate (%/yr)">
                    <input
                      type="number"
                      min={0}
                      step={0.25}
                      value={classItem.prefEquity.totalRate}
                      onChange={(e) =>
                        patch({
                          prefEquity: {
                            ...classItem.prefEquity,
                            totalRate: e.target.value,
                            accrualRate: String(
                              Math.max(
                                0,
                                Number(e.target.value || 0) -
                                  Number(classItem.prefEquity.currentRate || 0),
                              ),
                            ),
                          },
                        })
                      }
                    />
                  </Field>
                  <Field
                    label="Current Portion (%/yr)"
                    error={fieldErrorFor(
                      validation,
                      classItem,
                      "prefEquity.currentRate",
                    )}
                  >
                    <input
                      type="number"
                      min={0}
                      step={0.25}
                      value={classItem.prefEquity.currentRate}
                      onChange={(e) =>
                        patch({
                          prefEquity: {
                            ...classItem.prefEquity,
                            currentRate: e.target.value,
                            accrualRate: String(
                              Math.max(
                                0,
                                Number(classItem.prefEquity.totalRate || 0) -
                                  Number(e.target.value || 0),
                              ),
                            ),
                          },
                        })
                      }
                    />
                  </Field>
                  <Field label="Accrued Portion (%/yr)">
                    <input
                      type="number"
                      min={0}
                      step={0.25}
                      value={classItem.prefEquity.accrualRate}
                      readOnly
                    />
                  </Field>
                </div>
              </div>
            </section>
          ) : null}

          {isMezz ? (
            <section className="cs_section">
              <h3 className="cs_section_title">Mezzanine Terms</h3>
              <div className="cs_fields">
                <Field label="Interest Rate (%/yr)">
                  <input
                    type="number"
                    min={0}
                    step={0.25}
                    value={classItem.mezz.rate}
                    onChange={(e) =>
                      patch({
                        mezz: { ...classItem.mezz, rate: e.target.value },
                      })
                    }
                  />
                </Field>
                <Field label="Payment Type">
                  <select
                    value={classItem.mezz.pay}
                    onChange={(e) =>
                      patch({
                        mezz: { ...classItem.mezz, pay: e.target.value },
                      })
                    }
                  >
                    <option>Current pay</option>
                    <option>Partial PIK</option>
                    <option>Full PIK</option>
                  </select>
                </Field>
              </div>
            </section>
          ) : null}

          {isEquity ? (
            <WaterfallTiersSection
              classItem={classItem}
              validation={validation}
              onChange={onChange}
            />
          ) : null}
        </div>
      </div>
    </article>
  )
}
