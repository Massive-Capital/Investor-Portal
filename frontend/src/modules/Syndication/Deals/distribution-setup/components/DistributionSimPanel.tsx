import { AlertTriangle } from "lucide-react"
import {
  blurFormatMoneyInput,
  formatCurrencyTableDisplay,
  formatCurrencyUsdTypeInput,
  parseMoneyDigits,
} from "../../utils/offeringMoneyFormat"
import type {
  DistributionSetupClass,
  PriorDistributionRecord,
} from "../types/distribution-setup.types"
import { CLASS_TYPE_TONE } from "../types/distribution-setup.types"
import type { SimResult } from "../utils/distributionSim"
import { formatMoney } from "../utils/distributionSim"
import type { HurdleEvaluation } from "../utils/hurdleCalculations"

const CASH_PRESETS = ["15000", "25000", "50000"] as const

interface DistributionSimPanelProps {
  cash: string
  periodFactor: string
  onCashChange: (v: string) => void
  onPeriodChange: (v: string) => void
  sim: SimResult
  classes: DistributionSetupClass[]
  stageMet: Record<number, boolean>
  onToggleStageMet: (stage: number, met: boolean) => void
  onDueOverride: (rowId: string, value: string) => void
  rowIds: string[]
  investmentDate: string
  onInvestmentDateChange: (v: string) => void
  /** Where the current investment date was loaded from (for UI hint). */
  investmentDateSource?: "close" | "funded" | "none"
  priorDistributions: PriorDistributionRecord[]
  investedCapital: number
  completing?: boolean
  onComplete?: () => void
}

function formatMetricPct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—"
  return `${(n * 100).toFixed(1)}%`
}

export function DistributionSimPanel({
  cash,
  periodFactor,
  onCashChange,
  onPeriodChange,
  sim,
  classes,
  stageMet,
  onToggleStageMet,
  onDueOverride,
  rowIds,
  investmentDate,
  onInvestmentDateChange,
  investmentDateSource = "none",
  priorDistributions,
  investedCapital,
  completing = false,
  onComplete,
}: DistributionSimPanelProps) {
  const recipients = classes.filter((c) => (sim.perClass[c.id] || 0) > 0.5)
  const evaluations = sim.hurdleEvaluations ?? []
  const cashAmount = (() => {
    const n = parseMoneyDigits(cash)
    return Number.isFinite(n) ? n : 0
  })()
  const canComplete = Boolean(onComplete) && cashAmount > 0 && !completing

  return (
    <aside className="ds_sim_panel" aria-label="Test a distribution">
      <div className="ds_card ds_sim_card">
        <div className="ds_card_pad">
          <div className="ds_sim_head">
            <h2>Test a distribution</h2>
            <span className="ds_tag">Live preview</span>
          </div>

          <div className="ds_sim_inputs">
            <label className="ds_field">
              <span>Cash available</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="$0"
                value={cash}
                onChange={(e) =>
                  onCashChange(formatCurrencyUsdTypeInput(e.target.value))
                }
                onBlur={(e) =>
                  onCashChange(blurFormatMoneyInput(e.target.value))
                }
              />
            </label>
            <label className="ds_field">
              <span>Period</span>
              <select
                value={periodFactor}
                onChange={(e) => onPeriodChange(e.target.value)}
              >
                <option value="0.083333">Monthly</option>
                <option value="0.25">Quarterly</option>
                <option value="1">Annual</option>
              </select>
            </label>
            {sim.periodWindowLabel ? (
              <p className="ds_muted ds_sim_hint ds_period_hint">
                {sim.periodWindowLabel}
                {sim.priorCashInPeriod > 0
                  ? ` · ${formatMoney(sim.priorCashInPeriod)} already distributed in this window (preferred dues reduced)`
                  : " · preferred dues are for this window only"}
              </p>
            ) : null}
            <div className="ds_presets">
              <span>Try:</span>
              {CASH_PRESETS.map((v) => {
                const formatted = blurFormatMoneyInput(v)
                return (
                  <button
                    key={v}
                    type="button"
                    className="ds_preset_btn"
                    onClick={() => onCashChange(formatted)}
                  >
                    {formatted}
                  </button>
                )
              })}
            </div>
          </div>

          {onComplete ? (
            <div className="ds_complete_row">
              <button
                type="button"
                className="ds_primary_btn"
                disabled={!canComplete}
                onClick={onComplete}
                title={
                  cashAmount > 0
                    ? "Record this cash as a completed distribution"
                    : "Enter cash available greater than $0 to complete"
                }
              >
                {completing ? "Completing…" : "Complete distribution"}
              </button>
            </div>
          ) : null}

          <div className="ds_sim_section">
            <p className="ds_eyebrow">Hurdle cash flows (IRR)</p>
            <p className="ds_muted ds_sim_hint">
              Invested capital {formatMoney(investedCapital)}. Cash-on-cash uses
              this period&apos;s cash automatically.
              {investmentDateSource === "close"
                ? " Investment date is the deal close date."
                : investmentDateSource === "funded"
                  ? " Investment date is the earliest funded / invested date on this deal."
                  : investmentDate
                    ? ""
                    : " Set a deal close date on Offering Overview to drive this field."}
            </p>
            <div className="ds_sim_inputs">
              <label className="ds_field">
                <span>Investment date</span>
                <input
                  type="date"
                  value={investmentDate}
                  onChange={(e) => onInvestmentDateChange(e.target.value)}
                />
              </label>
            </div>
            <div className="ds_field">
              <span>Prior distributions</span>
              {priorDistributions.length === 0 ? (
                <p className="ds_prior_empty">
                  No prior distributions recorded yet.
                </p>
              ) : (
                <ul className="ds_prior_list" aria-label="Prior distributions">
                  {priorDistributions.map((p) => (
                    <li key={p.id || `${p.date}_${p.amount}`}>
                      <span>{formatCurrencyTableDisplay(p.amount)}</span>
                      <span className="ds_muted">{p.date}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {evaluations.length > 0 ? (
              <ul className="ds_hurdle_metrics">
                {evaluations.map((ev: HurdleEvaluation, i) => (
                  <li key={`hurdle_ev_${i}`}>
                    <span className="ds_hurdle_metrics_label">
                      Hurdle {i + 1} · {ev.type}
                    </span>
                    <span
                      className={
                        ev.hurdleMet
                          ? "ds_hurdle_metrics_ok"
                          : "ds_hurdle_metrics_miss"
                      }
                    >
                      {ev.canEvaluate
                        ? `${formatMetricPct(ev.metric)} ${ev.hurdleMet ? "≥" : "<"} ${formatMetricPct(ev.hurdleRate)}`
                        : "needs cash flows"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="ds_sim_section">
            <p className="ds_eyebrow">How the cash flows</p>
            <div className="ds_flow_wrap">
              <table className="ds_flow_table">
                <thead>
                  <tr>
                    <th>Tier</th>
                    <th className="r">Due</th>
                    <th className="r">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {sim.flowRows.length === 0 ? (
                    <tr>
                      <td colSpan={3}>
                        <span className="ds_muted">
                          Add payment rows to preview flow.
                        </span>
                      </td>
                    </tr>
                  ) : (
                    sim.flowRows.map((r) => {
                      const isStage = r.kind === "stage"
                      const paymentId =
                        !isStage && rowIds[r.index] ? rowIds[r.index]! : null
                      const ev =
                        isStage && r.stage != null && r.stage > 0
                          ? evaluations[r.stage - 1]
                          : undefined
                      return (
                        <tr key={`${r.kind}_${r.index}`}>
                          <td>
                            <div className="ds_tier_label">
                              <span className="n">{r.index + 1}</span>
                              <span>{r.label}</span>
                            </div>
                            {r.shortfall != null && r.shortfall > 0.5 ? (
                              <div className="ds_flow_warn">
                                short {formatMoney(r.shortfall)} → accrues
                              </div>
                            ) : null}
                            {r.note ? (
                              <div
                                className={
                                  r.skipped ? "ds_flow_skip" : "ds_flow_note"
                                }
                              >
                                {r.note}
                              </div>
                            ) : null}
                            {isStage && r.stage != null && r.stage > 0 ? (
                              <label className="ds_stage_toggle">
                                <input
                                  type="checkbox"
                                  checked={Boolean(stageMet[r.stage])}
                                  onChange={(e) =>
                                    onToggleStageMet(
                                      r.stage!,
                                      e.target.checked,
                                    )
                                  }
                                />
                                Hurdle {r.stage} met?
                                {ev?.canEvaluate ? (
                                  <span className="ds_stage_auto">
                                    {" "}
                                    (auto)
                                  </span>
                                ) : null}
                              </label>
                            ) : null}
                          </td>
                          <td className="r">
                            {r.due == null ? (
                              "—"
                            ) : paymentId ? (
                              <input
                                className="ds_due_in"
                                type="text"
                                inputMode="decimal"
                                placeholder="$0"
                                value={blurFormatMoneyInput(
                                  String(Math.round(r.due)),
                                )}
                                onChange={(e) =>
                                  onDueOverride(
                                    paymentId,
                                    formatCurrencyUsdTypeInput(e.target.value),
                                  )
                                }
                                onBlur={(e) =>
                                  onDueOverride(
                                    paymentId,
                                    blurFormatMoneyInput(e.target.value),
                                  )
                                }
                                aria-label="Due override"
                              />
                            ) : (
                              formatMoney(r.due)
                            )}
                          </td>
                          <td className="r">
                            {r.paid == null ? (
                              "—"
                            ) : (
                              <strong>{formatMoney(r.paid)}</strong>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
            {sim.leftover > 0.5 ? (
              <p className="ds_leftover">
                <AlertTriangle size={14} strokeWidth={2} aria-hidden />
                <span>
                  {formatMoney(sim.leftover)} undistributed — no LP/GP classes
                  with split schedules to absorb the residual.
                </span>
              </p>
            ) : null}
          </div>

          <div className="ds_sim_section">
            <p className="ds_eyebrow">Who receives what</p>
            {recipients.length === 0 ? (
              <p className="ds_muted">
                No allocations yet — increase cash or dues.
              </p>
            ) : (
              <ul className="ds_alloc_list">
                {recipients.map((c) => (
                  <li key={c.id}>
                    <span
                      className={`ds_swatch ${CLASS_TYPE_TONE[c.classType] || "lp"}`}
                    />
                    <span className="ds_alloc_name">{c.name}</span>
                    <span className="ds_alloc_amt">
                      {formatMoney(sim.perClass[c.id] || 0)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="ds_sim_note">
              Preferred due = funded × annual rate ÷ periods in year
              (monthly÷12, quarterly÷4, annual÷1). Prior completes in the same
              calendar month / quarter / year reduce remaining preferred dues.
              CoC uses all cash in that window, annualized. IRR uses dated cash
              flows (XIRR).
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}
