import { HelpCircle, Info, Loader2, RotateCcw, Save } from "lucide-react"
import { useCallback, useEffect, useId, useMemo, useState } from "react"
import { toast } from "../../../../../common/components/Toast"
import {
  fetchDealById,
  fetchDealInvestorClasses,
  patchDealOfferingOverview,
  updateDealInvestorClass,
  type DealDetailApi,
} from "../api/dealsApi"
import { computeDealAssetRowsFromClientStorage } from "../types/deal-asset.types"
import { DEAL_FORM_TYPE_OPTIONS } from "../types/deals.types"
import type { DealInvestorClass } from "../types/deal-investor-class.types"
import { blurFormatMoneyInput } from "../utils/offeringMoneyFormat"
import {
  DEFAULT_OFFERING_STATUS,
  DEFAULT_OFFERING_VISIBILITY,
  mapLegacyOfferingVisibility,
  OFFERING_STATUS_OPTIONS,
  OFFERING_VISIBILITY_OPTIONS,
  type OfferingStatusValue,
  type OfferingVisibilityValue,
} from "../utils/offeringOverviewForm"
import { investorClassRowToFormValues } from "./OfferingInformationSection"
import { OfferingOverviewAssetsMultiSelect } from "./OfferingOverviewAssetsMultiSelect"
import { OfferingOverviewLocationMap } from "./OfferingOverviewLocationMap"

type OfferingOverviewSectionProps = {
  detail: DealDetailApi
  onSaved?: (deal: DealDetailApi) => void
}

type OverviewDraft = {
  offeringStatus: OfferingStatusValue
  offeringVisibility: OfferingVisibilityValue
  dealName: string
  dealType: string
  selectedAssetIds: string[]
  selectedClassId: string
  classOfferingSize: string
  classMinimumInvestment: string
  classPricePerUnit: string
}

function normalizeStatus(v: string | undefined): OfferingStatusValue {
  const raw = String(v ?? "").trim()
  const ok = OFFERING_STATUS_OPTIONS.some((o) => o.value === raw)
  return ok ? (raw as OfferingStatusValue) : DEFAULT_OFFERING_STATUS
}

function normalizeVisibility(v: string | undefined): OfferingVisibilityValue {
  const mapped = mapLegacyOfferingVisibility(String(v ?? ""))
  const ok = OFFERING_VISIBILITY_OPTIONS.some((o) => o.value === mapped)
  return ok ? (mapped as OfferingVisibilityValue) : DEFAULT_OFFERING_VISIBILITY
}

function stateFromDetail(d: DealDetailApi): OverviewDraft {
  return {
    offeringStatus: normalizeStatus(d.offeringStatus),
    offeringVisibility: normalizeVisibility(d.offeringVisibility),
    dealName: d.dealName?.trim() || "",
    dealType: (d.dealType ?? "").trim(),
    selectedAssetIds: [...(d.offeringOverviewAssetIds ?? [])],
    selectedClassId: "",
    classOfferingSize: "",
    classMinimumInvestment: "",
    classPricePerUnit: "",
  }
}

/** Apply server overview fields while keeping a valid investor-class selection when possible. */
function mergeOverviewDraftWithClasses(
  base: OverviewDraft,
  prev: OverviewDraft,
  classes: DealInvestorClass[],
): OverviewDraft {
  if (classes.length === 0) {
    return {
      ...base,
      selectedClassId: "",
      classOfferingSize: "",
      classMinimumInvestment: "",
      classPricePerUnit: "",
    }
  }
  const pick =
    prev.selectedClassId && classes.some((c) => c.id === prev.selectedClassId)
      ? prev.selectedClassId
      : classes[0]!.id
  const row = classes.find((c) => c.id === pick)
  if (!row) {
    return {
      ...base,
      selectedClassId: pick,
      classOfferingSize: "",
      classMinimumInvestment: "",
      classPricePerUnit: "",
    }
  }
  return {
    ...base,
    selectedClassId: pick,
    classOfferingSize: blurFormatMoneyInput(row.offeringSize ?? ""),
    classMinimumInvestment: blurFormatMoneyInput(
      row.minimumInvestment ?? "",
    ),
    classPricePerUnit: blurFormatMoneyInput(row.pricePerUnit ?? ""),
  }
}

function sortedIdsKey(ids: string[]): string {
  return [...ids].sort().join("\0")
}

function draftEqual(a: OverviewDraft, b: OverviewDraft): boolean {
  return (
    a.offeringStatus === b.offeringStatus &&
    a.offeringVisibility === b.offeringVisibility &&
    a.dealName === b.dealName &&
    a.dealType === b.dealType &&
    sortedIdsKey(a.selectedAssetIds) === sortedIdsKey(b.selectedAssetIds) &&
    a.selectedClassId === b.selectedClassId &&
    a.classOfferingSize === b.classOfferingSize &&
    a.classMinimumInvestment === b.classMinimumInvestment &&
    a.classPricePerUnit === b.classPricePerUnit
  )
}

export function OfferingOverviewSection({
  detail,
  onSaved,
}: OfferingOverviewSectionProps) {
  const visibilityHintId = useId()

  const [classes, setClasses] = useState<DealInvestorClass[]>([])
  const [draft, setDraft] = useState<OverviewDraft>(() =>
    stateFromDetail(detail),
  )
  const [savedSnapshot, setSavedSnapshot] = useState<OverviewDraft>(() =>
    stateFromDetail(detail),
  )
  const [saving, setSaving] = useState(false)

  const reloadClasses = useCallback(async () => {
    const list = await fetchDealInvestorClasses(detail.id)
    setClasses(list)
  }, [detail.id])

  useEffect(() => {
    setClasses([])
    void reloadClasses()
  }, [reloadClasses])

  useEffect(() => {
    const base = stateFromDetail(detail)
    setDraft((d) => mergeOverviewDraftWithClasses(base, d, classes))
    setSavedSnapshot((s) => mergeOverviewDraftWithClasses(base, s, classes))
  }, [
    detail.id,
    detail.offeringStatus,
    detail.offeringVisibility,
    detail.dealName,
    detail.dealType,
    sortedIdsKey(detail.offeringOverviewAssetIds ?? []),
    classes,
  ])

  const isDirty = useMemo(
    () => !draftEqual(draft, savedSnapshot),
    [draft, savedSnapshot],
  )

  const handleReset = useCallback(() => {
    setDraft({ ...savedSnapshot })
  }, [savedSnapshot])

  const handleSave = useCallback(async () => {
    if (saving) return
    const name = draft.dealName.trim()
    if (!name) {
      toast.error("Offering name is required.")
      return
    }

    const overviewBitsEqual =
      draft.offeringStatus === savedSnapshot.offeringStatus &&
      draft.offeringVisibility === savedSnapshot.offeringVisibility &&
      draft.dealName === savedSnapshot.dealName &&
      draft.dealType === savedSnapshot.dealType &&
      sortedIdsKey(draft.selectedAssetIds) ===
        sortedIdsKey(savedSnapshot.selectedAssetIds)

    const classBitsEqual =
      draft.selectedClassId === savedSnapshot.selectedClassId &&
      draft.classOfferingSize === savedSnapshot.classOfferingSize &&
      draft.classMinimumInvestment === savedSnapshot.classMinimumInvestment &&
      draft.classPricePerUnit === savedSnapshot.classPricePerUnit

    if (overviewBitsEqual && classBitsEqual) return

    if (!classBitsEqual && classes.length === 0) {
      toast.error("Add an investor class under Classes to save these fields.")
      return
    }

    if (!classBitsEqual && !draft.selectedClassId) {
      toast.error("Select an investor class.")
      return
    }

    setSaving(true)
    try {
      let dealOut: DealDetailApi | null = null

      if (!overviewBitsEqual) {
        const res = await patchDealOfferingOverview(detail.id, {
          offeringStatus: draft.offeringStatus,
          offeringVisibility: draft.offeringVisibility,
          dealName: name,
          dealType: draft.dealType.trim(),
          offeringOverviewAssetIds: draft.selectedAssetIds,
        })
        if (!res.ok) {
          toast.error(res.message)
          return
        }
        dealOut = res.deal
      }

      if (!classBitsEqual) {
        const row = classes.find((c) => c.id === draft.selectedClassId)
        if (!row) {
          toast.error("Selected class was not found.")
          return
        }
        const form = investorClassRowToFormValues(row)
        form.offeringSize = draft.classOfferingSize
        form.minimumInvestment = draft.classMinimumInvestment
        form.pricePerUnit = draft.classPricePerUnit
        try {
          await updateDealInvestorClass(
            detail.id,
            draft.selectedClassId,
            form,
          )
        } catch (e) {
          toast.error(
            e instanceof Error ? e.message : "Could not save class fields.",
          )
          return
        }
        try {
          dealOut = await fetchDealById(detail.id)
        } catch (e) {
          toast.error(
            e instanceof Error
              ? e.message
              : "Saved class fields but could not reload the deal.",
          )
          return
        }
      }

      if (!dealOut) {
        try {
          dealOut = await fetchDealById(detail.id)
        } catch (e) {
          toast.error(
            e instanceof Error
              ? e.message
              : "Could not reload the deal after save.",
          )
          return
        }
      }

      onSaved?.(dealOut)
      const list = await fetchDealInvestorClasses(detail.id)
      setClasses(list)
      const base = stateFromDetail(dealOut)
      const merged = mergeOverviewDraftWithClasses(base, draft, list)
      setDraft(merged)
      setSavedSnapshot({ ...merged })
      toast.success("Offering overview saved.")
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not save offering overview.",
      )
    } finally {
      setSaving(false)
    }
  }, [classes, detail.id, draft, onSaved, savedSnapshot, saving])

  const visibilityOptionHint = useMemo(() => {
    const opt = OFFERING_VISIBILITY_OPTIONS.find(
      (o) => o.value === draft.offeringVisibility,
    )
    return opt && "optionHint" in opt
      ? (opt as { optionHint?: string }).optionHint
      : undefined
  }, [draft.offeringVisibility])

  const assetRows = useMemo(
    () =>
      computeDealAssetRowsFromClientStorage(detail).filter(
        (r) => !r.archived,
      ),
    [detail],
  )

  const id = detail.id
  const classFieldsDisabled = classes.length === 0

  return (
    <div className="deal_offering_overview">
      <p className="deal_offering_overview_hint">
        Set how this offering appears to investors. Deal structure, linked
        assets, and class economics can be edited here; full class setup stays
        under <strong>Classes</strong>. Property location and entity details
        remain on the main deal profile.
      </p>

      <OfferingOverviewLocationMap detail={detail} />

      <div className="deal_kh">
        <div className="deal_kh_table" role="table" aria-label="Offering overview">
          <div className="deal_kh_thead" role="rowgroup">
            <div
              className="deal_kh_tr deal_kh_tr_head deal_kh_tr_head_ov"
              role="row"
            >
              <div className="deal_kh_th" role="columnheader">
                Field
              </div>
              <div className="deal_kh_th" role="columnheader">
                Value
              </div>
            </div>
          </div>
          <div className="deal_kh_tbody" role="rowgroup">
            <div
              className="deal_kh_tr deal_kh_tr_body deal_kh_tr_body_ov"
              role="row"
            >
              <div className="deal_kh_td" role="cell">
                <span className="deal_kh_metric_label deal_offering_ov_label_line">
                  Status
                  <span className="deal_offering_ov_req" aria-hidden>
                    *
                  </span>
                </span>
              </div>
              <div className="deal_kh_td" role="cell">
                <select
                  id={`deal-ov-status-${id}`}
                  className="deal_kh_select"
                  value={draft.offeringStatus}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      offeringStatus: normalizeStatus(e.target.value),
                    }))
                  }
                >
                  {OFFERING_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div
              className="deal_kh_tr deal_kh_tr_body deal_kh_tr_body_ov"
              role="row"
            >
              <div className="deal_kh_td" role="cell">
                <span className="deal_kh_metric_label deal_offering_ov_label_line">
                  Visibility
                  <span className="deal_offering_ov_req" aria-hidden>
                    *
                  </span>
                </span>
              </div>
              <div className="deal_kh_td deal_kh_td_stack" role="cell">
                <select
                  id={`deal-ov-vis-${id}`}
                  className="deal_kh_select"
                  value={draft.offeringVisibility}
                  aria-describedby={
                    visibilityOptionHint ? visibilityHintId : undefined
                  }
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      offeringVisibility: normalizeVisibility(e.target.value),
                    }))
                  }
                >
                  {OFFERING_VISIBILITY_OPTIONS.map((o) => (
                    <option
                      key={o.value}
                      value={o.value}
                      title={
                        "optionHint" in o
                          ? (o as { optionHint?: string }).optionHint
                          : undefined
                      }
                    >
                      {o.label}
                    </option>
                  ))}
                </select>
                {visibilityOptionHint ? (
                  <div
                    id={visibilityHintId}
                    className="deal_offering_visibility_hint"
                    role="note"
                  >
                    <Info
                      size={15}
                      strokeWidth={2}
                      className="deal_offering_visibility_hint_icon"
                      aria-hidden
                    />
                    <span>{visibilityOptionHint}</span>
                  </div>
                ) : null}
              </div>
            </div>

            <div
              className="deal_kh_tr deal_kh_tr_body deal_kh_tr_body_ov"
              role="row"
            >
              <div className="deal_kh_td" role="cell">
                <span className="deal_kh_metric_label deal_offering_ov_label_line">
                  <span>Offering name</span>
                  <span className="deal_offering_ov_req" aria-hidden>
                    *
                  </span>
                  <span
                    className="deal_offering_ov_help"
                    title="Title investors see for this offering."
                  >
                    <HelpCircle size={14} strokeWidth={2} aria-hidden />
                  </span>
                </span>
              </div>
              <div className="deal_kh_td" role="cell">
                <input
                  id={`deal-ov-oname-${id}`}
                  type="text"
                  className="deal_kh_input"
                  value={draft.dealName}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, dealName: e.target.value }))
                  }
                  autoComplete="off"
                  aria-label="Offering name"
                />
              </div>
            </div>

            <div
              className="deal_kh_tr deal_kh_tr_body deal_kh_tr_body_ov"
              role="row"
            >
              <div className="deal_kh_td" role="cell">
                <span className="deal_kh_metric_label deal_offering_ov_label_line">
                  <span>Deal type</span>
                  <span
                    className="deal_offering_ov_help"
                    title="Syndication structure (same as create-deal wizard)."
                  >
                    <HelpCircle size={14} strokeWidth={2} aria-hidden />
                  </span>
                </span>
              </div>
              <div className="deal_kh_td" role="cell">
                <select
                  id={`deal-ov-dtype-${id}`}
                  className="deal_kh_select"
                  value={draft.dealType}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, dealType: e.target.value }))
                  }
                >
                  <option value="">Select deal type</option>
                  {DEAL_FORM_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div
              className="deal_kh_tr deal_kh_tr_body deal_kh_tr_body_ov"
              role="row"
            >
              <div className="deal_kh_td" role="cell">
                <span className="deal_kh_metric_label deal_offering_ov_label_line">
                  <span>Assets</span>
                  <span
                    className="deal_offering_ov_help"
                    title="Link one or more assets from this deal’s Assets list (saved with the offering)."
                  >
                    <HelpCircle size={14} strokeWidth={2} aria-hidden />
                  </span>
                </span>
              </div>
              <div className="deal_kh_td deal_kh_td_stack" role="cell">
                {assetRows.length === 0 ? (
                  <span className="deal_offering_overview_muted">
                    No assets yet. Add assets in the Assets section first.
                  </span>
                ) : (
                  <OfferingOverviewAssetsMultiSelect
                    controlId={`deal-ov-assets-${id}`}
                    assetRows={assetRows}
                    selectedIds={draft.selectedAssetIds}
                    onSelectedIdsChange={(ids) =>
                      setDraft((d) => ({ ...d, selectedAssetIds: ids }))
                    }
                  />
                )}
              </div>
            </div>

            <div
              className="deal_kh_tr deal_kh_tr_body deal_kh_tr_body_ov"
              role="row"
            >
              <div className="deal_kh_td" role="cell">
                <span className="deal_kh_metric_label deal_offering_ov_label_line">
                  <span>Investor class</span>
                  <span
                    className="deal_offering_ov_help"
                    title="Economics below apply to this class; manage full class terms under Classes."
                  >
                    <HelpCircle size={14} strokeWidth={2} aria-hidden />
                  </span>
                </span>
              </div>
              <div className="deal_kh_td" role="cell">
                <select
                  id={`deal-ov-class-${id}`}
                  className="deal_kh_select"
                  disabled={classFieldsDisabled}
                  value={draft.selectedClassId}
                  onChange={(e) => {
                    const cid = e.target.value
                    const row = classes.find((c) => c.id === cid)
                    setDraft((d) =>
                      row
                        ? {
                            ...d,
                            selectedClassId: cid,
                            classOfferingSize: blurFormatMoneyInput(
                              row.offeringSize ?? "",
                            ),
                            classMinimumInvestment: blurFormatMoneyInput(
                              row.minimumInvestment ?? "",
                            ),
                            classPricePerUnit: blurFormatMoneyInput(
                              row.pricePerUnit ?? "",
                            ),
                          }
                        : { ...d, selectedClassId: cid },
                    )
                  }}
                >
                  {classes.length === 0 ? (
                    <option value="">No classes yet</option>
                  ) : null}
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name.trim() || c.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div
              className="deal_kh_tr deal_kh_tr_body deal_kh_tr_body_ov"
              role="row"
            >
              <div className="deal_kh_td" role="cell">
                <span className="deal_kh_metric_label deal_offering_ov_label_line">
                  Minimum investment
                </span>
              </div>
              <div className="deal_kh_td" role="cell">
                <input
                  id={`deal-ov-min-${id}`}
                  type="text"
                  className="deal_kh_input"
                  inputMode="decimal"
                  disabled={classFieldsDisabled}
                  value={draft.classMinimumInvestment}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      classMinimumInvestment: e.target.value,
                    }))
                  }
                  onBlur={(e) =>
                    setDraft((d) => ({
                      ...d,
                      classMinimumInvestment: blurFormatMoneyInput(
                        e.target.value,
                      ),
                    }))
                  }
                  autoComplete="off"
                  aria-label="Minimum investment"
                />
              </div>
            </div>

            <div
              className="deal_kh_tr deal_kh_tr_body deal_kh_tr_body_ov"
              role="row"
            >
              <div className="deal_kh_td" role="cell">
                <span className="deal_kh_metric_label deal_offering_ov_label_line">
                  Offering size
                </span>
              </div>
              <div className="deal_kh_td" role="cell">
                <input
                  id={`deal-ov-osize-${id}`}
                  type="text"
                  className="deal_kh_input"
                  inputMode="decimal"
                  disabled={classFieldsDisabled}
                  value={draft.classOfferingSize}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      classOfferingSize: e.target.value,
                    }))
                  }
                  onBlur={(e) =>
                    setDraft((d) => ({
                      ...d,
                      classOfferingSize: blurFormatMoneyInput(e.target.value),
                    }))
                  }
                  autoComplete="off"
                  aria-label="Offering size"
                />
              </div>
            </div>

            <div
              className="deal_kh_tr deal_kh_tr_body deal_kh_tr_body_ov"
              role="row"
            >
              <div className="deal_kh_td" role="cell">
                <span className="deal_kh_metric_label deal_offering_ov_label_line">
                  Price per unit
                </span>
              </div>
              <div className="deal_kh_td" role="cell">
                <input
                  id={`deal-ov-ppu-${id}`}
                  type="text"
                  className="deal_kh_input"
                  inputMode="decimal"
                  disabled={classFieldsDisabled}
                  value={draft.classPricePerUnit}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      classPricePerUnit: e.target.value,
                    }))
                  }
                  onBlur={(e) =>
                    setDraft((d) => ({
                      ...d,
                      classPricePerUnit: blurFormatMoneyInput(e.target.value),
                    }))
                  }
                  autoComplete="off"
                  aria-label="Price per unit"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="deal_kh_footer">
          <button
            type="button"
            className="deal_kh_btn_reset"
            disabled={!isDirty || saving}
            onClick={handleReset}
          >
            <RotateCcw size={17} strokeWidth={2} aria-hidden />
            Reset
          </button>
          <button
            type="button"
            className="deal_kh_btn_save"
            disabled={!isDirty || saving}
            onClick={() => void handleSave()}
          >
            {saving ? (
              <>
                <Loader2
                  size={18}
                  strokeWidth={2}
                  className="deal_kh_btn_save_spin"
                  aria-hidden
                />
                Saving…
              </>
            ) : (
              <>
                <Save size={18} strokeWidth={2} aria-hidden />
                Save
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
