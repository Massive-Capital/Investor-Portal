import type { ClassSetupValidation } from "../types/class-setup.types"
import type { ClassSetupTotals } from "../utils/classSetupTotals"
import { formatMoney, formatPct } from "../utils/classSetupTotals"

interface ClassSetupSummaryPanelProps {
  totals: ClassSetupTotals
  validation: ClassSetupValidation
  latestChanges: string
}

export function ClassSetupSummaryPanel({
  totals,
  validation,
  latestChanges,
}: ClassSetupSummaryPanelProps) {
  const ownershipOk = Math.abs(totals.equityOwnershipTotal - 100) < 0.05
  const validCount = validation.checks.filter((c) => c.ok).length

  return (
    <aside className="cs_summary_rail" aria-label="Class setup summary">
      <div className="cs_card">
        <div className="cs_card_pad">
          <p className="cs_eyebrow">Capitalization Summary</p>
          <div className="cs_stat">
            <span className="k">Class Count</span>
            <span className="v">{totals.classCount}</span>
          </div>
          <div className="cs_stat">
            <span className="k">Target Raise</span>
            <span className="v">{formatMoney(totals.targetRaise)}</span>
          </div>
          <div className="cs_stat">
            <span className="k">Actually Funded</span>
            <span className="v">{formatMoney(totals.actuallyFunded)}</span>
          </div>
          <div className="cs_stat">
            <span className="k">Ownership %</span>
            <span
              className="v"
              style={{
                color: ownershipOk
                  ? "var(--cs-good-text)"
                  : "var(--cs-critical)",
              }}
            >
              {formatPct(totals.equityOwnershipTotal)}
            </span>
          </div>
          <div className="cs_stat">
            <span className="k">Preferred Classes</span>
            <span className="v">{totals.preferredClassCount}</span>
          </div>
        </div>
      </div>

      <div className="cs_card">
        <div className="cs_card_pad">
          <p className="cs_eyebrow">Setup Validation</p>
          <div className="cs_stat">
            <span className="k">Checks passing</span>
            <span className="v">
              {validCount}/{validation.checks.length}
            </span>
          </div>
          <div className="cs_stat">
            <span className="k">Save ready</span>
            <span
              className="v"
              style={{
                color: validation.canSave
                  ? "var(--cs-good-text)"
                  : "var(--cs-critical)",
              }}
            >
              {validation.canSave ? "Yes" : "No"}
            </span>
          </div>
        </div>
      </div>

      <div className="cs_card">
        <div className="cs_card_pad">
          <p className="cs_eyebrow">Latest Changes</p>
          <p style={{ margin: 0, fontSize: 13, color: "var(--cs-ink-2)" }}>
            {latestChanges?.trim() || "No changes saved yet"}
          </p>
        </div>
      </div>
    </aside>
  )
}
