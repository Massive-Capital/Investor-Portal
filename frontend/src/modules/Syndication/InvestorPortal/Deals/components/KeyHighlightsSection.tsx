import { GripVertical, Plus, Save, Trash2 } from "lucide-react"
import { useCallback, useRef, useState } from "react"

interface KeyMetricRow {
  id: string
  metric: string
  newClass: string
  isPreset?: boolean
}

const PRESET_METRICS = [
  "Annualized return",
  "Average cash-on-cash",
  "Equity multiple",
  "IRR",
  "Holding period",
] as const

function initialRows(): KeyMetricRow[] {
  return PRESET_METRICS.map((metric, i) => ({
    id: `preset-${i}`,
    metric,
    newClass: "",
    isPreset: true,
  }))
}

function cloneRows(rows: KeyMetricRow[]): KeyMetricRow[] {
  return rows.map((r) => ({ ...r }))
}

export function KeyHighlightsSection() {
  const [rows, setRows] = useState<KeyMetricRow[]>(initialRows)
  const [savedSnapshot, setSavedSnapshot] = useState<KeyMetricRow[]>(() =>
    cloneRows(initialRows()),
  )
  const dragFromRef = useRef<number | null>(null)

  const handleSave = useCallback(() => {
    setSavedSnapshot(cloneRows(rows))
  }, [rows])

  const handleReset = useCallback(() => {
    setRows(cloneRows(savedSnapshot))
  }, [savedSnapshot])

  const addMetric = useCallback(() => {
    setRows((prev) => [
      ...prev,
      {
        id: `custom-${Date.now()}`,
        metric: "",
        newClass: "",
        isPreset: false,
      },
    ])
  }, [])

  const removeRow = useCallback((id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id))
  }, [])

  const updateRow = useCallback(
    (id: string, patch: Partial<Pick<KeyMetricRow, "metric" | "newClass">>) => {
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      )
    },
    [],
  )

  const onDragStart = useCallback((index: number) => {
    dragFromRef.current = index
  }, [])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const onDrop = useCallback((toIndex: number) => {
    const from = dragFromRef.current
    dragFromRef.current = null
    if (from === null || from === toIndex) return
    setRows((prev) => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(toIndex, 0, moved)
      return next
    })
  }, [])

  const onDragEnd = useCallback(() => {
    dragFromRef.current = null
  }, [])

  return (
    <div className="deal_kh">
      <div className="deal_kh_toolbar">
        <button
          type="button"
          className="deal_kh_add_btn"
          onClick={addMetric}
        >
          <Plus size={18} strokeWidth={2} aria-hidden />
          Add key metric
        </button>
      </div>

      <div className="deal_kh_table" role="table" aria-label="Key metrics">
        <div className="deal_kh_thead" role="rowgroup">
          <div className="deal_kh_tr deal_kh_tr_head" role="row">
            <div className="deal_kh_th deal_kh_col_drag" aria-hidden />
            <div className="deal_kh_th" role="columnheader">
              Metric
            </div>
            <div className="deal_kh_th" role="columnheader">
              New class
            </div>
            <div className="deal_kh_th deal_kh_th_actions" role="columnheader">
              Actions
            </div>
          </div>
        </div>
        <div className="deal_kh_tbody" role="rowgroup">
          {rows.map((row, index) => (
            <div
              key={row.id}
              className="deal_kh_tr deal_kh_tr_body"
              role="row"
              draggable
              onDragStart={() => onDragStart(index)}
              onDragEnd={onDragEnd}
              onDragOver={onDragOver}
              onDrop={() => onDrop(index)}
            >
              <div
                className="deal_kh_td deal_kh_col_drag"
                role="cell"
                aria-label="Reorder"
              >
                <span className="deal_kh_grip" aria-hidden>
                  <GripVertical size={18} strokeWidth={2} />
                </span>
              </div>
              <div className="deal_kh_td" role="cell">
                {row.isPreset ? (
                  <span className="deal_kh_metric_label">{row.metric}</span>
                ) : (
                  <input
                    type="text"
                    className="deal_kh_input deal_kh_input_metric"
                    placeholder="Metric name"
                    value={row.metric}
                    onChange={(e) =>
                      updateRow(row.id, { metric: e.target.value })
                    }
                    aria-label="Metric name"
                  />
                )}
              </div>
              <div className="deal_kh_td" role="cell">
                <input
                  type="text"
                  className="deal_kh_input"
                  placeholder=""
                  value={row.newClass}
                  onChange={(e) =>
                    updateRow(row.id, { newClass: e.target.value })
                  }
                  aria-label={`New class for ${row.metric || "metric"}`}
                />
              </div>
              <div
                className="deal_kh_td deal_kh_td_actions"
                role="cell"
              >
                {!row.isPreset ? (
                  <button
                    type="button"
                    className="deal_kh_row_delete"
                    onClick={() => removeRow(row.id)}
                    aria-label="Remove metric"
                  >
                    <Trash2 size={18} strokeWidth={2} aria-hidden />
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="deal_kh_footer">
        <button type="button" className="deal_kh_btn_save" onClick={handleSave}>
          <Save size={18} strokeWidth={2} aria-hidden />
          Save
        </button>
        <button
          type="button"
          className="deal_kh_btn_reset"
          onClick={handleReset}
        >
          Reset
        </button>
      </div>
    </div>
  )
}
