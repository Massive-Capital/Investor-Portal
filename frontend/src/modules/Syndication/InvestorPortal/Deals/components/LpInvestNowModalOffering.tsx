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
import { useCallback, useEffect, useId, useMemo, useState } from "react"
import { getSessionUserEmail } from "../../../../../common/auth/sessionUserEmail"
import { toast } from "../../../../../common/components/Toast"
import { fetchMyProfileBook } from "@/modules/Investing/pages/profiles/investingProfileBookApi"
import { fetchDealInvestors } from "../api/dealsApi"
import { patchMyLpDealInvestNowCommitment } from "../api/lpInvestNowCommitmentApi"
import { INVESTOR_PROFILE_SELECT_OPTIONS } from "../constants/investor-profile"
import { INVESTMENT_STATUS_SELECT_OPTIONS } from "../constants/investment-status"
import type { DealInvestorsPayload } from "../types/deal-investors.types"
import {
  ALL_SAVED_PROFILES_IN_USE_ON_DEAL_MSG,
  availableBookProfilesForCommitmentType,
  buildBlockedProfileKeysForInvestNow,
  CHOSEN_PROFILE_ALREADY_USED_MSG,
  isInvestorTypeExhaustedByBlocklist,
  lpProfileUseKey,
} from "../utils/lpInvestNowProfileBlocking"
import {
  filterBookProfilesByCommitmentKind,
  NO_SAVED_PROFILES_FOR_INVESTOR_TYPE_MSG,
} from "../utils/lpInvestNowSavedProfileOptions"
import {
  blurFormatMoneyInput,
  formatCurrencyUsdTypeInput,
  parseMoneyDigits,
} from "../utils/offeringMoneyFormat"
import { getLpInvestNowPrefillFromPayload } from "../utils/prefillLpInvestNowFields"
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
      userInvestorProfileId: string
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
  const savedProfileIdField = useId()
  const [profile, setProfile] = useState("")
  const [savedUserProfileId, setSavedUserProfileId] = useState("")
  const [amount, setAmount] = useState("")
  const [status, setStatus] = useState("")
  const [docSignedDate, setDocSignedDate] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [bookLoading, setBookLoading] = useState(false)
  const [bookProfiles, setBookProfiles] = useState<
    { id: string; profileName: string; profileType: string }[]
  >([])
  const [blockedProfileKeys, setBlockedProfileKeys] = useState<Set<string>>(
    () => new Set(),
  )

  useEffect(() => {
    if (!open) return
    setProfile("")
    setSavedUserProfileId("")
    setAmount("")
    setStatus("")
    setDocSignedDate("")
    setError("")
    setBlockedProfileKeys(new Set())
    setBookLoading(true)
    let cancelled = false
    const did = dealId.trim()
    const em = getSessionUserEmail()?.trim().toLowerCase() ?? ""
    void (async () => {
      try {
        const [book, inv] = await Promise.all([
          fetchMyProfileBook().catch(() => ({
            profiles: [] as { id: string; profileName: string; profileType: string }[],
          })),
          did
            ? fetchDealInvestors(did, { lpInvestorsOnly: true }).catch(() => null)
            : Promise.resolve(null),
        ])
        if (cancelled) return
        setBookProfiles(
          (book.profiles ?? []).map((p) => ({
            id: p.id,
            profileName: p.profileName,
            profileType: p.profileType,
          })),
        )
        if (inv && em) {
          const p = getLpInvestNowPrefillFromPayload(inv, em)
          setBlockedProfileKeys(
            buildBlockedProfileKeysForInvestNow(
              inv.investors,
              em,
              p?.viewerRowId,
            ),
          )
          if (p) {
            setProfile(p.profileId)
            setSavedUserProfileId(p.userInvestorProfileId ?? "")
            setAmount(
              p.amount.trim() ? formatCurrencyUsdTypeInput(p.amount) : "",
            )
            setStatus(p.status)
            setDocSignedDate(p.docSignedDate)
          }
        } else if (em && !inv) {
          setBlockedProfileKeys(new Set())
        }
      } catch {
        if (!cancelled) setBookProfiles([])
      } finally {
        if (!cancelled) setBookLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, dealId])

  const matchingBookProfiles = useMemo(
    () => filterBookProfilesByCommitmentKind(bookProfiles, profile),
    [bookProfiles, profile],
  )

  const availableBookProfiles = useMemo(
    () =>
      availableBookProfilesForCommitmentType(
        profile,
        bookProfiles,
        blockedProfileKeys,
      ),
    [bookProfiles, profile, blockedProfileKeys],
  )

  const noSavedProfilesForType = useMemo(
    () =>
      !bookLoading &&
      Boolean(String(profile).trim()) &&
      matchingBookProfiles.length === 0,
    [bookLoading, profile, matchingBookProfiles.length],
  )

  const allSavedBookProfilesInUse = useMemo(
    () =>
      !bookLoading &&
      Boolean(String(profile).trim()) &&
      matchingBookProfiles.length > 0 &&
      availableBookProfiles.length === 0,
    [
      bookLoading,
      profile,
      matchingBookProfiles.length,
      availableBookProfiles.length,
    ],
  )

  const includeSavedInRequest =
    !bookLoading && availableBookProfiles.length > 0

  useEffect(() => {
    if (!open || bookLoading) return
    const id = (savedUserProfileId ?? "").trim()
    if (!id) return
    if (availableBookProfiles.length === 0) return
    const stillValid = availableBookProfiles.some((p) => p.id === id)
    if (!stillValid) setSavedUserProfileId("")
  }, [open, bookLoading, profile, availableBookProfiles, savedUserProfileId])

  const submit = useCallback(async () => {
    if (bookLoading) {
      setError("Loading your saved profiles…")
      return
    }
    if (!String(profile).trim()) {
      setError("Select an investor profile type")
      return
    }
    if (noSavedProfilesForType) {
      setError(NO_SAVED_PROFILES_FOR_INVESTOR_TYPE_MSG)
      return
    }
    if (allSavedBookProfilesInUse) {
      setError(ALL_SAVED_PROFILES_IN_USE_ON_DEAL_MSG)
      return
    }
    if (includeSavedInRequest && !String(savedUserProfileId).trim()) {
      setError("Select a profile name from your saved profiles")
      return
    }
    const k = lpProfileUseKey(String(profile).trim(), savedUserProfileId)
    if (blockedProfileKeys.has(k)) {
      setError(CHOSEN_PROFILE_ALREADY_USED_MSG)
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
      includeUserInvestorProfileInBody: includeSavedInRequest,
      userInvestorProfileId: (savedUserProfileId ?? "").trim(),
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
      userInvestorProfileId: (savedUserProfileId ?? "").trim(),
      committedAmount: n,
      status: status.trim(),
      docSignedDate: docSignedDate.trim(),
    })
    onClose()
  }, [
    allSavedBookProfilesInUse,
    amount,
    blockedProfileKeys,
    bookLoading,
    dealId,
    docSignedDate,
    includeSavedInRequest,
    noSavedProfilesForType,
    onClose,
    onSuccess,
    profile,
    savedUserProfileId,
    status,
  ])

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
              Choose your investor profile type, a saved profile name (when you have
              matching profiles in Investing → Profiles), commitment in US dollars, status, and
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
                    Investor profile type <span className="deal_inv_required">*</span>
                  </span>
                  <select
                    id={profileFieldId}
                    className="deals_create_input lp_invest_now_select"
                    value={profile}
                    onChange={(e) => {
                      setProfile(e.target.value)
                      setSavedUserProfileId("")
                      if (error) setError("")
                    }}
                    disabled={submitting}
                    aria-invalid={Boolean(error) && !profile.trim()}
                  >
                    {INVESTOR_PROFILE_SELECT_OPTIONS.map((o) => (
                      <option
                        key={o.value || "empty"}
                        value={o.value}
                        disabled={Boolean(
                          o.value?.trim() &&
                            isInvestorTypeExhaustedByBlocklist(
                              o.value,
                              bookProfiles,
                              blockedProfileKeys,
                            ),
                        )}
                      >
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            {noSavedProfilesForType ? (
              <p
                className="deals_create_field_error lp_invest_now_error"
                role="alert"
              >
                {NO_SAVED_PROFILES_FOR_INVESTOR_TYPE_MSG}
              </p>
            ) : null}
            {allSavedBookProfilesInUse ? (
              <p
                className="deals_create_field_error lp_invest_now_error"
                role="alert"
              >
                {ALL_SAVED_PROFILES_IN_USE_ON_DEAL_MSG}
              </p>
            ) : null}
            {/*
              When options exist, name choices come from `fetchMyProfileBook` filtered
              by `filterBookProfilesByCommitmentKind` to match the commitment type.
            */}
            {profile.trim() && availableBookProfiles.length > 0 ? (
              <div className="lp_invest_now_field">
                <span className="lp_invest_now_field_icon" aria-hidden>
                  <UserRound size={18} strokeWidth={2} />
                </span>
                <div className="lp_invest_now_field_body">
                  <label
                    className="deals_create_label"
                    htmlFor={savedProfileIdField}
                  >
                    <span className="form_label_inline_row">
                      Profile name <span className="deal_inv_required">*</span>
                    </span>
                    <select
                      id={savedProfileIdField}
                      className="deals_create_input lp_invest_now_select"
                      value={savedUserProfileId}
                      onChange={(e) => {
                        setSavedUserProfileId(e.target.value)
                        if (error) setError("")
                      }}
                      disabled={submitting || bookLoading}
                    >
                      <option value="">
                        {bookLoading ? "Loading…" : "Select a saved profile"}
                      </option>
                      {availableBookProfiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.profileName?.trim() || "—"}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            ) : null}
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
              disabled={
                submitting ||
                bookLoading ||
                noSavedProfilesForType ||
                allSavedBookProfilesInUse
              }
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
