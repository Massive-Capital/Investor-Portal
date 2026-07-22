import { AlertTriangle } from "lucide-react"
import type { DistributionSetupClass } from "../types/distribution-setup.types"
import { CLASS_TYPE_TONE } from "../types/distribution-setup.types"
import type { SimResult } from "../utils/distributionSim"
import { formatMoney } from "../utils/distributionSim"

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
}: DistributionSimPanelProps) {
  const recipients = classes.filter((c) => (sim.perClass[c.id] || 0) > 0.5)

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
              <span>Cash available ($)</span>
              <input
                type="number"
                min={0}
                step={1000}
                value={cash}
                onChange={(e) => onCashChange(e.target.value)}
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
            <div className="ds_presets">
              <span>Try:</span>
              {["15000", "25000", "50000"].map((v) => (
                <button
                  key={v}
                  type="button"
                  className="ds_preset_btn"
                  onClick={() => onCashChange(v)}
                >
                  ${Number(v).toLocaleString("en-US")}
                </button>
              ))}
            </div>
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
                              </label>
                            ) : null}
                          </td>
                          <td className="r">
                            {r.due == null ? (
                              "—"
                            ) : paymentId ? (
                              <input
                                className="ds_due_in"
                                type="number"
                                value={Math.round(r.due)}
                                onChange={(e) =>
                                  onDueOverride(paymentId, e.target.value)
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
              Illustrative for one period using Class Setup funded balances.
              Hurdle status is a manual toggle here.
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}
