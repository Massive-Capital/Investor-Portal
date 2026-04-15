import { X } from "lucide-react"
import { useCallback, useEffect, useId, useState } from "react"
import { patchMyLpDealCommitment } from "../api/dealsApi"
import { INVESTOR_PROFILE_SELECT_OPTIONS } from "../constants/investor-profile"
import type { DealInvestorsPayload } from "../types/deal-investors.types"
import "../deal-members/add-investment/add_deal_modal.css"
import "./lp-invest-now-modal.css"

export interface LpInvestNowModalProps {
  open: boolean
  onClose: () => void
  dealId: string
  /** Shown as context under the title (optional). */
  dealName: string
  onSuccess: (
    payload: DealInvestorsPayload,
    saved: { profileId: string; committedAmount: number },
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
  const profileId = useId()
  const amountId = useId()
  const [profile, setProfile] = useState("")
  const [amount, setAmount] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setProfile("")
    setAmount("")
    setError("")
  }, [open, dealId])

  const submit = useCallback(async () => {
    if (!String(profile).trim()) {
      setError("Select an investor profile")
      return
    }
    const raw = String(amount).replace(/[$,\s]/g, "").trim()
    const n = Number(raw)
    if (!Number.isFinite(n) || n <= 0) {
      setError("Enter a committed amount greater than 0")
      return
    }
    setSubmitting(true)
    setError("")
    const res = await patchMyLpDealCommitment(dealId, String(n), {
      profileId: profile.trim(),
    })
    setSubmitting(false)
    if (!res.ok) {
      setError(res.message)
      return
    }
    onSuccess(res.investorsPayload, {
      profileId: profile.trim(),
      committedAmount: n,
    })
    onClose()
  }, [amount, dealId, onClose, onSuccess, profile])

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
          <div className="lp_invest_now_modal_titles">
            <h3 id={titleId} className="um_modal_title add_contact_modal_title">
              Invest now
            </h3>
            {dealLine ? (
              <p className="lp_invest_now_modal_deal_name">{dealLine}</p>
            ) : null}
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
        <div className="deals_add_inv_modal_scroll lp_invest_now_modal_body">
          <label className="deals_create_label" htmlFor={profileId}>
            <span className="form_label_inline_row">
              Investor profile <span className="deal_inv_required">*</span>
            </span>
            <select
              id={profileId}
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
          <label className="deals_create_label" htmlFor={amountId}>
            <span className="form_label_inline_row">
              Committed amount (USD) <span className="deal_inv_required">*</span>
            </span>
            <input
              id={amountId}
              type="text"
              className="deals_create_input"
              inputMode="decimal"
              autoComplete="off"
              placeholder="e.g. 25000"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value)
                if (error) setError("")
              }}
              disabled={submitting}
              aria-invalid={Boolean(error)}
            />
          </label>
          {error ? (
            <p className="deals_create_field_error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <div className="um_modal_actions lp_invest_now_modal_actions">
          <button
            type="button"
            className="um_btn_secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="um_btn_primary"
            onClick={() => void submit()}
            disabled={submitting}
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  )
}
