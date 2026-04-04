import { Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react"
import { useCallback, useEffect, useId, useState, type ReactNode } from "react"
import { PortalSelect, type PortalSelectOption } from "./PortalSelect"
import {
  createDealInvestorClass,
  deleteDealInvestorClass,
  fetchDealInvestorClasses,
  updateDealInvestorClass,
} from "../api/dealsApi"
import type {
  DealInvestorClass,
  DealInvestorClassFormValues,
} from "../types/deal-investor-class.types"
import {
  INVESTOR_CLASS_STATUS_LEGACY_OPTIONS,
  INVESTOR_CLASS_STATUS_OPTIONS,
  INVESTOR_CLASS_VISIBILITY_OPTIONS,
  investorClassStatusLabel,
  investorClassVisibilityLabel,
} from "../utils/offeringDisplayLabels"
import { formatDateDdMmmYyyy } from "../../../../../common/utils/formatDateDisplay"
import {
  blurFormatMoneyInput,
  formatMoneyFieldDisplay,
} from "../utils/offeringMoneyFormat"
import "../deal-investor-class.css"
import "../../../../usermanagement/user_management.css"
import "./add-investment-modal.css"

const STATUS_SELECT_OPTIONS: PortalSelectOption[] =
  INVESTOR_CLASS_STATUS_OPTIONS.map((o) => ({
    value: o.value,
    label: o.label,
  }))

const STATUS_SELECT_OPTIONS_WITH_LEGACY: PortalSelectOption[] = [
  ...STATUS_SELECT_OPTIONS,
  ...INVESTOR_CLASS_STATUS_LEGACY_OPTIONS,
]

/** Case-insensitive, trimmed comparison for duplicate class names on the same deal */
function normalizeInvestorClassNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ")
}

function isDuplicateInvestorClassName(
  name: string,
  existing: DealInvestorClass[],
  excludeClassId?: string,
): boolean {
  const key = normalizeInvestorClassNameKey(name)
  if (!key) return false
  return existing.some(
    (r) =>
      r.id !== excludeClassId &&
      normalizeInvestorClassNameKey(r.name) === key,
  )
}

function emptyForm(): DealInvestorClassFormValues {
  return {
    name: "",
    subscriptionType: "",
    entityName: "",
    startDate: "",
    offeringSize: "",
    minimumInvestment: "",
    pricePerUnit: "",
    status: "closed",
    visibility: "",
  }
}

function rowToForm(row: DealInvestorClass): DealInvestorClassFormValues {
  return {
    name: row.name,
    subscriptionType: row.subscriptionType,
    entityName: row.entityName,
    startDate: row.startDate,
    offeringSize: blurFormatMoneyInput(row.offeringSize ?? ""),
    minimumInvestment: blurFormatMoneyInput(row.minimumInvestment ?? ""),
    pricePerUnit: blurFormatMoneyInput(row.pricePerUnit ?? ""),
    status: row.status || "closed",
    visibility: row.visibility,
  }
}

function ClassFieldsForm({
  form,
  setForm,
  disabled,
  statusOptions = STATUS_SELECT_OPTIONS,
}: {
  form: DealInvestorClassFormValues
  setForm: (p: Partial<DealInvestorClassFormValues>) => void
  disabled?: boolean
  statusOptions?: PortalSelectOption[]
}) {
  const fieldIds = useId()
  return (
    <div className="deal_inv_class_fields">
      <div className="deal_inv_class_field">
        <label
          className="deal_inv_class_field_label"
          htmlFor={`${fieldIds}-os`}
        >
          Offering Size
        </label>
        <input
          id={`${fieldIds}-os`}
          type="text"
          className="deals_add_inv_field_control deals_add_inv_input"
          placeholder="$0"
          inputMode="decimal"
          value={form.offeringSize}
          onChange={(e) => setForm({ offeringSize: e.target.value })}
          onBlur={(e) =>
            setForm({ offeringSize: blurFormatMoneyInput(e.target.value) })
          }
          disabled={disabled}
        />
      </div>
      <div className="deal_inv_class_field">
        <label
          className="deal_inv_class_field_label"
          htmlFor={`${fieldIds}-min`}
        >
          Minimum Investment
        </label>
        <input
          id={`${fieldIds}-min`}
          type="text"
          className="deals_add_inv_field_control deals_add_inv_input"
          placeholder="$0"
          inputMode="decimal"
          value={form.minimumInvestment}
          onChange={(e) => setForm({ minimumInvestment: e.target.value })}
          onBlur={(e) =>
            setForm({
              minimumInvestment: blurFormatMoneyInput(e.target.value),
            })
          }
          disabled={disabled}
        />
      </div>
      <div className="deal_inv_class_field">
        <label
          className="deal_inv_class_field_label"
          htmlFor={`${fieldIds}-ppu`}
        >
          Price Per Unit
        </label>
        <input
          id={`${fieldIds}-ppu`}
          type="text"
          className="deals_add_inv_field_control deals_add_inv_input"
          placeholder="$0"
          inputMode="decimal"
          value={form.pricePerUnit}
          onChange={(e) => setForm({ pricePerUnit: e.target.value })}
          onBlur={(e) =>
            setForm({ pricePerUnit: blurFormatMoneyInput(e.target.value) })
          }
          disabled={disabled}
        />
      </div>
      <div className="deal_inv_class_field">
        <label
          className="deal_inv_class_field_label"
          id={`${fieldIds}-status-lbl`}
          htmlFor={`${fieldIds}-status`}
        >
          Status
        </label>
        <PortalSelect
          id={`${fieldIds}-status`}
          labelledBy={`${fieldIds}-status-lbl`}
          value={form.status}
          options={statusOptions}
          onChange={(status) => setForm({ status })}
          disabled={disabled}
          placeholder="Select status"
        />
      </div>
      <div className="deal_inv_class_field">
        <label
          className="deal_inv_class_field_label"
          id={`${fieldIds}-vis-lbl`}
          htmlFor={`${fieldIds}-vis`}
        >
          Visibility
        </label>
        <PortalSelect
          id={`${fieldIds}-vis`}
          labelledBy={`${fieldIds}-vis-lbl`}
          value={form.visibility}
          options={INVESTOR_CLASS_VISIBILITY_OPTIONS}
          onChange={(visibility) => setForm({ visibility })}
          disabled={disabled}
          placeholder="Select Visibility"
        />
      </div>
    </div>
  )
}

function ReadOnlyInvestorClassCard({
  row,
  onEdit,
  onDelete,
}: {
  row: DealInvestorClass
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="deal_inv_class_card" id={`deal-inv-class-${row.id}`}>
      <div className="deal_inv_class_card_head">
        <div className="deal_inv_class_card_title_row">
          <h4 className="deal_inv_class_card_title">{row.name || "—"}</h4>
        </div>
      </div>
      <p className="deal_inv_class_meta_line">
        <span>{row.subscriptionType || "—"}</span>
        <span className="deal_inv_class_meta_sep">·</span>
        <span>{row.entityName || "—"}</span>
        <span className="deal_inv_class_meta_sep">·</span>
        <span>{formatDateDdMmmYyyy(row.startDate)}</span>
      </p>
      <div className="deal_inv_class_card_divider" />
      <div className="deal_inv_class_metrics_h">
        <div className="deal_inv_class_metrics_h_items">
          <div className="deal_inv_class_metric_h">
            <span className="deal_inv_class_metric_h_label">Offering Size</span>
            <span className="deal_inv_class_metric_h_value">
              {formatMoneyFieldDisplay(row.offeringSize)}
            </span>
          </div>
          <div className="deal_inv_class_metric_h">
            <span className="deal_inv_class_metric_h_label">
              Minimum Investment
            </span>
            <span className="deal_inv_class_metric_h_value">
              {formatMoneyFieldDisplay(row.minimumInvestment)}
            </span>
          </div>
          <div className="deal_inv_class_metric_h">
            <span className="deal_inv_class_metric_h_label">Price Per Unit</span>
            <span className="deal_inv_class_metric_h_value">
              {formatMoneyFieldDisplay(row.pricePerUnit)}
            </span>
          </div>
          <div className="deal_inv_class_metric_h">
            <span className="deal_inv_class_metric_h_label">Status</span>
            <span className="deal_inv_class_metric_h_value">
              {investorClassStatusLabel(row.status)}
            </span>
          </div>
          <div className="deal_inv_class_metric_h">
            <span className="deal_inv_class_metric_h_label">Visibility</span>
            <span className="deal_inv_class_metric_h_value">
              {investorClassVisibilityLabel(row.visibility)}
            </span>
          </div>
        </div>
        <div
          className="deal_inv_class_metrics_h_actions"
          role="group"
          aria-label={`Actions for ${row.name || "investor class"}`}
        >
          <button
            type="button"
            className="deal_inv_class_h_icon_btn"
            onClick={onEdit}
            aria-label={`Edit ${row.name || "investor class"}`}
          >
            <Pencil size={17} strokeWidth={2} aria-hidden />
          </button>
          <button
            type="button"
            className="deal_inv_class_h_icon_btn deal_inv_class_h_icon_btn_danger"
            onClick={onDelete}
            aria-label={`Delete ${row.name || "investor class"}`}
          >
            <Trash2 size={17} strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  )
}

function AddInvestorClassModal({
  open,
  dealId,
  existingClasses,
  onClose,
  onCreated,
}: {
  open: boolean
  dealId: string
  existingClasses: DealInvestorClass[]
  onClose: () => void
  onCreated: () => void
}) {
  const titleId = useId()
  const [form, setForm] = useState(emptyForm)
  const [err, setErr] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const patch = useCallback((p: Partial<DealInvestorClassFormValues>) => {
    setForm((prev) => ({ ...prev, ...p }))
  }, [])

  useEffect(() => {
    if (!open) return
    setForm(emptyForm())
    setErr(null)
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      setErr("Name is required.")
      return
    }
    if (isDuplicateInvestorClassName(form.name, existingClasses)) {
      setErr(
        "An investor class with this name already exists for this deal. Use a unique name.",
      )
      return
    }
    setErr(null)
    setSubmitting(true)
    try {
      await createDealInvestorClass(dealId, form)
      onCreated()
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not create.")
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="um_modal_overlay deals_add_inv_modal_overlay portal_modal_z_boost"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="um_modal um_modal_view deals_add_inv_modal_panel deal_inv_offering_modal deal_inv_ic_form_modal_panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="um_modal_head">
          <h3 id={titleId} className="um_modal_title">
            Add Investor Class
          </h3>
          <button
            type="button"
            className="um_modal_close"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
          >
            <X size={20} strokeWidth={2} aria-hidden />
          </button>
        </div>
        <form className="deals_add_inv_modal_form" onSubmit={handleSubmit}>
          <div className="deals_add_inv_modal_body deal_inv_ic_modal_form_grid">
            {err ? (
              <p className="um_msg_error um_modal_form_error" role="alert">
                {err}
              </p>
            ) : null}
            <div className="deal_inv_class_field">
              <label className="deal_inv_class_field_label" htmlFor="add-ic-name">
                Class name <span className="deal_inv_required">*</span>
              </label>
              <input
                id="add-ic-name"
                type="text"
                className="deals_add_inv_field_control deals_add_inv_input"
                placeholder="e.g. Class D"
                value={form.name}
                onChange={(e) => {
                  setErr(null)
                  patch({ name: e.target.value })
                }}
                disabled={submitting}
                aria-invalid={Boolean(err)}
              />
            </div>
            <div className="deal_inv_class_field">
              <label className="deal_inv_class_field_label" htmlFor="add-ic-sub">
                Subscription Type
              </label>
              <input
                id="add-ic-sub"
                type="text"
                className="deals_add_inv_field_control deals_add_inv_input"
                value={form.subscriptionType}
                onChange={(e) => patch({ subscriptionType: e.target.value })}
                disabled={submitting}
              />
            </div>
            <div className="deal_inv_class_field">
              <label className="deal_inv_class_field_label" htmlFor="add-ic-ent">
                Entity Name
              </label>
              <input
                id="add-ic-ent"
                type="text"
                className="deals_add_inv_field_control deals_add_inv_input"
                value={form.entityName}
                onChange={(e) => patch({ entityName: e.target.value })}
                disabled={submitting}
              />
            </div>
            <div className="deal_inv_class_field">
              <label
                className="deal_inv_class_field_label"
                htmlFor="add-ic-start"
              >
                Start Date
              </label>
              <input
                id="add-ic-start"
                type="date"
                className="deals_add_inv_field_control deals_add_inv_input"
                value={form.startDate?.slice(0, 10) ?? ""}
                onChange={(e) => patch({ startDate: e.target.value })}
                disabled={submitting}
              />
            </div>
            <ClassFieldsForm form={form} setForm={patch} disabled={submitting} />
          </div>
          <div className="um_modal_actions">
            <button
              type="button"
              className="um_btn_secondary"
              onClick={onClose}
              disabled={submitting}
            >
              <X size={16} strokeWidth={2} aria-hidden />
              Cancel
            </button>
            <button type="submit" className="um_btn_primary" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2
                    size={16}
                    strokeWidth={2}
                    className="deal_ic_modal_btn_spin"
                    aria-hidden
                  />
                  Saving…
                </>
              ) : (
                <>
                  <Save size={16} strokeWidth={2} aria-hidden />
                  Save
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditInvestorClassModal({
  open,
  dealId,
  row,
  existingClasses,
  onClose,
  onSaved,
}: {
  open: boolean
  dealId: string
  row: DealInvestorClass | null
  existingClasses: DealInvestorClass[]
  onClose: () => void
  onSaved: () => void
}) {
  const titleId = useId()
  const [form, setForm] = useState(emptyForm)
  const [err, setErr] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const patch = useCallback((p: Partial<DealInvestorClassFormValues>) => {
    setForm((prev) => ({ ...prev, ...p }))
  }, [])

  useEffect(() => {
    if (!open || !row) return
    setForm(rowToForm(row))
    setErr(null)
  }, [open, row])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!row) return
    if (!form.name.trim()) {
      setErr("Name is required.")
      return
    }
    if (isDuplicateInvestorClassName(form.name, existingClasses, row.id)) {
      setErr(
        "Another investor class already uses this name for this deal. Choose a unique name.",
      )
      return
    }
    setErr(null)
    setSubmitting(true)
    try {
      await updateDealInvestorClass(dealId, row.id, form)
      onSaved()
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save.")
    } finally {
      setSubmitting(false)
    }
  }

  if (!open || !row) return null

  return (
    <div
      className="um_modal_overlay deals_add_inv_modal_overlay portal_modal_z_boost"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="um_modal um_modal_view deals_add_inv_modal_panel deal_inv_offering_modal deal_inv_ic_form_modal_panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="um_modal_head">
          <h3 id={titleId} className="um_modal_title">
            Edit investor class
          </h3>
          <button
            type="button"
            className="um_modal_close"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
          >
            <X size={20} strokeWidth={2} aria-hidden />
          </button>
        </div>
        <form className="deals_add_inv_modal_form" onSubmit={handleSubmit}>
          <div className="deals_add_inv_modal_body deal_inv_ic_modal_form_grid">
            {err ? (
              <p className="um_msg_error um_modal_form_error" role="alert">
                {err}
              </p>
            ) : null}
            <div className="deal_inv_class_field">
              <label className="deal_inv_class_field_label" htmlFor="edit-ic-name">
                Class name <span className="deal_inv_required">*</span>
              </label>
              <input
                id="edit-ic-name"
                type="text"
                className="deals_add_inv_field_control deals_add_inv_input"
                placeholder="e.g. Class D"
                value={form.name}
                onChange={(e) => {
                  setErr(null)
                  patch({ name: e.target.value })
                }}
                disabled={submitting}
                aria-invalid={Boolean(err)}
              />
            </div>
            <div className="deal_inv_class_field">
              <label className="deal_inv_class_field_label" htmlFor="edit-ic-sub">
                Subscription Type
              </label>
              <input
                id="edit-ic-sub"
                type="text"
                className="deals_add_inv_field_control deals_add_inv_input"
                value={form.subscriptionType}
                onChange={(e) => patch({ subscriptionType: e.target.value })}
                disabled={submitting}
              />
            </div>
            <div className="deal_inv_class_field">
              <label className="deal_inv_class_field_label" htmlFor="edit-ic-ent">
                Entity Name
              </label>
              <input
                id="edit-ic-ent"
                type="text"
                className="deals_add_inv_field_control deals_add_inv_input"
                value={form.entityName}
                onChange={(e) => patch({ entityName: e.target.value })}
                disabled={submitting}
              />
            </div>
            <div className="deal_inv_class_field">
              <label
                className="deal_inv_class_field_label"
                htmlFor="edit-ic-start"
              >
                Start Date
              </label>
              <input
                id="edit-ic-start"
                type="date"
                className="deals_add_inv_field_control deals_add_inv_input"
                value={form.startDate?.slice(0, 10) ?? ""}
                onChange={(e) => patch({ startDate: e.target.value })}
                disabled={submitting}
              />
            </div>
            <ClassFieldsForm
              form={form}
              setForm={patch}
              disabled={submitting}
              statusOptions={STATUS_SELECT_OPTIONS_WITH_LEGACY}
            />
          </div>
          <div className="um_modal_actions">
            <button
              type="button"
              className="um_btn_secondary"
              onClick={onClose}
              disabled={submitting}
            >
              <X size={16} strokeWidth={2} aria-hidden />
              Cancel
            </button>
            <button type="submit" className="um_btn_primary" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2
                    size={16}
                    strokeWidth={2}
                    className="deal_ic_modal_btn_spin"
                    aria-hidden
                  />
                  Saving…
                </>
              ) : (
                <>
                  <Save size={16} strokeWidth={2} aria-hidden />
                  Save
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function InvestorClassConfirmDeleteModal({
  open,
  classLabel,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean
  classLabel: string
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const titleId = useId()
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onCancel()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, busy, onCancel])

  if (!open) return null

  return (
    <div
      className="um_modal_overlay deals_add_inv_modal_overlay portal_modal_z_boost deal_ic_dialog_overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (busy) return
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        className="um_modal um_modal_view deals_add_inv_modal_panel deal_inv_offering_modal deal_ic_dialog_shell"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="um_modal_head">
          <h3 id={titleId} className="um_modal_title">
            Delete investor class
          </h3>
          <button
            type="button"
            className="um_modal_close"
            onClick={onCancel}
            disabled={busy}
            aria-label="Close"
          >
            <X size={20} strokeWidth={2} aria-hidden />
          </button>
        </div>
        <div className="deal_ic_dialog_body">
          <p className="deal_ic_dialog_message">
            Delete &quot;{classLabel}&quot;? This cannot be undone.
          </p>
        </div>
        <div className="um_modal_actions">
          <button
            type="button"
            className="um_btn_secondary"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="um_btn_primary deal_ic_dialog_btn_danger"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  )
}

function InvestorClassMessageModal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
}) {
  const titleId = useId()
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="um_modal_overlay deals_add_inv_modal_overlay portal_modal_z_boost deal_ic_dialog_overlay deal_ic_message_overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="um_modal um_modal_view deals_add_inv_modal_panel deal_inv_offering_modal deal_ic_dialog_shell"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="um_modal_head">
          <h3 id={titleId} className="um_modal_title">
            {title}
          </h3>
          <button
            type="button"
            className="um_modal_close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} strokeWidth={2} aria-hidden />
          </button>
        </div>
        <div className="deal_ic_dialog_body">{children}</div>
        <div className="um_modal_actions">
          <button
            type="button"
            className="um_btn_primary"
            onClick={onClose}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  )
}

export function OfferingInformationSection({
  dealId,
}: {
  dealId: string
}) {
  const [rows, setRows] = useState<DealInvestorClass[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [editRow, setEditRow] = useState<DealInvestorClass | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DealInvestorClass | null>(
    null,
  )
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const list = await fetchDealInvestorClasses(dealId)
    setRows(list)
    setLoading(false)
  }, [dealId])

  useEffect(() => {
    void load()
  }, [load])

  async function confirmDeleteInvestorClass() {
    const r = deleteTarget
    if (!r) return
    setDeleteBusy(true)
    try {
      await deleteDealInvestorClass(dealId, r.id)
      setDeleteTarget(null)
      await load()
    } catch (e) {
      setDeleteTarget(null)
      setNoticeMessage(
        e instanceof Error ? e.message : "Could not delete this investor class.",
      )
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <div className="deal_offering_info">
      <div className="deal_offering_info_toolbar">
        {!loading && rows.length === 0 ? (
          <p className="deal_offering_toolbar_hint">
            No investor classes yet. Click &quot;Add Investor Class&quot; to create
            one.
          </p>
        ) : null}
        <button
          type="button"
          className="um_btn_primary deal_offering_add_ic_btn"
          onClick={() => setAddOpen(true)}
        >
          <Plus size={18} strokeWidth={2} aria-hidden />
          Add Investor Class
        </button>
      </div>

      {loading ? (
        <p className="deal_offering_muted" role="status">
          Loading investor classes…
        </p>
      ) : null}

      <div className="deal_inv_class_cards">
        {rows.map((r) => (
          <ReadOnlyInvestorClassCard
            key={r.id}
            row={r}
            onEdit={() => setEditRow(r)}
            onDelete={() => setDeleteTarget(r)}
          />
        ))}
      </div>

      <AddInvestorClassModal
        open={addOpen}
        dealId={dealId}
        existingClasses={rows}
        onClose={() => setAddOpen(false)}
        onCreated={() => void load()}
      />
      <EditInvestorClassModal
        open={editRow != null}
        dealId={dealId}
        row={editRow}
        existingClasses={rows}
        onClose={() => setEditRow(null)}
        onSaved={() => void load()}
      />

      <InvestorClassConfirmDeleteModal
        open={deleteTarget != null}
        classLabel={
          deleteTarget?.name.trim() || "this investor class"
        }
        busy={deleteBusy}
        onCancel={() => {
          if (deleteBusy) return
          setDeleteTarget(null)
        }}
        onConfirm={() => void confirmDeleteInvestorClass()}
      />

      <InvestorClassMessageModal
        open={noticeMessage != null}
        title="Could not delete"
        onClose={() => setNoticeMessage(null)}
      >
        <p className="deal_ic_dialog_message" role="alert">
          {noticeMessage}
        </p>
      </InvestorClassMessageModal>
    </div>
  )
}
