import {
  Activity,
  Briefcase,
  CalendarCheck,
  CircleCheck,
  CircleDollarSign,
  Loader2,
  UserRound,
  Wallet,
  X,
} from "lucide-react"
import { useCallback, useEffect, useId, useState } from "react"
import { toast } from "../../../../../common/components/Toast"
import { patchMyLpDealInvestNowCommitment } from "../api/lpInvestNowCommitmentApi"
import { INVESTOR_PROFILE_SELECT_OPTIONS } from "../constants/investor-profile"
import { INVESTMENT_STATUS_SELECT_OPTIONS } from "../constants/investment-status"
import type { DealInvestorsPayload } from "../types/deal-investors.types"
import {
  blurFormatMoneyInput,
  formatCurrencyUsdTypeInput,
  parseMoneyDigits,
} from "../utils/offeringMoneyFormat"
import { fetchLpInvestNowPrefill } from "../utils/prefillLpInvestNowFields"
import "../deal-members/add-investment/add_deal_modal.css"
import "./lp-invest-now-modal.css"

/**
 * copy_code–aligned “Invest now” modal: profile, committed amount (full value), status, doc signed date.
 * Uses PATCH `/lp-investors/my-invest-now-commitment` (not prod’s additive `/my-commitment`).
 */
export interface LpInvestNowModalOfferingProps {
  open: boolean
  onClose: () => void
  dealId: string
  /** Shown as context under the title (optional). */
  dealName: string
  onSuccess: (
    payload: DealInvestorsPayload,
    saved: {
      profileId: string
      committedAmount: number
      status: string
      docSignedDate: string
    },
  ) => void
}

export function LpInvestNowModalOffering({
  open,
  onClose,
  dealId,
  dealName,
  onSuccess,
}: LpInvestNowModalOfferingProps) {
  const titleId = useId()
  const descId = useId()
  const profileFieldId = useId()
  const amountId = useId()
  const statusId = useId()
  const docSignedId = useId()
  const [profile, setProfile] = useState("")
  const [amount, setAmount] = useState("")
  const [status, setStatus] = useState("")
  const [docSignedDate, setDocSignedDate] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setProfile("")
    setAmount("")
    setStatus("")
    setDocSignedDate("")
    setError("")
    let cancelled = false
    void fetchLpInvestNowPrefill(dealId).then((p) => {
      if (cancelled || !p) return
      setProfile(p.profileId)
      setAmount(
        p.amount.trim() ? formatCurrencyUsdTypeInput(p.amount) : "",
      )
      setStatus(p.status)
      setDocSignedDate(p.docSignedDate)
    })
    return () => {
      cancelled = true
    }
  }, [open, dealId])

  const submit = useCallback(async () => {
    if (!String(profile).trim()) {
      setError("Select an investor profile")
      return
    }
    const n = parseMoneyDigits(String(amount).trim())
    if (!Number.isFinite(n) || n <= 0) {
      setError("Enter a committed amount greater than 0")
      return
    }
    setSubmitting(true)
    setError("")
    const res = await patchMyLpDealInvestNowCommitment(dealId, String(n), {
      profileId: profile.trim(),
      status: status.trim(),
      docSignedDate: docSignedDate.trim(),
    })
    setSubmitting(false)
    if (!res.ok) {
      setError(res.message)
      return
    }
    toast.success(
      "Committed successfully",
      "Your investment commitment was saved successfully.",
    )
    onSuccess(res.investorsPayload, {
      profileId: profile.trim(),
      committedAmount: n,
      status: status.trim(),
      docSignedDate: docSignedDate.trim(),
    })
    onClose()
  }, [amount, dealId, docSignedDate, onClose, onSuccess, profile, status])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  const dealLine = dealName.trim()

  return (
    <div
      className="um_modal_overlay deals_add_inv_modal_overlay portal_modal_z_boost lp_invest_now_overlay"
      role="presentation"
    >
      <div
        className="um_modal um_modal_view deals_add_inv_modal_panel lp_invest_now_modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <div className="um_modal_head lp_invest_now_modal_head">
          <div className="lp_invest_now_modal_head_text">
            <div className="lp_invest_now_modal_title_row">
              <span className="lp_invest_now_modal_title_icon" aria-hidden>
                <Wallet size={22} strokeWidth={2} />
              </span>
              <h3 id={titleId} className="um_modal_title lp_invest_now_modal_title">
                Invest now
              </h3>
            </div>
            <p id={descId} className="lp_invest_now_modal_desc">
              Choose your investor profile, commitment in US dollars, investment status, and
              optional document signed date. You can update these later if the deal allows.
            </p>
          </div>
          <button
            type="button"
            className="um_modal_close"
            onClick={onClose}
            aria-label="Close"
            disabled={submitting}
          >
            <X size={20} strokeWidth={2} aria-hidden />
          </button>
        </div>
        {dealLine ? (
          <div className="lp_invest_now_deal_context" aria-label="Deal">
            <span className="lp_invest_now_deal_context_inner">
              <Briefcase size={14} strokeWidth={2.25} aria-hidden />
              <span className="lp_invest_now_deal_context_value">{dealLine}</span>
            </span>
          </div>
        ) : null}
        <div className="deals_add_inv_modal_form">
          <div className="deals_add_inv_modal_scroll lp_invest_now_modal_body">
            <div className="lp_invest_now_field">
              <span className="lp_invest_now_field_icon" aria-hidden>
                <UserRound size={18} strokeWidth={2} />
              </span>
              <div className="lp_invest_now_field_body">
                <label className="deals_create_label" htmlFor={profileFieldId}>
                  <span className="form_label_inline_row">
                    Investor profile <span className="deal_inv_required">*</span>
                  </span>
                  <select
                    id={profileFieldId}
                    className="deals_create_input lp_invest_now_select"
                    value={profile}
                    onChange={(e) => {
                      setProfile(e.target.value)
                      if (error) setError("")
                    }}
                    disabled={submitting}
                    aria-invalid={Boolean(error) && !profile.trim()}
                  >
                    {INVESTOR_PROFILE_SELECT_OPTIONS.map((o) => (
                      <option key={o.value || "empty"} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <div className="lp_invest_now_field">
              <span className="lp_invest_now_field_icon" aria-hidden>
                <CircleDollarSign size={18} strokeWidth={2} />
              </span>
              <div className="lp_invest_now_field_body">
                <label className="deals_create_label" htmlFor={amountId}>
                  <span className="form_label_inline_row">
                    Committed amount (USD) <span className="deal_inv_required">*</span>
                  </span>
                  <input
                    id={amountId}
                    type="text"
                    className="deals_create_input lp_invest_now_amount_input"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="e.g. $25,000"
                    value={amount}
                    onChange={(e) => {
                      setAmount(formatCurrencyUsdTypeInput(e.target.value))
                      if (error) setError("")
                    }}
                    onBlur={() => {
                      if (!amount.trim()) {
                        setAmount("")
                        return
                      }
                      setAmount(blurFormatMoneyInput(amount))
                    }}
                    disabled={submitting}
                    aria-invalid={Boolean(error)}
                  />
                </label>
              </div>
            </div>
            <div className="lp_invest_now_field">
              <span className="lp_invest_now_field_icon" aria-hidden>
                <Activity size={18} strokeWidth={2} />
              </span>
              <div className="lp_invest_now_field_body">
                <label className="deals_create_label" htmlFor={statusId}>
                  <span className="form_label_inline_row">Status</span>
                  <select
                    id={statusId}
                    className="deals_create_input lp_invest_now_select"
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value)
                      if (error) setError("")
                    }}
                    disabled={submitting}
                  >
                    {INVESTMENT_STATUS_SELECT_OPTIONS.map((o, i) => (
                      <option key={`${o.value}-${i}`} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <div className="lp_invest_now_field">
              <span className="lp_invest_now_field_icon" aria-hidden>
                <CalendarCheck size={18} strokeWidth={2} />
              </span>
              <div className="lp_invest_now_field_body">
                <label className="deals_create_label" htmlFor={docSignedId}>
                  <span className="form_label_inline_row">
                    Document signed
                    <span className="lp_invest_now_optional">(optional)</span>
                  </span>
                  <input
                    id={docSignedId}
                    type="date"
                    className="deals_create_input lp_invest_now_date_input"
                    value={docSignedDate}
                    onChange={(e) => {
                      setDocSignedDate(e.target.value)
                      if (error) setError("")
                    }}
                    disabled={submitting}
                  />
                </label>
              </div>
            </div>
            {error ? (
              <p className="deals_create_field_error lp_invest_now_error" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <div className="um_modal_actions lp_invest_now_modal_actions">
            <button
              type="button"
              className="um_btn_secondary lp_invest_now_btn_row"
              onClick={onClose}
              disabled={submitting}
            >
              <X size={16} strokeWidth={2} aria-hidden />
              Cancel
            </button>
            <button
              type="button"
              className="um_btn_primary lp_invest_now_btn_row"
              onClick={() => void submit()}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2
                    size={16}
                    strokeWidth={2}
                    className="lp_invest_now_btn_spinner"
                    aria-hidden
                  />
                  Saving…
                </>
              ) : (
                <>
                  <CircleCheck size={16} strokeWidth={2} aria-hidden />
                  Confirm investment
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
