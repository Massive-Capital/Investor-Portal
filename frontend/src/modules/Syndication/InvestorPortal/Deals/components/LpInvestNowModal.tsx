import {
  Briefcase,
  CalendarCheck,
  CircleCheck,
  CircleDollarSign,
  IdCard,
  Loader2,
  X,
} from "lucide-react"
import { useCallback, useEffect, useId, useState } from "react"
import { toast } from "../../../../../common/components/Toast"
import { DropdownSelect } from "../../../../../common/components/dropdown-select"
import { patchMyLpDealInvestNowCommitment } from "../api/lpInvestNowCommitmentApi"
import { INVESTOR_PROFILE_SELECT_OPTIONS } from "../constants/investor-profile"
import type { DealInvestorsPayload } from "../types/deal-investors.types"
import {
  blurFormatMoneyInput,
  formatCurrencyUsdTypeInput,
  parseMoneyDigits,
} from "../utils/offeringMoneyFormat"
import { fetchLpInvestNowPrefill } from "../utils/prefillLpInvestNowFields"
import "../../../../contacts/contacts.css"
import "../deal-members/add-investment/add_deal_modal.css"
import "./lp-invest-now-modal.css"

const DROPDOWN_TRIGGER_PILL =
  "um_field_select deals_add_inv_field_control deals_add_inv_field_pill"

export interface LpInvestNowModalProps {
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

export function LpInvestNowModal({
  open,
  onClose,
  dealId,
  dealName,
  onSuccess,
}: LpInvestNowModalProps) {
  const titleId = useId()
  const profileFieldId = "lp-invest-now-profile"
  const amountId = useId()
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
        className="um_modal um_modal_view deals_add_inv_modal_panel add_contact_panel lp_invest_now_modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="um_modal_head add_contact_modal_head">
          <h3 id={titleId} className="um_modal_title add_contact_modal_title">
            Invest now
          </h3>
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
          <div className="deals_add_inv_modal_scroll">
            {error ? (
              <p className="um_msg_error um_modal_form_error" role="alert">
                {error}
              </p>
            ) : null}

            <div className="add_contact_section">
              <div className="um_field">
                <label htmlFor={profileFieldId} className="um_field_label_row">
                  <IdCard className="um_field_label_icon" size={17} aria-hidden />
                  <span>
                    Investor profile{" "}
                    <span className="deal_inv_required" aria-hidden>
                      *
                    </span>
                  </span>
                </label>
                <DropdownSelect
                  id={profileFieldId}
                  options={INVESTOR_PROFILE_SELECT_OPTIONS.map((o) => ({
                    value: o.value,
                    label: o.label,
                  }))}
                  value={profile}
                  onChange={(v) => {
                    setProfile(v)
                    if (error) setError("")
                  }}
                  placeholder="Select profile"
                  ariaLabel="Investor profile"
                  disabled={submitting}
                  triggerClassName={DROPDOWN_TRIGGER_PILL}
                />
              </div>

              <div className="um_field">
                <label htmlFor={amountId} className="um_field_label_row">
                  <CircleDollarSign
                    className="um_field_label_icon"
                    size={17}
                    aria-hidden
                  />
                  <span>
                    Committed amount (USD){" "}
                    <span className="deal_inv_required" aria-hidden>
                      *
                    </span>
                  </span>
                </label>
                <input
                  id={amountId}
                  type="text"
                  className="deals_add_inv_input deals_add_inv_field_control"
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
              </div>

              {/* <div className="um_field">
                <label htmlFor={statusFieldId} className="um_field_label_row">
                  <Activity className="um_field_label_icon" size={17} aria-hidden />
                  <span>Status</span>
                </label>
                <DropdownSelect
                  id={statusFieldId}
                  options={INVESTMENT_STATUS_SELECT_OPTIONS.map((o) => ({
                    value: o.value,
                    label: o.label,
                  }))}
                  value={status}
                  onChange={(v) => {
                    setStatus(v)
                    if (error) setError("")
                  }}
                  placeholder="Select status"
                  ariaLabel="Status"
                  disabled={submitting}
                  triggerClassName={DROPDOWN_TRIGGER_PILL}
                />
              </div> */}

              <div className="um_field">
                <label htmlFor={docSignedId} className="um_field_label_row">
                  <CalendarCheck
                    className="um_field_label_icon"
                    size={17}
                    aria-hidden
                  />
                  <span>
                    Document signed
                    <span className="lp_invest_now_optional"> (optional)</span>
                  </span>
                </label>
                <input
                  id={docSignedId}
                  type="date"
                  className="deals_add_inv_input deals_add_inv_field_control"
                  value={docSignedDate}
                  onChange={(e) => {
                    setDocSignedDate(e.target.value)
                    if (error) setError("")
                  }}
                  disabled={submitting}
                />
              </div>
            </div>
          </div>

          <div className="um_modal_actions add_contact_modal_actions">
            <button
              type="button"
              className="um_btn_secondary"
              onClick={onClose}
              disabled={submitting}
            >
              <X size={16} strokeWidth={2} aria-hidden />
              Cancel
            </button>
            <button
              type="button"
              className="um_btn_primary"
              onClick={() => void submit()}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2
                    size={16}
                    strokeWidth={2}
                    className="add_contact_modal_btn_spin"
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
