import {
  ArrowLeft,
  Briefcase,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Layers,
  ListFilter,
  Loader2,
  Pencil,
  Percent,
  Plus,
  Save,
  Tag,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react"
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react"
import { useNavigate } from "react-router-dom"
import { InfoIconPanel } from "./FieldInfoHeading"
import {
  createDealInvestorClass,
  deleteDealInvestorClass,
  fetchDealInvestorClasses,
  updateDealInvestorClass,
} from "../api/dealsApi"
import type {
  DealInvestorClass,
  DealInvestorClassFormValues,
  InvestorClassAdvancedForm,
  LpHurdleItem,
} from "../types/deal-investor-class.types"
import {
  investorClassStatusLabel,
  investorClassVisibilityLabel,
} from "../utils/offeringDisplayLabels"
import { formatDateDdMmmYyyy } from "../../../../../common/utils/formatDateDisplay"
import {
  blurFormatMoneyInput,
  formatMoneyFieldDisplay,
} from "../utils/offeringMoneyFormat"
import "../../../../contacts/contacts.css"
import "../deal-investor-class.css"
import "../deals-create.css"
import "../../../../usermanagement/user_management.css"
import "../deal-members/add-investment/add_deal_modal.css"

/** Native `<select>` option row (class type, equity name, etc.). */
export type DealIcSelectOption = { value: string; label: string }

const CLASS_TYPE_OPTIONS: DealIcSelectOption[] = [
  { value: "", label: "Select class type" },
  { value: "lp", label: "LP" },
  { value: "gp", label: "GP" },
  { value: "mezzanine", label: "Mezzanine" },
]

/** LP header & add-page title until the user enters equity class name. */
export const DEAL_IC_EQUITY_DEFAULT_LABEL = "New Class"

/** Fixed choices for Equity class name (add + edit; legacy names stay selectable when editing). */
export const EQUITY_CLASS_NAME_OPTIONS: DealIcSelectOption[] = [
  {
    value: "Class A - Limited Partners",
    label: "Class A - Limited Partners",
  },
  { value: "General Partners", label: "General Partners" },
  { value: "Mezzanine", label: "Mezzanine" },
]

function classTypeOptionLabel(value: string): string {
  if (!value.trim()) return "—"
  const o = CLASS_TYPE_OPTIONS.find((x) => x.value === value)
  return o?.label ?? value
}

/** LP metrics strip: show $0 instead of em dash for empty money fields. */
function lpMetricMoneyDisplay(raw: string): string {
  if (raw == null || !String(raw).trim()) return "$0"
  return formatMoneyFieldDisplay(raw)
}

function formatPctTwoDecimals(raw: string): string {
  const n = parseFloat(String(raw ?? "").replace(/%/g, "").trim())
  if (!Number.isFinite(n)) return "0.00%"
  return `${n.toFixed(2)}%`
}

function stripPctForTitle(raw: string): string {
  return String(raw ?? "")
    .replace(/%/g, "")
    .trim()
}

function newLpHurdle(): LpHurdleItem {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `h-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  return {
    id,
    expanded: true,
    upsideLpPct: "80%",
    upsideGpPct: "20%",
    cocReturnPct: "",
    hurdleName: "",
    preferredReturnType: "cash_on_cash",
    finalHurdle: "no",
    advancedOpen: false,
    catchUpPreferredReturns: "yes",
    honorOnlyOnCapitalEvent: "no",
    dayCountConvention: "actual_365",
    compoundingPeriod: "none",
    startDateOverride: "",
    endDate: "",
  }
}

function normalizeLpHurdle(raw: unknown, index: number): LpHurdleItem {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const id =
    typeof o.id === "string" && o.id.trim()
      ? o.id
      : `h-${index}-${Date.now()}`
  return {
    id,
    expanded: o.expanded !== false,
    upsideLpPct:
      typeof o.upsideLpPct === "string" ? o.upsideLpPct : "80%",
    upsideGpPct:
      typeof o.upsideGpPct === "string" ? o.upsideGpPct : "20%",
    cocReturnPct:
      typeof o.cocReturnPct === "string" ? o.cocReturnPct : "",
    hurdleName: typeof o.hurdleName === "string" ? o.hurdleName : "",
    preferredReturnType:
      typeof o.preferredReturnType === "string" && o.preferredReturnType
        ? String(o.preferredReturnType)
        : "cash_on_cash",
    finalHurdle:
      typeof o.finalHurdle === "string" && o.finalHurdle
        ? String(o.finalHurdle)
        : "no",
    advancedOpen: Boolean(o.advancedOpen),
    catchUpPreferredReturns:
      typeof o.catchUpPreferredReturns === "string" &&
      o.catchUpPreferredReturns.trim()
        ? String(o.catchUpPreferredReturns)
        : "yes",
    honorOnlyOnCapitalEvent:
      typeof o.honorOnlyOnCapitalEvent === "string" &&
      o.honorOnlyOnCapitalEvent.trim()
        ? String(o.honorOnlyOnCapitalEvent)
        : "no",
    dayCountConvention:
      typeof o.dayCountConvention === "string" && o.dayCountConvention.trim()
        ? String(o.dayCountConvention)
        : "actual_365",
    compoundingPeriod:
      typeof o.compoundingPeriod === "string" && o.compoundingPeriod.trim()
        ? String(o.compoundingPeriod)
        : "none",
    startDateOverride:
      typeof o.startDateOverride === "string" ? o.startDateOverride : "",
    endDate: typeof o.endDate === "string" ? o.endDate : "",
  }
}

const LP_HURDLE_PREF_RETURN_OPTIONS: { value: string; label: string }[] = [
  { value: "cash_on_cash", label: "Cash on cash" },
  { value: "irr", label: "IRR" },
  { value: "preferred", label: "Preferred return" },
]

/** Mezzanine class-level preferred return (main form). */
const MEZZ_CLASS_PREF_RETURN_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Select a preferred return type" },
  ...LP_HURDLE_PREF_RETURN_OPTIONS,
]

const LP_HURDLE_FINAL_OPTIONS: { value: string; label: string }[] = [
  { value: "no", label: "No" },
  { value: "yes", label: "Yes" },
]

const LP_HURDLE_ADV_YES_NO: { value: string; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
]

const LP_HURDLE_DAY_COUNT_OPTIONS: { value: string; label: string }[] = [
  { value: "actual_365", label: "Actual/365 (most common)" },
  { value: "actual_360", label: "Actual/360" },
  { value: "thirty_360", label: "30/360" },
  { value: "actual_actual", label: "Actual/Actual" },
]

const LP_HURDLE_COMPOUNDING_OPTIONS: { value: string; label: string }[] = [
  { value: "none", label: "None (most common)" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "semi_annual", label: "Semi-annual" },
  { value: "annual", label: "Annual" },
]

const LP_HURDLE_NAME_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Select hurdle name" },
  { value: "upside_80_20", label: "Upside split 80/20" },
  { value: "catch_up", label: "Catch-up" },
  { value: "preferred", label: "Preferred return" },
]

function lpHurdleReturnClause(preferredReturnType: string): string {
  if (preferredReturnType === "irr") return "IRR return."
  if (preferredReturnType === "preferred")
    return "preferred return."
  return "cash on cash return."
}

/** Hurdle sentence uses selected equity class name; neutral fallback if not chosen yet. */
function lpHurdleEquityClassFragments(equityClassName: string): {
  toClassComma: string
  gpUntilAchieves: string
} {
  const t = equityClassName.trim()
  if (!t) {
    return {
      toClassComma: "to this class,",
      gpUntilAchieves: "to General partners until this class achieves",
    }
  }
  return {
    toClassComma: `to ${t},`,
    gpUntilAchieves: `to General partners until ${t} achieves`,
  }
}

/** Live summary under the new-class subtitle on the add-class page (LP only). */
function InvestorClassFormMetricsStrip({
  form,
}: {
  form: DealInvestorClassFormValues
}) {
  return (
    <div
      className="deal_inv_ic_form_metrics_strip"
      role="group"
      aria-label="Class financial summary"
    >
      <div className="deal_inv_ic_form_metric_cell">
        <span className="deal_inv_ic_form_metric_label">
          Raise amount for ownership
        </span>
        <span className="deal_inv_ic_form_metric_value">
          {lpMetricMoneyDisplay(form.offeringSize)}
        </span>
      </div>
      <div className="deal_inv_ic_form_metric_cell">
        <span className="deal_inv_ic_form_metric_label">
          Raise amount for distribution
        </span>
        <span className="deal_inv_ic_form_metric_value">
          {lpMetricMoneyDisplay(form.raiseAmountDistributions)}
        </span>
      </div>
      <div className="deal_inv_ic_form_metric_cell">
        <span className="deal_inv_ic_form_metric_label">
          Ownership of entity
        </span>
        <span className="deal_inv_ic_form_metric_value">
          {formatPctTwoDecimals(form.advanced.entityLegalOwnershipPct)}
        </span>
      </div>
      <div className="deal_inv_ic_form_metric_cell">
        <span className="deal_inv_ic_form_metric_label">
          Distribution share
        </span>
        <span className="deal_inv_ic_form_metric_value">
          {formatPctTwoDecimals(form.advanced.distributionSharePct)}
        </span>
      </div>
      <div className="deal_inv_ic_form_metric_cell">
        <span className="deal_inv_ic_form_metric_label">Total raised</span>
        <span className="deal_inv_ic_form_metric_value">
          {lpMetricMoneyDisplay(form.offeringSize)}
        </span>
      </div>
    </div>
  )
}

/** GP add-page summary: ownership + distribution only (one row). */
function GpClassFormMetricsStrip({
  form,
}: {
  form: DealInvestorClassFormValues
}) {
  return (
    <div
      className="deal_inv_ic_form_metrics_strip deal_inv_ic_form_metrics_strip_gp"
      role="group"
      aria-label="Class ownership summary"
    >
      <div className="deal_inv_ic_form_metric_cell">
        <span className="deal_inv_ic_form_metric_label">
          Ownership of entity
        </span>
        <span className="deal_inv_ic_form_metric_value">
          {formatPctTwoDecimals(form.advanced.entityLegalOwnershipPct)}
        </span>
      </div>
      <div className="deal_inv_ic_form_metric_cell">
        <span className="deal_inv_ic_form_metric_label">
          Distribution share
        </span>
        <span className="deal_inv_ic_form_metric_value">
          {formatPctTwoDecimals(form.advanced.distributionSharePct)}
        </span>
      </div>
    </div>
  )
}

/** Mezzanine add-page summary: four metrics in one row (no distribution share). */
function MezzanineClassFormMetricsStrip({
  form,
}: {
  form: DealInvestorClassFormValues
}) {
  return (
    <div
      className="deal_inv_ic_form_metrics_strip deal_inv_ic_form_metrics_strip_mezz"
      role="group"
      aria-label="Class financial summary"
    >
      <div className="deal_inv_ic_form_metric_cell">
        <span className="deal_inv_ic_form_metric_label">
          Raise amount for ownership
        </span>
        <span className="deal_inv_ic_form_metric_value">
          {lpMetricMoneyDisplay(form.offeringSize)}
        </span>
      </div>
      <div className="deal_inv_ic_form_metric_cell">
        <span className="deal_inv_ic_form_metric_label">
          Raise amount for distribution
        </span>
        <span className="deal_inv_ic_form_metric_value">
          {lpMetricMoneyDisplay(form.raiseAmountDistributions)}
        </span>
      </div>
      <div className="deal_inv_ic_form_metric_cell">
        <span className="deal_inv_ic_form_metric_label">
          Ownership of entity
        </span>
        <span className="deal_inv_ic_form_metric_value">
          {formatPctTwoDecimals(form.advanced.entityLegalOwnershipPct)}
        </span>
      </div>
      <div className="deal_inv_ic_form_metric_cell">
        <span className="deal_inv_ic_form_metric_label">Total raised</span>
        <span className="deal_inv_ic_form_metric_value">
          {lpMetricMoneyDisplay(form.offeringSize)}
        </span>
      </div>
    </div>
  )
}

const ADV_INVESTMENT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "equity", label: "Equity" },
  { value: "debt", label: "Debt" },
  { value: "convertible", label: "Convertible" },
  { value: "hybrid", label: "Hybrid" },
  { value: "other", label: "Other" },
]

const ADV_WAITLIST_OPTIONS: { value: string; label: string }[] = [
  { value: "off", label: "Off (most common)" },
  { value: "on", label: "On" },
  { value: "auto", label: "Auto" },
]

function defaultAdvancedForm(): InvestorClassAdvancedForm {
  return {
    investmentType: "equity",
    classPreferredReturnType: "",
    entityLegalOwnershipPct: "0%",
    entityLegalOwnershipFrozen: false,
    distributionSharePct: "0%",
    distributionShareFrozen: false,
    maximumInvestment: "",
    targetIrr: "",
    assetTags: ["All"],
    waitlistStatus: "off",
    hurdles: [],
  }
}

function parseAdvancedJson(raw: string | undefined | null): InvestorClassAdvancedForm {
  const base = defaultAdvancedForm()
  if (!raw?.trim()) return base
  try {
    const o = JSON.parse(raw) as Record<string, unknown>
    const tags = Array.isArray(o.assetTags)
      ? o.assetTags.filter((x): x is string => typeof x === "string")
      : base.assetTags
    const hurdlesRaw = o.hurdles
    const hurdles = Array.isArray(hurdlesRaw)
      ? hurdlesRaw.map((h, i) => normalizeLpHurdle(h, i))
      : base.hurdles
    return {
      investmentType:
        typeof o.investmentType === "string" && o.investmentType.trim()
          ? o.investmentType
          : base.investmentType,
      classPreferredReturnType:
        typeof o.classPreferredReturnType === "string"
          ? o.classPreferredReturnType
          : base.classPreferredReturnType,
      entityLegalOwnershipPct:
        typeof o.entityLegalOwnershipPct === "string"
          ? o.entityLegalOwnershipPct
          : base.entityLegalOwnershipPct,
      entityLegalOwnershipFrozen: Boolean(o.entityLegalOwnershipFrozen),
      distributionSharePct:
        typeof o.distributionSharePct === "string"
          ? o.distributionSharePct
          : base.distributionSharePct,
      distributionShareFrozen: Boolean(o.distributionShareFrozen),
      maximumInvestment:
        typeof o.maximumInvestment === "string"
          ? o.maximumInvestment
          : base.maximumInvestment,
      targetIrr:
        typeof o.targetIrr === "string" ? o.targetIrr : base.targetIrr,
      assetTags: tags.length > 0 ? tags : base.assetTags,
      waitlistStatus:
        typeof o.waitlistStatus === "string" && o.waitlistStatus.trim()
          ? o.waitlistStatus
          : base.waitlistStatus,
      hurdles,
    }
  } catch {
    return base
  }
}

function IcAssetsChipRow({
  items,
  onRemove,
}: {
  items: string[]
  onRemove: (index: number) => void
}) {
  if (items.length === 0) return null
  return (
    <div className="contacts_chip_row" role="list" aria-label="Selected assets">
      {items.map((t, i) => (
        <span key={`${t}-${i}`} className="contacts_chip" role="listitem">
          <span className="contacts_chip_label">{t}</span>
          <button
            type="button"
            className="contacts_chip_remove"
            onClick={() => onRemove(i)}
            aria-label={`Remove ${t}`}
          >
            <X size={14} strokeWidth={2} aria-hidden />
          </button>
        </span>
      ))}
    </div>
  )
}

function lpHurdleTypeShort(type: string): string {
  if (type === "cash_on_cash") return "CoC"
  if (type === "irr") return "IRR"
  if (type === "preferred") return "Pref"
  return "CoC"
}

function LpHurdleCard({
  hurdle: h,
  idPrefix,
  equityClassName,
  disabled,
  onUpdate,
  onRemove,
}: {
  hurdle: LpHurdleItem
  idPrefix: string
  /** Selected equity class name — drives “to …” / “until … achieves” in the sentence. */
  equityClassName: string
  disabled?: boolean
  onUpdate: (patch: Partial<LpHurdleItem>) => void
  onRemove: () => void
}) {
  const sid = `${idPrefix}-h-${h.id}`
  const summaryTitle = `Upside split ${stripPctForTitle(h.upsideLpPct) || "0"}/${stripPctForTitle(h.upsideGpPct) || "0"}`
  const classPhrases = lpHurdleEquityClassFragments(equityClassName)

  return (
    <details
      id={`${idPrefix}-lp-hurdle-${h.id}`}
      className="deal_inv_lp_hurdle_card"
      open={h.expanded}
      onToggle={(e) => {
        onUpdate({ expanded: e.currentTarget.open })
      }}
    >
      <summary className="deal_inv_lp_hurdle_summary">
        <ChevronDown
          size={18}
          strokeWidth={2}
          className="deal_inv_lp_hurdle_summary_chevron"
          aria-hidden
        />
        <span className="deal_inv_lp_hurdle_summary_main">
          <span className="deal_inv_lp_hurdle_summary_title">{summaryTitle}</span>
          <span className="deal_inv_lp_hurdle_summary_meta">
            <span>Limit -</span>
            <span className="deal_inv_lp_hurdle_summary_sep">·</span>
            <span>Type {lpHurdleTypeShort(h.preferredReturnType)}</span>
          </span>
        </span>
        <button
          type="button"
          className="deal_inv_lp_hurdle_trash"
          aria-label="Remove hurdle"
          disabled={disabled}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onRemove()
          }}
        >
          <Trash2 size={17} strokeWidth={2} aria-hidden />
        </button>
      </summary>
      <div className="deal_inv_lp_hurdle_body">
        <div className="deal_inv_lp_hurdle_sentence" role="group" aria-label="Upside split">
          <span className="deal_inv_lp_hurdle_sentence_lead">
            Upside split
            <span className="deal_inv_required">*</span>
            <span className="deals_add_inv_label_info deal_inv_ic_raise_own_info">
              <InfoIconPanel
                ariaLabel="More information: Upside split"
                infoContent={
                  <p>
                    LP and GP shares of upside after the return threshold in
                    this hurdle is met.
                  </p>
                }
              />
            </span>
          </span>
          <input
            id={`${sid}-lp-pct`}
            type="text"
            className="deal_inv_lp_hurdle_sentence_input deals_add_inv_field_control deals_add_inv_input"
            inputMode="decimal"
            disabled={disabled}
            value={h.upsideLpPct}
            onChange={(e) => onUpdate({ upsideLpPct: e.target.value })}
            aria-label="LP upside percent"
          />
          <span className="deal_inv_lp_hurdle_sentence_txt">
            {classPhrases.toClassComma}
          </span>
          <input
            id={`${sid}-gp-pct`}
            type="text"
            className="deal_inv_lp_hurdle_sentence_input deals_add_inv_field_control deals_add_inv_input"
            inputMode="decimal"
            disabled={disabled}
            value={h.upsideGpPct}
            onChange={(e) => onUpdate({ upsideGpPct: e.target.value })}
            aria-label="GP upside percent"
          />
          <span className="deal_inv_lp_hurdle_sentence_txt">
            {classPhrases.gpUntilAchieves}
          </span>
          <span className="deal_inv_lp_hurdle_pct_inline">
            <input
              id={`${sid}-coc`}
              type="text"
              className="deal_inv_lp_hurdle_sentence_input deals_add_inv_field_control deals_add_inv_input"
              inputMode="decimal"
              disabled={disabled}
              value={h.cocReturnPct}
              onChange={(e) => onUpdate({ cocReturnPct: e.target.value })}
              aria-label="Return threshold percent"
            />
            <span className="deal_inv_lp_hurdle_pct_suffix">%</span>
          </span>
          <span className="deal_inv_lp_hurdle_sentence_txt">
            {lpHurdleReturnClause(h.preferredReturnType)}
          </span>
        </div>

        <div className="deal_inv_lp_hurdle_row2">
          <div className="deal_inv_class_field">
            <label
              className="deal_inv_class_field_label"
              htmlFor={`${sid}-name`}
            >
              Hurdle name
            </label>
            <select
              id={`${sid}-name`}
              className="deals_add_inv_field_control um_field_select"
              disabled={disabled}
              value={h.hurdleName}
              onChange={(e) => onUpdate({ hurdleName: e.target.value })}
            >
              {LP_HURDLE_NAME_OPTIONS.map((o) => (
                <option key={o.value || "empty"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="deal_inv_class_field">
            <label
              className="deal_inv_ic_raise_own_label"
              htmlFor={`${sid}-pref`}
            >
              <span>
                Preferred return type
                <span className="contacts_required" aria-hidden>
                  {" "}
                  *
                </span>
              </span>
              <span className="deals_add_inv_label_info deal_inv_ic_raise_own_info">
                <InfoIconPanel
                  ariaLabel="More information: Preferred return type"
                  infoContent={
                    <p>
                      Basis used to measure when this hurdle is satisfied (e.g.
                      cash-on-cash vs IRR).
                    </p>
                  }
                />
              </span>
            </label>
            <select
              id={`${sid}-pref`}
              className="deals_add_inv_field_control um_field_select"
              disabled={disabled}
              value={h.preferredReturnType}
              onChange={(e) =>
                onUpdate({ preferredReturnType: e.target.value })
              }
            >
              {LP_HURDLE_PREF_RETURN_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="deal_inv_class_field">
            <label
              className="deal_inv_class_field_label"
              htmlFor={`${sid}-final`}
            >
              Final hurdle <span className="deal_inv_required">*</span>
            </label>
            <select
              id={`${sid}-final`}
              className="deals_add_inv_field_control um_field_select"
              disabled={disabled}
              value={h.finalHurdle}
              onChange={(e) => onUpdate({ finalHurdle: e.target.value })}
            >
              {LP_HURDLE_FINAL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <details
          className="deal_inv_lp_hurdle_advanced"
          open={h.advancedOpen}
          onToggle={(e) => {
            onUpdate({ advancedOpen: e.currentTarget.open })
          }}
        >
          <summary className="deal_inv_lp_hurdle_advanced_summary">
            <ChevronRight
              size={16}
              strokeWidth={2}
              className="deal_inv_lp_hurdle_advanced_chevron"
              aria-hidden
            />
            Advanced
          </summary>
          <div className="deal_inv_lp_hurdle_advanced_grid">
            <div className="deal_inv_class_field">
              <label
                className="deal_inv_class_field_label"
                htmlFor={`${sid}-adv-catchup`}
              >
                Catch up on preferred returns{" "}
                <span className="deal_inv_required" aria-hidden>
                  *
                </span>
              </label>
              <select
                id={`${sid}-adv-catchup`}
                className="deals_add_inv_field_control um_field_select"
                disabled={disabled}
                value={h.catchUpPreferredReturns}
                onChange={(e) =>
                  onUpdate({ catchUpPreferredReturns: e.target.value })
                }
              >
                {LP_HURDLE_ADV_YES_NO.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="deal_inv_class_field">
              <label
                className="deal_inv_ic_raise_own_label"
                htmlFor={`${sid}-adv-honor-capital`}
              >
                <span>
                  Honor only on capital event
                  <span className="contacts_required" aria-hidden>
                    {" "}
                    *
                  </span>
                </span>
                <span className="deals_add_inv_label_info deal_inv_ic_raise_own_info">
                  <InfoIconPanel
                    ariaLabel="More information: Honor only on capital event"
                    infoContent={
                      <p>
                        When enabled, this rule applies only when a defined
                        capital event occurs (e.g. distribution or liquidity
                        event), not on ordinary accruals.
                      </p>
                    }
                  />
                </span>
              </label>
              <select
                id={`${sid}-adv-honor-capital`}
                className="deals_add_inv_field_control um_field_select"
                disabled={disabled}
                value={h.honorOnlyOnCapitalEvent}
                onChange={(e) =>
                  onUpdate({ honorOnlyOnCapitalEvent: e.target.value })
                }
              >
                {LP_HURDLE_ADV_YES_NO.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="deal_inv_class_field">
              <label
                className="deal_inv_ic_raise_own_label"
                htmlFor={`${sid}-adv-day-count`}
              >
                <span>
                  Day count convention
                  <span className="contacts_required" aria-hidden>
                    {" "}
                    *
                  </span>
                </span>
                <span className="deals_add_inv_label_info deal_inv_ic_raise_own_info">
                  <InfoIconPanel
                    ariaLabel="More information: Day count convention"
                    infoContent={
                      <p>
                        Method used to count days for interest or preferred
                        return accrual (e.g. actual days in a year vs 360-day
                        year).
                      </p>
                    }
                  />
                </span>
              </label>
              <select
                id={`${sid}-adv-day-count`}
                className="deals_add_inv_field_control um_field_select"
                disabled={disabled}
                value={h.dayCountConvention}
                onChange={(e) =>
                  onUpdate({ dayCountConvention: e.target.value })
                }
              >
                {LP_HURDLE_DAY_COUNT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="deal_inv_class_field">
              <label
                className="deal_inv_ic_raise_own_label"
                htmlFor={`${sid}-adv-compounding`}
              >
                <span>Compounding period</span>
                <span className="deals_add_inv_label_info deal_inv_ic_raise_own_info">
                  <InfoIconPanel
                    ariaLabel="More information: Compounding period"
                    infoContent={
                      <p>
                        How often accrued preferred return or interest
                        compounds. None means simple accrual without
                        compounding within the period.
                      </p>
                    }
                  />
                </span>
              </label>
              <select
                id={`${sid}-adv-compounding`}
                className="deals_add_inv_field_control um_field_select"
                disabled={disabled}
                value={h.compoundingPeriod}
                onChange={(e) =>
                  onUpdate({ compoundingPeriod: e.target.value })
                }
              >
                {LP_HURDLE_COMPOUNDING_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="deal_inv_class_field deal_inv_lp_hurdle_adv_span2">
              <label
                className="deal_inv_ic_dist_label_flex"
                htmlFor={`${sid}-adv-start-override`}
              >
                <span className="deal_inv_class_field_label deal_inv_class_label_inline">
                  Start date override
                </span>
                <span className="deals_add_inv_label_info deal_inv_ic_raise_own_info">
                  <InfoIconPanel
                    ariaLabel="More information: Start date override"
                    infoContent={
                      <p>
                        Optional date that overrides when accrual or this
                        hurdle&apos;s clock starts for modeling purposes.
                      </p>
                    }
                  />
                </span>
              </label>
              <input
                id={`${sid}-adv-start-override`}
                type="date"
                className="deals_add_inv_field_control deals_add_inv_input"
                disabled={disabled}
                value={h.startDateOverride?.slice(0, 10) ?? ""}
                onChange={(e) =>
                  onUpdate({ startDateOverride: e.target.value })
                }
                aria-label="Start date override. Enter override start date."
              />
            </div>
            <div className="deal_inv_class_field deal_inv_lp_hurdle_adv_span2">
              <label
                className="deal_inv_ic_dist_label_flex"
                htmlFor={`${sid}-adv-end-date`}
              >
                <span className="deal_inv_class_field_label deal_inv_class_label_inline">
                  End date
                </span>
                <span className="deals_add_inv_label_info deal_inv_ic_raise_own_info">
                  <InfoIconPanel
                    ariaLabel="More information: End date"
                    infoContent={
                      <p>
                        Optional end date for this hurdle step or accrual
                        window.
                      </p>
                    }
                  />
                </span>
              </label>
              <input
                id={`${sid}-adv-end-date`}
                type="date"
                className="deals_add_inv_field_control deals_add_inv_input"
                disabled={disabled}
                value={h.endDate?.slice(0, 10) ?? ""}
                onChange={(e) => onUpdate({ endDate: e.target.value })}
                aria-label="End date. Enter an end date."
              />
            </div>
          </div>
        </details>
      </div>
    </details>
  )
}

function LpHurdlesSection({
  idPrefix,
  hurdles,
  equityClassName,
  disabled,
  onAdd,
  onExpandOrCollapseAll,
  onRemove,
  onUpdate,
}: {
  idPrefix: string
  hurdles: LpHurdleItem[]
  equityClassName: string
  disabled?: boolean
  onAdd: () => void
  onExpandOrCollapseAll: () => void
  onRemove: (id: string) => void
  onUpdate: (id: string, patch: Partial<LpHurdleItem>) => void
}) {
  const allExpanded =
    hurdles.length > 0 && hurdles.every((h) => h.expanded)

  return (
    <div className="deal_inv_lp_hurdles_section">
      <div className="deal_inv_lp_hurdles_head">
        <div className="deal_inv_lp_hurdles_title_row">
          <span className="deal_inv_lp_hurdles_title">Hurdles</span>
          <span className="deals_add_inv_label_info">
            <InfoIconPanel
              ariaLabel="More information: Hurdles"
              infoContent={
                <p>
                  Waterfall steps that define how cash flows split between LP
                  and GP after defined return thresholds.
                </p>
              }
            />
          </span>
        </div>
        <button
          type="button"
          className="deal_inv_lp_hurdles_collapse_all"
          disabled={disabled || hurdles.length === 0}
          onClick={onExpandOrCollapseAll}
        >
          {allExpanded ? "Collapse all" : "Expand all"}
        </button>
      </div>
      <div className="deal_inv_lp_hurdle_list">
        {hurdles.map((h) => (
          <LpHurdleCard
            key={h.id}
            hurdle={h}
            idPrefix={idPrefix}
            equityClassName={equityClassName}
            disabled={disabled}
            onUpdate={(patch) => onUpdate(h.id, patch)}
            onRemove={() => onRemove(h.id)}
          />
        ))}
      </div>
      <button
        type="button"
        className="deal_inv_ic_lp_hurdle_link deal_inv_lp_hurdles_footer_add"
        disabled={disabled}
        onClick={onAdd}
      >
        <Plus
          className="deal_inv_ic_lp_hurdle_footer_add_icon"
          size={16}
          strokeWidth={2}
          aria-hidden
        />
        Add hurdle
      </button>
    </div>
  )
}

function stripMoneyInput(raw: string): string {
  return raw.replace(/[$,\s]/g, "").trim()
}

function isRequiredMoneyMissing(raw: string): boolean {
  return stripMoneyInput(raw) === ""
}

function stripPctOrNumber(raw: string): string {
  return raw.replace(/%/g, "").replace(/[$,\s]/g, "").trim()
}

/** Case-insensitive, trimmed comparison for duplicate class names on the same deal */
function normalizeInvestorClassNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ")
}

function normalizeSubscriptionTypeKey(t: string): string {
  return t.trim().toLowerCase()
}

/** Same name may exist under different class types (LP vs GP vs mezzanine). */
function isDuplicateInvestorClassName(
  name: string,
  subscriptionType: string,
  existing: DealInvestorClass[],
  excludeClassId?: string,
): boolean {
  const key = normalizeInvestorClassNameKey(name)
  if (!key) return false
  const typeKey = normalizeSubscriptionTypeKey(subscriptionType)
  if (!typeKey) return false
  return existing.some(
    (r) =>
      r.id !== excludeClassId &&
      normalizeInvestorClassNameKey(r.name) === key &&
      normalizeSubscriptionTypeKey(r.subscriptionType) === typeKey,
  )
}

/** Step 1 of add-class page pipeline: core offering fields only (advanced on step 2). */
function validateInvestorClassStep1(
  form: DealInvestorClassFormValues,
): string | null {
  if (!form.subscriptionType.trim()) return "Class type is required."
  if (!form.name.trim()) return "Equity class name is required."
  if (form.subscriptionType === "gp") {
    if (stripPctOrNumber(form.advanced.entityLegalOwnershipPct) === "") {
      return "Entity legal ownership is required."
    }
    return null
  }
  if (isRequiredMoneyMissing(form.offeringSize)) {
    return "Raise amount (for ownership) is required."
  }
  if (isRequiredMoneyMissing(form.raiseAmountDistributions)) {
    return "Raise amount (for distributions) is required."
  }
  if (isRequiredMoneyMissing(form.minimumInvestment)) {
    return "Minimum investment is required."
  }
  if (form.subscriptionType === "mezzanine") {
    if (!form.advanced.classPreferredReturnType.trim()) {
      return "Preferred return type is required."
    }
  }
  return null
}

function emptyForm(): DealInvestorClassFormValues {
  return {
    name: "",
    subscriptionType: "",
    entityName: "",
    startDate: "",
    offeringSize: "",
    raiseAmountDistributions: "",
    billingRaiseQuota: "",
    minimumInvestment: "",
    pricePerUnit: "",
    status: "closed",
    visibility: "",
    advanced: defaultAdvancedForm(),
  }
}

function rowToForm(row: DealInvestorClass): DealInvestorClassFormValues {
  return {
    name: row.name,
    subscriptionType: row.subscriptionType,
    entityName: row.entityName,
    startDate: row.startDate,
    offeringSize: blurFormatMoneyInput(row.offeringSize ?? ""),
    raiseAmountDistributions: blurFormatMoneyInput(
      row.raiseAmountDistributions ?? "",
    ),
    billingRaiseQuota: blurFormatMoneyInput(row.billingRaiseQuota ?? ""),
    minimumInvestment: blurFormatMoneyInput(row.minimumInvestment ?? ""),
    pricePerUnit: blurFormatMoneyInput(row.pricePerUnit ?? ""),
    status: row.status || "closed",
    visibility: row.visibility,
    advanced: parseAdvancedJson(row.advancedOptionsJson),
  }
}

function InvestorClassModalFormBody({
  idPrefix,
  form,
  setForm,
  disabled,
  onClearError,
  onAddHurdleClick,
  includeHurdleStep = false,
  showNewClassTitleAboveType = false,
  /** Add-class page pipeline: step 1 = core fields; step 2 = advanced + hurdles; omit = single screen (modal). */
  formStep,
}: {
  idPrefix: string
  form: DealInvestorClassFormValues
  setForm: (p: Partial<DealInvestorClassFormValues>) => void
  disabled?: boolean
  onClearError?: () => void
  onAddHurdleClick?: () => void
  includeHurdleStep?: boolean
  /** Add-class page: show “New Class” / equity name above Class type. */
  showNewClassTitleAboveType?: boolean
  formStep?: 1 | 2 | 3
}) {
  const [assetTagInput, setAssetTagInput] = useState("")
  const typeLbl = `${idPrefix}-class-type-lbl`
  const equityNameLbl = `${idPrefix}-equity-name-lbl`
  const isLpLayout = form.subscriptionType === "lp"
  const isGpLayout = form.subscriptionType === "gp"
  const isMezzanineLayout = form.subscriptionType === "mezzanine"
  const equityNameSelectOptions = useMemo(() => {
    const placeholder: DealIcSelectOption = {
      value: "",
      label: "Select equity class name",
    }
    const t = form.name.trim()
    let choices: DealIcSelectOption[]
    if (!t || EQUITY_CLASS_NAME_OPTIONS.some((o) => o.value === t)) {
      choices = EQUITY_CLASS_NAME_OPTIONS
    } else {
      choices = [{ value: t, label: t }, ...EQUITY_CLASS_NAME_OPTIONS]
    }
    return [placeholder, ...choices]
  }, [form.name])
  const fieldCtl = "deals_add_inv_field_control deals_add_inv_input"
  const advSelectCtl = "deals_add_inv_field_control um_field_select"
  const advInputCtl = "deals_add_inv_field_control deals_add_inv_input"

  function patchAdvanced(p: Partial<InvestorClassAdvancedForm>) {
    setForm({ advanced: { ...form.advanced, ...p } })
  }

  function addLpHurdle() {
    const hurdle = newLpHurdle()
    const elId = `${idPrefix}-lp-hurdle-${hurdle.id}`
    setForm({
      advanced: {
        ...form.advanced,
        hurdles: [...form.advanced.hurdles, hurdle],
      },
    })
    window.setTimeout(() => {
      const root = document.getElementById(elId)
      root?.scrollIntoView({ behavior: "smooth", block: "start" })
      const firstInput = root?.querySelector<HTMLInputElement>(
        "input:not([disabled])",
      )
      firstInput?.focus({ preventScroll: true })
    }, 0)
  }

  function removeLpHurdle(id: string) {
    setForm({
      advanced: {
        ...form.advanced,
        hurdles: form.advanced.hurdles.filter((x) => x.id !== id),
      },
    })
  }

  function updateLpHurdle(id: string, patch: Partial<LpHurdleItem>) {
    setForm({
      advanced: {
        ...form.advanced,
        hurdles: form.advanced.hurdles.map((x) =>
          x.id === id ? { ...x, ...patch } : x,
        ),
      },
    })
  }

  function toggleExpandAllLpHurdles() {
    const allExpanded =
      form.advanced.hurdles.length > 0 &&
      form.advanced.hurdles.every((h) => h.expanded)
    setForm({
      advanced: {
        ...form.advanced,
        hurdles: form.advanced.hurdles.map((h) => ({
          ...h,
          expanded: !allExpanded,
        })),
      },
    })
  }

  function handleAssetKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return
    e.preventDefault()
    const t = assetTagInput.trim()
    if (!t) return
    if (form.advanced.assetTags.includes(t)) {
      setAssetTagInput("")
      return
    }
    patchAdvanced({ assetTags: [...form.advanced.assetTags, t] })
    setAssetTagInput("")
  }

  const showPipelineStep1 = formStep === 1
  const showPipelineHurdleStep = includeHurdleStep && formStep === 2
  const showPipelineAdvancedStep =
    formStep === (includeHurdleStep ? 3 : 2)
  const advancedShellClass =
    isLpLayout
      ? "deal_inv_ic_advanced deal_inv_ic_advanced_lp"
      : isGpLayout
        ? "deal_inv_ic_advanced deal_inv_ic_advanced_gp"
        : isMezzanineLayout
          ? "deal_inv_ic_advanced deal_inv_ic_advanced_mezz"
          : "deal_inv_ic_advanced"

  return (
    <>
      {showNewClassTitleAboveType && !showPipelineAdvancedStep ? (
        <>
          <div
            className="deal_inv_ic_new_class_subtitle"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {form.name.trim() || DEAL_IC_EQUITY_DEFAULT_LABEL}
          </div>
          {isLpLayout || isMezzanineLayout ? (
            <button
              type="button"
              className="deal_inv_ic_lp_hurdle_link deal_inv_lp_hurdles_footer_add deal_inv_ic_new_class_add_hurdle_row"
              disabled={disabled}
              onClick={() => {
                onClearError?.()
                onAddHurdleClick?.()
                addLpHurdle()
              }}
            >
              <Plus
                className="deal_inv_ic_lp_hurdle_footer_add_icon"
                size={16}
                strokeWidth={2}
                aria-hidden
              />
              Add hurdle
            </button>
          ) : null}
          {isLpLayout ? <InvestorClassFormMetricsStrip form={form} /> : null}
          {isGpLayout ? <GpClassFormMetricsStrip form={form} /> : null}
          {isMezzanineLayout ? (
            <MezzanineClassFormMetricsStrip form={form} />
          ) : null}
        </>
      ) : null}
      {(formStep === undefined || showPipelineStep1) ? (
      <>
      <div className="deal_inv_class_field">
        <label
          className="deal_inv_ic_dist_label_flex"
          id={typeLbl}
          htmlFor={`${idPrefix}-class-type`}
        >
          <span className="deal_inv_class_field_label deal_inv_class_label_inline">
            Class type{" "}
            <span className="deal_inv_required" aria-hidden>
              *
            </span>
          </span>
          <span className="deals_add_inv_label_info deal_inv_ic_raise_own_info">
            <InfoIconPanel
              ariaLabel="More information: Class type"
              infoContent={
                <p>
                  Choose whether this class is limited partners (LP), general
                  partners (GP), or mezzanine. This sets which fields and
                  calculations apply to the class.
                </p>
              }
            />
          </span>
        </label>
        <select
          id={`${idPrefix}-class-type`}
          className={advSelectCtl}
          aria-labelledby={typeLbl}
          value={form.subscriptionType}
          disabled={disabled}
          onChange={(e) => {
            onClearError?.()
            const subscriptionType = e.target.value
            const patch: Partial<DealInvestorClassFormValues> = {
              subscriptionType,
            }
            if (subscriptionType === "gp" || subscriptionType === "mezzanine") {
              if (isRequiredMoneyMissing(form.offeringSize)) {
                patch.offeringSize = "$0"
              }
              if (isRequiredMoneyMissing(form.raiseAmountDistributions)) {
                patch.raiseAmountDistributions = "$0"
              }
              if (isRequiredMoneyMissing(form.minimumInvestment)) {
                patch.minimumInvestment = "$0"
              }
              if (isRequiredMoneyMissing(form.billingRaiseQuota)) {
                patch.billingRaiseQuota = "$0"
              }
            }
            if (subscriptionType === "mezzanine") {
              patch.advanced = {
                ...form.advanced,
                investmentType: "debt",
                entityLegalOwnershipPct:
                  stripPctOrNumber(form.advanced.entityLegalOwnershipPct) === ""
                    ? "0%"
                    : form.advanced.entityLegalOwnershipPct,
                distributionSharePct:
                  stripPctOrNumber(form.advanced.distributionSharePct) === ""
                    ? "0%"
                    : form.advanced.distributionSharePct,
              }
            }
            setForm(patch)
          }}
        >
          {CLASS_TYPE_OPTIONS.map((o) => (
            <option key={o.value || "__class-type-empty"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="deal_inv_class_field">
        <label
          className="deal_inv_ic_dist_label_flex"
          id={equityNameLbl}
          htmlFor={`${idPrefix}-equity-name`}
        >
          <span className="deal_inv_class_field_label deal_inv_class_label_inline">
            Equity class name{" "}
            <span className="deal_inv_required" aria-hidden>
              *
            </span>
          </span>
          <span className="deals_add_inv_label_info deal_inv_ic_raise_own_info">
            <InfoIconPanel
              ariaLabel="More information: Equity class name"
              infoContent={
                <p>
                  Identifies this class for investors and reporting (e.g. limited
                  partners, general partners, or mezzanine). Choose the option that
                  matches how this class is offered.
                </p>
              }
            />
          </span>
        </label>
        <select
          id={`${idPrefix}-equity-name`}
          className={advSelectCtl}
          aria-labelledby={equityNameLbl}
          value={form.name}
          disabled={disabled}
          onChange={(e) => {
            onClearError?.()
            setForm({ name: e.target.value })
          }}
        >
          {equityNameSelectOptions.map((o) => (
            <option
              key={o.value || "__equity-name-empty"}
              value={o.value}
            >
              {o.label}
            </option>
          ))}
        </select>
      </div>
      {isGpLayout ? (
        <>
          <div className="deal_inv_class_field">
            <label
              className="deal_inv_ic_raise_own_label"
              htmlFor={`${idPrefix}-adv-entity-own`}
            >
              <Percent
                className="deal_inv_ic_raise_own_label_icon"
                size={17}
                strokeWidth={2}
                aria-hidden
              />
              <span>
                Entity legal ownership{" "}
                <span className="contacts_required" aria-hidden>
                  *
                </span>
              </span>
              <span className="deals_add_inv_label_info deal_inv_ic_raise_own_info">
                <InfoIconPanel
                  ariaLabel="More information: Entity legal ownership"
                  infoContent={
                    <p>
                      Percentage of the entity allocated to this class.
                    </p>
                  }
                />
              </span>
            </label>
            <div className="deal_inv_ic_pct_row">
              <input
                id={`${idPrefix}-adv-entity-own`}
                type="text"
                className={advInputCtl}
                inputMode="decimal"
                placeholder="0%"
                value={form.advanced.entityLegalOwnershipPct}
                disabled={disabled}
                onChange={(e) =>
                  patchAdvanced({ entityLegalOwnershipPct: e.target.value })
                }
              />
              <button
                type="button"
                className={
                  form.advanced.entityLegalOwnershipFrozen
                    ? "um_btn_primary deal_inv_ic_inline_btn"
                    : "um_btn_secondary deal_inv_ic_inline_btn"
                }
                aria-pressed={form.advanced.entityLegalOwnershipFrozen}
                disabled={disabled}
                onClick={() =>
                  patchAdvanced({
                    entityLegalOwnershipFrozen:
                      !form.advanced.entityLegalOwnershipFrozen,
                  })
                }
              >
                Freeze percentage
              </button>
            </div>
          </div>
          <div className="deal_inv_class_field">
            <label
              className="deal_inv_ic_dist_label_flex"
              htmlFor={`${idPrefix}-pref-date`}
            >
              <span className="deal_inv_class_field_label deal_inv_class_label_inline">
                Preferred return start date
              </span>
              <span className="deals_add_inv_label_info deal_inv_ic_raise_own_info">
                <InfoIconPanel
                  ariaLabel="More information: Preferred return start date"
                  infoContent={
                    <p>
                      The date on which preferred return or interest begins
                      accumulating.
                    </p>
                  }
                />
              </span>
            </label>
            <input
              id={`${idPrefix}-pref-date`}
              type="date"
              className={fieldCtl}
              value={form.startDate?.slice(0, 10) ?? ""}
              onChange={(e) => setForm({ startDate: e.target.value })}
              disabled={disabled}
            />
          </div>
        </>
      ) : null}
      {!isGpLayout ? (
        <>
          <div className="deal_inv_class_field">
            <label
              className="deal_inv_ic_raise_own_label"
              htmlFor={`${idPrefix}-raise-own`}
            >
              <DollarSign
                className="deal_inv_ic_raise_own_label_icon"
                size={17}
                strokeWidth={2}
                aria-hidden
              />
              <span>
                Raise amount (for ownership)
                <span className="contacts_required" aria-hidden>
                  {" "}
                  *
                </span>
              </span>
              <span className="deals_add_inv_label_info deal_inv_ic_raise_own_info">
                <InfoIconPanel
                  ariaLabel="More information: Raise amount (for ownership)"
                  infoContent={
                    <p>
                      The amount being raised for this class including any funds
                      raised outside of the portal. This is used to calculate
                      ownership percentages.
                    </p>
                  }
                />
              </span>
            </label>
            <input
              id={`${idPrefix}-raise-own`}
              type="text"
              className={fieldCtl}
              placeholder="$0"
              inputMode="decimal"
              value={form.offeringSize}
              onChange={(e) => {
                onClearError?.()
                setForm({ offeringSize: e.target.value })
              }}
              onBlur={(e) =>
                setForm({ offeringSize: blurFormatMoneyInput(e.target.value) })
              }
              disabled={disabled}
            />
          </div>
          <div className="deal_inv_class_field">
            <label
              className="deal_inv_ic_dist_label_flex"
              htmlFor={`${idPrefix}-raise-dist`}
            >
              <span className="deal_inv_class_field_label deal_inv_class_label_inline">
                Raise amount (for distributions)
                <span className="deal_inv_required" aria-hidden>
                  {" "}
                  *
                </span>
              </span>
              <span className="deals_add_inv_label_info deal_inv_ic_raise_own_info">
                <InfoIconPanel
                  ariaLabel="More information: Raise amount (for distributions)"
                  infoContent={
                    <p>
                      The total amount being raised for this class on the portal.
                      This is used to calculate distributions and billing quota.
                    </p>
                  }
                />
              </span>
            </label>
            <input
              id={`${idPrefix}-raise-dist`}
              type="text"
              className={fieldCtl}
              placeholder="$0"
              inputMode="decimal"
              value={form.raiseAmountDistributions}
              onChange={(e) => {
                onClearError?.()
                setForm({ raiseAmountDistributions: e.target.value })
              }}
              onBlur={(e) =>
                setForm({
                  raiseAmountDistributions: blurFormatMoneyInput(
                    e.target.value,
                  ),
                })
              }
              disabled={disabled}
            />
            <p className="deal_inv_field_hint">
              {isMezzanineLayout ? (
                <>
                  Target amount, usually same as raise amount for ownership.
                </>
              ) : (
                <>
                  Often matches raise amount (for ownership) when both are
                  raised on the portal.
                </>
              )}
            </p>
          </div>
          <div className="deal_inv_class_field">
            <label
              className="deal_inv_ic_dist_label_flex"
              htmlFor={`${idPrefix}-raise-quota`}
            >
              <span className="deal_inv_class_field_label deal_inv_class_label_inline">
                Raise quota (for billing)
              </span>
              <span className="deals_add_inv_label_info deal_inv_ic_raise_own_info">
                <InfoIconPanel
                  ariaLabel="More information: Raise quota (for billing)"
                  infoContent={
                    <p>
                      How much equity you are currently managing on the portal
                      for this class. This is used for billing purposes and
                      should be higher than the sum of investments.
                    </p>
                  }
                />
              </span>
            </label>
            <input
              id={`${idPrefix}-raise-quota`}
              type="text"
              className={fieldCtl}
              placeholder="$0"
              inputMode="decimal"
              value={form.billingRaiseQuota}
              onChange={(e) => setForm({ billingRaiseQuota: e.target.value })}
              onBlur={(e) =>
                setForm({
                  billingRaiseQuota: blurFormatMoneyInput(e.target.value),
                })
              }
              disabled={disabled || isLpLayout}
            />
          </div>
          <div className="deal_inv_class_field">
            <label
              className="deal_inv_class_field_label"
              htmlFor={`${idPrefix}-min-inv`}
            >
              Minimum investment <span className="deal_inv_required">*</span>
            </label>
            <input
              id={`${idPrefix}-min-inv`}
              type="text"
              className={fieldCtl}
              placeholder={isMezzanineLayout ? "$0" : "$50,000"}
              inputMode="decimal"
              value={form.minimumInvestment}
              onChange={(e) => {
                onClearError?.()
                setForm({ minimumInvestment: e.target.value })
              }}
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
              className="deal_inv_ic_dist_label_flex"
              htmlFor={`${idPrefix}-pref-date`}
            >
              <span className="deal_inv_class_field_label deal_inv_class_label_inline">
                Preferred return start date
              </span>
              <span className="deals_add_inv_label_info deal_inv_ic_raise_own_info">
                <InfoIconPanel
                  ariaLabel="More information: Preferred return start date"
                  infoContent={
                    <p>
                      The date on which preferred return or interest begins
                      accumulating.
                    </p>
                  }
                />
              </span>
            </label>
            <input
              id={`${idPrefix}-pref-date`}
              type="date"
              className={fieldCtl}
              value={form.startDate?.slice(0, 10) ?? ""}
              onChange={(e) => setForm({ startDate: e.target.value })}
              disabled={disabled}
            />
          </div>
          {isMezzanineLayout ? (
            <div className="deal_inv_class_field">
              <label
                className="deal_inv_ic_dist_label_flex"
                htmlFor={`${idPrefix}-mezz-pref-return`}
              >
                <span className="deal_inv_class_field_label deal_inv_class_label_inline">
                  Preferred return type{" "}
                  <span className="deal_inv_required" aria-hidden>
                    *
                  </span>
                </span>
                <span className="deals_add_inv_label_info deal_inv_ic_raise_own_info">
                  <InfoIconPanel
                    ariaLabel="More information: Preferred return type"
                    infoContent={
                      <p>
                        Basis used to measure preferred return for this
                        mezzanine class (e.g. cash-on-cash vs IRR).
                      </p>
                    }
                  />
                </span>
              </label>
              <select
                id={`${idPrefix}-mezz-pref-return`}
                className={advSelectCtl}
                value={form.advanced.classPreferredReturnType}
                disabled={disabled}
                onChange={(e) =>
                  patchAdvanced({ classPreferredReturnType: e.target.value })
                }
              >
                {MEZZ_CLASS_PREF_RETURN_OPTIONS.map((o) => (
                  <option
                    key={o.value || "__mezz-pref-empty"}
                    value={o.value}
                  >
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </>
      ) : null}
      </>
      ) : null}
      {formStep === undefined || showPipelineAdvancedStep ? (
      <>
      {showPipelineAdvancedStep ? (
        <div
          className="deals_add_deal_asset_additional deals_add_deal_asset_additional_investor_class"
          aria-labelledby={`${idPrefix}-add-ic-additional-heading`}
        >
          <div className="deals_add_deal_asset_additional_head">
            <div>
              <h2
                id={`${idPrefix}-add-ic-additional-heading`}
                className="deals_add_deal_asset_additional_subtitle"
              >
                Advanced
              </h2>
              <p className="deals_add_deal_asset_additional_hint">
                Investment structure, economics, waitlist, and hurdle waterfalls
                when applicable.
              </p>
            </div>
          </div>
        </div>
      ) : null}
      <details
        className={
          showPipelineAdvancedStep
            ? `${advancedShellClass} deal_inv_ic_advanced_pipeline_step2`
            : advancedShellClass
        }
        {...(showPipelineAdvancedStep
          ? { open: true }
          : {
              defaultOpen:
                isLpLayout || isGpLayout || isMezzanineLayout,
            })}
      >
        <summary
          className={
            showPipelineAdvancedStep
              ? "deal_inv_ic_advanced_summary deal_inv_ic_advanced_summary_pipeline_hidden"
              : "deal_inv_ic_advanced_summary"
          }
        >
          <ChevronRight
            size={18}
            strokeWidth={2}
            className="deal_inv_ic_advanced_chevron"
            aria-hidden
          />
          Advanced
        </summary>
        <div className="deal_inv_ic_advanced_contact_shell">
          <div className="deal_inv_ic_advanced_um_grid">
            <div className="um_field add_contact_field_tight">
              <label
                className="um_field_label_row"
                htmlFor={`${idPrefix}-adv-inv-type`}
              >
                <Briefcase
                  className="um_field_label_icon"
                  size={17}
                  aria-hidden
                />
                <span>
                  Investment type{" "}
                  <span className="contacts_required" aria-hidden>
                    *
                  </span>
                </span>
              </label>
              <select
                id={`${idPrefix}-adv-inv-type`}
                className={advSelectCtl}
                value={form.advanced.investmentType}
                disabled={disabled || isMezzanineLayout}
                onChange={(e) =>
                  patchAdvanced({ investmentType: e.target.value })
                }
              >
                {ADV_INVESTMENT_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {isMezzanineLayout ? (
              <div
                className="um_field add_contact_field_tight deal_inv_ic_advanced_um_spacer"
                aria-hidden
              />
            ) : null}

            {!isGpLayout && !isMezzanineLayout ? (
              <div className="um_field add_contact_field_tight">
                <label
                  className="um_field_label_row"
                  htmlFor={`${idPrefix}-adv-entity-own`}
                >
                  <Percent
                    className="um_field_label_icon"
                    size={17}
                    aria-hidden
                  />
                  <span>
                    Entity legal ownership{" "}
                    <span className="contacts_required" aria-hidden>
                      *
                    </span>
                  </span>
                  <span className="deals_add_inv_label_info deal_inv_ic_raise_own_info">
                    <InfoIconPanel
                      ariaLabel="More information: Entity legal ownership"
                      infoContent={
                        <p>
                          Percentage of the entity allocated to this class.
                        </p>
                      }
                    />
                  </span>
                </label>
                <div className="deal_inv_ic_pct_row">
                  <input
                    id={`${idPrefix}-adv-entity-own`}
                    type="text"
                    className={advInputCtl}
                    inputMode="decimal"
                    placeholder="0%"
                    value={form.advanced.entityLegalOwnershipPct}
                    disabled={disabled}
                    onChange={(e) =>
                      patchAdvanced({ entityLegalOwnershipPct: e.target.value })
                    }
                  />
                  <button
                    type="button"
                    className={
                      form.advanced.entityLegalOwnershipFrozen
                        ? "um_btn_primary deal_inv_ic_inline_btn"
                        : "um_btn_secondary deal_inv_ic_inline_btn"
                    }
                    aria-pressed={form.advanced.entityLegalOwnershipFrozen}
                    disabled={disabled}
                    onClick={() =>
                      patchAdvanced({
                        entityLegalOwnershipFrozen:
                          !form.advanced.entityLegalOwnershipFrozen,
                      })
                    }
                  >
                    Freeze percentage
                  </button>
                </div>
              </div>
            ) : null}

            {!isGpLayout && !isMezzanineLayout ? (
              <div className="um_field add_contact_field_tight">
                <label
                  className="um_field_label_row"
                  htmlFor={`${idPrefix}-adv-dist-share`}
                >
                  <Percent
                    className="um_field_label_icon"
                    size={17}
                    aria-hidden
                  />
                  <span>
                    Distribution share{" "}
                    <span className="contacts_required" aria-hidden>
                      *
                    </span>
                  </span>
                  <span className="deals_add_inv_label_info deal_inv_ic_raise_own_info">
                    <InfoIconPanel
                      ariaLabel="More information: Distribution share"
                      infoContent={
                        <p>Share of distributions for this class.</p>
                      }
                    />
                  </span>
                </label>
                <div className="deal_inv_ic_pct_row">
                  <input
                    id={`${idPrefix}-adv-dist-share`}
                    type="text"
                    className={advInputCtl}
                    inputMode="decimal"
                    placeholder="0%"
                    value={form.advanced.distributionSharePct}
                    disabled={disabled}
                    onChange={(e) =>
                      patchAdvanced({ distributionSharePct: e.target.value })
                    }
                  />
                  <button
                    type="button"
                    className={
                      form.advanced.distributionShareFrozen
                        ? "um_btn_primary deal_inv_ic_inline_btn"
                        : "um_btn_secondary deal_inv_ic_inline_btn"
                    }
                    aria-pressed={form.advanced.distributionShareFrozen}
                    disabled={disabled}
                    onClick={() =>
                      patchAdvanced({
                        distributionShareFrozen:
                          !form.advanced.distributionShareFrozen,
                      })
                    }
                  >
                    Freeze percentage
                  </button>
                </div>
              </div>
            ) : null}

            <div className="um_field add_contact_field_tight">
              <label
                className="um_field_label_row"
                htmlFor={`${idPrefix}-adv-max-inv`}
              >
                {isGpLayout ? (
                  <Tag className="um_field_label_icon" size={17} aria-hidden />
                ) : (
                  <DollarSign
                    className="um_field_label_icon"
                    size={17}
                    aria-hidden
                  />
                )}
                <span>
                  {isGpLayout ? "Number of shares" : "Maximum investment"}
                </span>
              </label>
              <input
                id={`${idPrefix}-adv-max-inv`}
                type="text"
                className={advInputCtl}
                inputMode="decimal"
                placeholder={isGpLayout ? "" : "$0"}
                value={form.advanced.maximumInvestment}
                disabled={disabled}
                onChange={(e) =>
                  patchAdvanced({ maximumInvestment: e.target.value })
                }
                onBlur={
                  isGpLayout
                    ? undefined
                    : (e) =>
                        patchAdvanced({
                          maximumInvestment: blurFormatMoneyInput(
                            e.target.value,
                          ),
                        })
                }
              />
            </div>

            {!isGpLayout ? (
              <>
                <div className="um_field add_contact_field_tight">
                  <label
                    className="um_field_label_row"
                    htmlFor={`${idPrefix}-adv-ppu`}
                  >
                    <Tag className="um_field_label_icon" size={17} aria-hidden />
                    <span>Price per unit</span>
                    <span className="deals_add_inv_label_info deal_inv_ic_raise_own_info">
                      <InfoIconPanel
                        ariaLabel="More information: Price per unit"
                        infoContent={
                          <p>Nominal price per unit for this class.</p>
                        }
                      />
                    </span>
                  </label>
                  <input
                    id={`${idPrefix}-adv-ppu`}
                    type="text"
                    className={advInputCtl}
                    inputMode="decimal"
                    placeholder="$1,000"
                    value={form.pricePerUnit}
                    disabled={disabled}
                    onChange={(e) => setForm({ pricePerUnit: e.target.value })}
                    onBlur={(e) =>
                      setForm({
                        pricePerUnit: blurFormatMoneyInput(e.target.value),
                      })
                    }
                  />
                  <div className="deal_inv_ic_price_action_row">
                    <button
                      type="button"
                      className="um_btn_secondary deal_inv_ic_inline_btn"
                      disabled={disabled}
                    >
                      Manage unit price over time
                    </button>
                  </div>
                </div>

                <div className="um_field add_contact_field_tight">
                  <label
                    className="um_field_label_row"
                    htmlFor={`${idPrefix}-adv-irr`}
                  >
                    <TrendingUp
                      className="um_field_label_icon"
                      size={17}
                      aria-hidden
                    />
                    <span>Target IRR</span>
                  </label>
                  <input
                    id={`${idPrefix}-adv-irr`}
                    type="text"
                    className={advInputCtl}
                    inputMode="decimal"
                    placeholder="%"
                    value={form.advanced.targetIrr}
                    disabled={disabled}
                    onChange={(e) =>
                      patchAdvanced({ targetIrr: e.target.value })
                    }
                  />
                </div>
              </>
            ) : null}

            <div className="um_field add_contact_field_tight">
              <label
                className="um_field_label_row"
                htmlFor={`${idPrefix}-adv-assets`}
              >
                <Layers
                  className="um_field_label_icon"
                  size={17}
                  aria-hidden
                />
                <span>Assets</span>
              </label>
              <IcAssetsChipRow
                items={form.advanced.assetTags}
                onRemove={(i) =>
                  patchAdvanced({
                    assetTags: form.advanced.assetTags.filter((_, j) => j !== i),
                  })
                }
              />
              <input
                id={`${idPrefix}-adv-assets`}
                type="text"
                className="deals_add_inv_field_control deals_add_inv_input add_contact_chip_input"
                placeholder="Add asset"
                value={assetTagInput}
                disabled={disabled}
                onChange={(e) => setAssetTagInput(e.target.value)}
                onKeyDown={handleAssetKeyDown}
              />
            </div>

            <div className="um_field add_contact_field_tight">
              <label
                className="um_field_label_row"
                htmlFor={`${idPrefix}-adv-waitlist`}
              >
                <ListFilter
                  className="um_field_label_icon"
                  size={17}
                  aria-hidden
                />
                <span>
                  Waitlist status{" "}
                  <span className="contacts_required" aria-hidden>
                    *
                  </span>
                </span>
                <span className="deals_add_inv_label_info deal_inv_ic_raise_own_info">
                  <InfoIconPanel
                    ariaLabel="More information: Waitlist status"
                    infoContent={
                      <p>
                        Whether investors can join a waitlist for this class.
                      </p>
                    }
                  />
                </span>
              </label>
              <select
                id={`${idPrefix}-adv-waitlist`}
                className={advSelectCtl}
                value={form.advanced.waitlistStatus}
                disabled={disabled}
                onChange={(e) =>
                  patchAdvanced({ waitlistStatus: e.target.value })
                }
              >
                {ADV_WAITLIST_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </details>
      </>
      ) : null}
      {(isLpLayout || isMezzanineLayout) &&
      (formStep === undefined ||
        showPipelineHurdleStep ||
        (!includeHurdleStep && showPipelineAdvancedStep)) ? (
        <LpHurdlesSection
          idPrefix={idPrefix}
          hurdles={form.advanced.hurdles}
          equityClassName={form.name}
          disabled={disabled}
          onAdd={addLpHurdle}
          onExpandOrCollapseAll={toggleExpandAllLpHurdles}
          onRemove={removeLpHurdle}
          onUpdate={updateLpHurdle}
        />
      ) : null}
    </>
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
        <span>{classTypeOptionLabel(row.subscriptionType)}</span>
        <span className="deal_inv_class_meta_sep">·</span>
        <span>{row.entityName || "—"}</span>
        <span className="deal_inv_class_meta_sep">·</span>
        <span>{formatDateDdMmmYyyy(row.startDate)}</span>
      </p>
      <div className="deal_inv_class_card_divider" />
      <div className="deal_inv_class_metrics_h">
        <div className="deal_inv_class_metrics_h_items">
          <div className="deal_inv_class_metric_h">
            <span className="deal_inv_class_metric_h_label">
              Raise (ownership)
            </span>
            <span className="deal_inv_class_metric_h_value">
              {formatMoneyFieldDisplay(row.offeringSize)}
            </span>
          </div>
          <div className="deal_inv_class_metric_h">
            <span className="deal_inv_class_metric_h_label">
              Raise (distributions)
            </span>
            <span className="deal_inv_class_metric_h_value">
              {formatMoneyFieldDisplay(row.raiseAmountDistributions)}
            </span>
          </div>
          <div className="deal_inv_class_metric_h">
            <span className="deal_inv_class_metric_h_label">
              Raise quota (billing)
            </span>
            <span className="deal_inv_class_metric_h_value">
              {formatMoneyFieldDisplay(row.billingRaiseQuota)}
            </span>
          </div>
          <div className="deal_inv_class_metric_h">
            <span className="deal_inv_class_metric_h_label">
              Minimum investment
            </span>
            <span className="deal_inv_class_metric_h_value">
              {formatMoneyFieldDisplay(row.minimumInvestment)}
            </span>
          </div>
          <div className="deal_inv_class_metric_h">
            <span className="deal_inv_class_metric_h_label">Price per unit</span>
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

export const DEAL_ADD_IC_PAGE_TITLE_ID = "deal-add-ic-page-title"
export const DEAL_EDIT_IC_PAGE_TITLE_ID = "deal-edit-ic-page-title"

export function AddInvestorClassPanel({
  asPage = false,
  open = false,
  dealId,
  existingClasses,
  onClose,
  onCreated,
  pageTitleId = DEAL_ADD_IC_PAGE_TITLE_ID,
  pipelineStep = 1,
  onPipelineStepChange,
  onAddHurdleClick,
  includeHurdleStep = false,
}: {
  /** Full route page: panel is always shown; `open` is ignored. */
  asPage?: boolean
  /** Inline under Offering Information; ignored when `asPage`. */
  open?: boolean
  dealId: string
  existingClasses: DealInvestorClass[]
  onClose: () => void
  onCreated: () => void
  /** `id` of the page `<h1>` when `asPage` (for `aria-labelledby`). */
  pageTitleId?: string
  /** Add-class route pipeline steps. */
  pipelineStep?: 1 | 2 | 3
  onPipelineStepChange?: (step: 1 | 2 | 3) => void
  onAddHurdleClick?: () => void
  includeHurdleStep?: boolean
}) {
  const titleId = useId()
  const panelRef = useRef<HTMLElement>(null)
  const [form, setForm] = useState(emptyForm)
  const [err, setErr] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const visible = asPage || open

  const patch = useCallback((p: Partial<DealInvestorClassFormValues>) => {
    setForm((prev) => ({ ...prev, ...p }))
  }, [])

  useEffect(() => {
    if (!visible) return
    setForm(emptyForm())
    setErr(null)
  }, [visible, dealId])

  useEffect(() => {
    if (!visible || asPage) return
    const el = panelRef.current
    if (!el) return
    el.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [visible, asPage])

  useEffect(() => {
    if (!visible) return
    function onWindowKeyDown(ev: globalThis.KeyboardEvent) {
      if (ev.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onWindowKeyDown)
    return () => window.removeEventListener("keydown", onWindowKeyDown)
  }, [visible, onClose])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (asPage && pipelineStep === 1) {
      const step1Err = validateInvestorClassStep1(form)
      if (step1Err) {
        setErr(step1Err)
        return
      }
      setErr(null)
      onPipelineStepChange?.(2)
      return
    }
    if (asPage && includeHurdleStep && pipelineStep === 2) {
      setErr(null)
      onPipelineStepChange?.(3)
      return
    }
    if (!form.subscriptionType.trim()) {
      setErr("Class type is required.")
      return
    }
    if (!form.name.trim()) {
      setErr("Equity class name is required.")
      return
    }
    if (isRequiredMoneyMissing(form.offeringSize)) {
      setErr("Raise amount (for ownership) is required.")
      return
    }
    if (isRequiredMoneyMissing(form.raiseAmountDistributions)) {
      setErr("Raise amount (for distributions) is required.")
      return
    }
    if (isRequiredMoneyMissing(form.minimumInvestment)) {
      setErr("Minimum investment is required.")
      return
    }
    if (form.subscriptionType === "mezzanine") {
      if (!form.advanced.classPreferredReturnType.trim()) {
        setErr("Preferred return type is required.")
        return
      }
    }
    if (!form.advanced.investmentType.trim()) {
      setErr("Investment type is required (Advanced).")
      return
    }
    const showEntityDistAdvanced =
      form.subscriptionType !== "gp" && form.subscriptionType !== "mezzanine"
    if (showEntityDistAdvanced) {
      if (stripPctOrNumber(form.advanced.entityLegalOwnershipPct) === "") {
        setErr("Entity legal ownership is required (Advanced).")
        return
      }
      if (stripPctOrNumber(form.advanced.distributionSharePct) === "") {
        setErr("Distribution share is required (Advanced).")
        return
      }
    }
    if (!form.advanced.waitlistStatus.trim()) {
      setErr("Waitlist status is required (Advanced).")
      return
    }
    if (
      isDuplicateInvestorClassName(
        form.name,
        form.subscriptionType,
        existingClasses,
      )
    ) {
      setErr(
        "An investor class with this name already exists for this class type on this deal. Use a unique name or choose another class type.",
      )
      return
    }
    setErr(null)
    setSubmitting(true)
    try {
      await createDealInvestorClass(dealId, form)
      onCreated()
      if (!asPage) onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not create.")
    } finally {
      setSubmitting(false)
    }
  }

  if (!visible) return null

  return (
    <section
      ref={panelRef}
      className={[
        "deal_inv_ic_add_panel add_contact_panel deal_inv_offering_modal deal_inv_ic_form_modal_panel",
        asPage ? "deals_add_deal_asset_panel" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-labelledby={asPage ? pageTitleId : titleId}
    >
      {!asPage ? (
        <header className="deal_inv_ic_add_panel_head">
          <h3 id={titleId} className="deal_inv_ic_add_panel_title">
            Add investor class
          </h3>
          <button
            type="button"
            className="um_modal_close deal_inv_ic_add_panel_close"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
          >
            <X size={20} strokeWidth={2} aria-hidden />
          </button>
        </header>
      ) : null}
      <form
        className={[
          "deals_add_inv_modal_form deal_inv_ic_add_panel_form",
          asPage ? "deals_add_deal_asset_form" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onSubmit={handleSubmit}
      >
        <div
          className={[
            "deals_add_inv_modal_body deal_inv_ic_modal_form_grid deal_inv_ic_modal_form_grid_3",
            asPage ? "deals_add_deal_asset_form_scroll" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {err ? (
            <p className="um_msg_error um_modal_form_error" role="alert">
              {err}
            </p>
          ) : null}
          <InvestorClassModalFormBody
            idPrefix="add-ic"
            form={form}
            setForm={patch}
            disabled={submitting}
            onClearError={() => setErr(null)}
            onAddHurdleClick={onAddHurdleClick}
            includeHurdleStep={includeHurdleStep}
            showNewClassTitleAboveType={asPage}
            formStep={asPage ? pipelineStep : undefined}
          />
        </div>
        <div
          className={[
            "um_modal_actions deal_inv_ic_add_panel_actions",
            asPage ? "deals_add_deal_asset_footer_actions" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <button
            type="button"
            className="um_btn_secondary"
            onClick={onClose}
            disabled={submitting}
          >
            <X size={16} strokeWidth={2} aria-hidden />
            Cancel
          </button>
          <div className="add_contact_modal_actions_trailing">
            {asPage && pipelineStep > 1 ? (
              <button
                type="button"
                className="um_btn_secondary"
                disabled={submitting}
                onClick={() => {
                  setErr(null)
                  onPipelineStepChange?.(pipelineStep === 3 ? 2 : 1)
                }}
              >
                <ArrowLeft size={16} strokeWidth={2} aria-hidden />
                Back
              </button>
            ) : null}
            {asPage &&
            (pipelineStep === 1 || (includeHurdleStep && pipelineStep === 2)) ? (
              <button type="submit" className="um_btn_primary" disabled={submitting}>
                Next
                <ChevronRight size={18} strokeWidth={2} aria-hidden />
              </button>
            ) : (
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
            )}
          </div>
        </div>
      </form>
    </section>
  )
}

/** Full-page edit shell: same panel + pipeline as {@link AddInvestorClassPanel} `asPage`. */
export function EditInvestorClassPanel({
  dealId,
  row,
  existingClasses,
  onClose,
  onSaved,
  pageTitleId = DEAL_EDIT_IC_PAGE_TITLE_ID,
  pipelineStep = 1,
  onPipelineStepChange,
  onAddHurdleClick,
  includeHurdleStep = false,
}: {
  dealId: string
  row: DealInvestorClass
  existingClasses: DealInvestorClass[]
  onClose: () => void
  onSaved: () => void
  pageTitleId?: string
  pipelineStep?: 1 | 2 | 3
  onPipelineStepChange?: (step: 1 | 2 | 3) => void
  onAddHurdleClick?: () => void
  includeHurdleStep?: boolean
}) {
  const [form, setForm] = useState(() => rowToForm(row))
  const [err, setErr] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const patch = useCallback((p: Partial<DealInvestorClassFormValues>) => {
    setForm((prev) => ({ ...prev, ...p }))
  }, [])

  useEffect(() => {
    setForm(rowToForm(row))
    setErr(null)
  }, [row])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (pipelineStep === 1) {
      const step1Err = validateInvestorClassStep1(form)
      if (step1Err) {
        setErr(step1Err)
        return
      }
      setErr(null)
      onPipelineStepChange?.(2)
      return
    }
    if (includeHurdleStep && pipelineStep === 2) {
      setErr(null)
      onPipelineStepChange?.(3)
      return
    }
    if (!form.subscriptionType.trim()) {
      setErr("Class type is required.")
      return
    }
    if (!form.name.trim()) {
      setErr("Equity class name is required.")
      return
    }
    if (isRequiredMoneyMissing(form.offeringSize)) {
      setErr("Raise amount (for ownership) is required.")
      return
    }
    if (isRequiredMoneyMissing(form.raiseAmountDistributions)) {
      setErr("Raise amount (for distributions) is required.")
      return
    }
    if (isRequiredMoneyMissing(form.minimumInvestment)) {
      setErr("Minimum investment is required.")
      return
    }
    if (form.subscriptionType === "mezzanine") {
      if (!form.advanced.classPreferredReturnType.trim()) {
        setErr("Preferred return type is required.")
        return
      }
    }
    if (!form.advanced.investmentType.trim()) {
      setErr("Investment type is required (Advanced).")
      return
    }
    const showEntityDistAdvanced =
      form.subscriptionType !== "gp" && form.subscriptionType !== "mezzanine"
    if (showEntityDistAdvanced) {
      if (stripPctOrNumber(form.advanced.entityLegalOwnershipPct) === "") {
        setErr("Entity legal ownership is required (Advanced).")
        return
      }
      if (stripPctOrNumber(form.advanced.distributionSharePct) === "") {
        setErr("Distribution share is required (Advanced).")
        return
      }
    }
    if (!form.advanced.waitlistStatus.trim()) {
      setErr("Waitlist status is required (Advanced).")
      return
    }
    if (
      isDuplicateInvestorClassName(
        form.name,
        form.subscriptionType,
        existingClasses,
        row.id,
      )
    ) {
      setErr(
        "Another investor class of this type already uses this name for this deal. Choose a unique name or another class type.",
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

  return (
    <section
      className="deal_inv_ic_add_panel add_contact_panel deal_inv_offering_modal deal_inv_ic_form_modal_panel deals_add_deal_asset_panel"
      aria-labelledby={pageTitleId}
    >
      <form
        className="deals_add_inv_modal_form deal_inv_ic_add_panel_form deals_add_deal_asset_form"
        onSubmit={handleSubmit}
      >
        <div className="deals_add_inv_modal_body deal_inv_ic_modal_form_grid deal_inv_ic_modal_form_grid_3 deals_add_deal_asset_form_scroll">
          {err ? (
            <p className="um_msg_error um_modal_form_error" role="alert">
              {err}
            </p>
          ) : null}
          <InvestorClassModalFormBody
            idPrefix="edit-ic"
            form={form}
            setForm={patch}
            disabled={submitting}
            onClearError={() => setErr(null)}
            onAddHurdleClick={onAddHurdleClick}
            includeHurdleStep={includeHurdleStep}
            showNewClassTitleAboveType
            formStep={pipelineStep}
          />
        </div>
        <div className="um_modal_actions deal_inv_ic_add_panel_actions deals_add_deal_asset_footer_actions">
          <button
            type="button"
            className="um_btn_secondary"
            onClick={onClose}
            disabled={submitting}
          >
            <X size={16} strokeWidth={2} aria-hidden />
            Cancel
          </button>
          <div className="add_contact_modal_actions_trailing">
            {pipelineStep > 1 ? (
              <button
                type="button"
                className="um_btn_secondary"
                disabled={submitting}
                onClick={() => {
                  setErr(null)
                  onPipelineStepChange?.(pipelineStep === 3 ? 2 : 1)
                }}
              >
                <ArrowLeft size={16} strokeWidth={2} aria-hidden />
                Back
              </button>
            ) : null}
            {pipelineStep === 1 || (includeHurdleStep && pipelineStep === 2) ? (
              <button type="submit" className="um_btn_primary" disabled={submitting}>
                Next
                <ChevronRight size={18} strokeWidth={2} aria-hidden />
              </button>
            ) : (
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
            )}
          </div>
        </div>
      </form>
    </section>
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
    function onWindowKeyDown(ev: globalThis.KeyboardEvent) {
      if (ev.key === "Escape" && !busy) onCancel()
    }
    window.addEventListener("keydown", onWindowKeyDown)
    return () => window.removeEventListener("keydown", onWindowKeyDown)
  }, [open, busy, onCancel])

  if (!open) return null

  return (
    <div
      className="um_modal_overlay deals_add_inv_modal_overlay portal_modal_z_boost deal_ic_dialog_overlay"
      role="presentation"
    >
      <div
        className="um_modal um_modal_view deals_add_inv_modal_panel deal_inv_offering_modal deal_ic_dialog_shell"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
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
    function onWindowKeyDown(ev: globalThis.KeyboardEvent) {
      if (ev.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onWindowKeyDown)
    return () => window.removeEventListener("keydown", onWindowKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="um_modal_overlay deals_add_inv_modal_overlay portal_modal_z_boost deal_ic_dialog_overlay deal_ic_message_overlay"
      role="presentation"
    >
      <div
        className="um_modal um_modal_view deals_add_inv_modal_panel deal_inv_offering_modal deal_ic_dialog_shell"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
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
  const navigate = useNavigate()
  const [rows, setRows] = useState<DealInvestorClass[]>([])
  const [loading, setLoading] = useState(true)
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
      {!loading && rows.length === 0 ? (
        <div className="deal_offering_info_toolbar">
          <p className="deal_offering_toolbar_hint">
            No investor classes yet. Use &quot;Add Investor Class&quot; next to the
            section arrow to create one.
          </p>
        </div>
      ) : null}

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
            onEdit={() =>
              navigate(
                `/deals/${encodeURIComponent(dealId)}/investor-classes/${encodeURIComponent(r.id)}/edit`,
              )
            }
            onDelete={() => setDeleteTarget(r)}
          />
        ))}
      </div>

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

export { rowToForm as investorClassRowToFormValues }
