import {
  Briefcase,
  CalendarCheck,
  CircleCheck,
  CircleDollarSign,
  IdCard,
  Loader2,
  X,
} from "lucide-react"
import { useCallback, useEffect, useId, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { getSessionUserEmail } from "../../../../../common/auth/sessionUserEmail"
import { toast } from "../../../../../common/components/Toast"
import {
  DropdownSelect,
  MODAL_DROPDOWN_SELECT_PROPS,
} from "../../../../../common/components/dropdown-select"
import { fetchMyProfileBook, normalizeInvestorProfileListRow } from "@/modules/Investing/pages/profiles/investingProfileBookApi"
import type { InvestorProfileListRow } from "@/modules/Investing/pages/profiles/investor-profiles.types"
import { fetchDealInvestors } from "../../api/dealsApi"
import { patchMyLpDealInvestNowCommitment } from "../../api/lpInvestNowCommitmentApi"
import type { DealInvestorsPayload } from "../../types/deal-investors.types"
import {
  ALL_SAVED_PROFILES_IN_USE_ON_DEAL_MSG,
  availableBookProfilesForCommitmentType,
  buildBlockedProfileKeysForInvestNow,
  CHOSEN_PROFILE_ALREADY_USED_MSG,
  isInvestorTypeExhaustedByBlocklist,
  lpProfileUseKey,
} from "../../utils/lpInvestNowProfileBlocking"
import {
  filterBookProfilesByCommitmentKind,
  NO_SAVED_PROFILES_FOR_INVESTOR_TYPE_MSG,
} from "../../utils/lpInvestNowSavedProfileOptions"
import {
  blurFormatMoneyInput,
  formatCurrencyUsdTypeInput,
  parseMoneyDigits,
} from "../../utils/offeringMoneyFormat"
import { getLpInvestNowPrefillFromPayload } from "../../utils/prefillLpInvestNowFields"
import { bookProfileTypeDisplayLabel, commitmentProfileIdFromBookProfile } from "../../utils/resolveInvestNowDealContext"
import { investNowProfileDropdownOption } from "@/modules/Investing/pages/invest/investNowProfileDropdownOption"
import "../../../contacts/contacts.css"
import "../deal_members/add-investment/add_deal_modal.css"
import "./lp-invest-now-modal.css"
import "@/modules/Investing/pages/invest/invest-now-flow.css"

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
      userInvestorProfileId: string
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
  const navigate = useNavigate()
  const titleId = useId()
  const profileFieldId = "lp-invest-now-profile"
  const amountId = useId()
  const docSignedId = useId()
  const [profile, setProfile] = useState("")
  const [savedUserProfileId, setSavedUserProfileId] = useState("")
  const [amount, setAmount] = useState("")
  const [status, setStatus] = useState("")
  const [docSignedDate, setDocSignedDate] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [bookLoading, setBookLoading] = useState(false)
  const [bookProfiles, setBookProfiles] = useState<InvestorProfileListRow[]>([])
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
          (book.profiles ?? []).map((p) => normalizeInvestorProfileListRow(p)),
        )
        if (inv && em) {
          const p = getLpInvestNowPrefillFromPayload(inv, em)
          const blocked = buildBlockedProfileKeysForInvestNow(
            inv.investors,
            em,
            p?.viewerRowId,
          )
          setBlockedProfileKeys(blocked)
          if (p) {
            setProfile(p.profileId)
            setSavedUserProfileId(p.userInvestorProfileId ?? "")
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

  const profileTypeSelectOptions = useMemo(() => {
    const commitmentIds = new Set(
      (bookProfiles ?? [])
        .map((p) => commitmentProfileIdFromBookProfile(p))
        .filter(Boolean),
    )
    const opts: { value: string; label: string }[] = []
    if (commitmentIds.has("individual")) {
      opts.push({ value: "individual", label: "Individual" })
    }
    if (commitmentIds.has("joint_tenancy")) {
      opts.push({ value: "joint_tenancy", label: "Joint tenancy" })
    }
    if (commitmentIds.has("custodian_ira_401k")) {
      opts.push({
        value: "custodian_ira_401k",
        label: "Custodian IRA or custodian based 401(k)",
      })
    }
    if (commitmentIds.has("llc_corp_trust_etc")) {
      opts.push({
        value: "llc_corp_trust_etc",
        label: "LLC, corp, partnership, trust, solo 401(k), or checkbook IRA",
      })
    }
    return opts
  }, [bookProfiles])

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

  useEffect(() => {
    if (!open || bookLoading) return
    const id = (savedUserProfileId ?? "").trim()
    if (!id) return
    if (availableBookProfiles.length === 0) return
    const stillValid = availableBookProfiles.some((p) => p.id === id)
    if (!stillValid) setSavedUserProfileId("")
  }, [open, bookLoading, profile, availableBookProfiles, savedUserProfileId])

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
                    Investor profile type{" "}
                    <span className="deal_inv_required" aria-hidden>
                      *
                    </span>
                  </span>
                </label>
                <DropdownSelect
                  {...MODAL_DROPDOWN_SELECT_PROPS}
                  id={profileFieldId}
                  options={profileTypeSelectOptions.map((o) => ({
                    value: o.value,
                    label: o.label,
                    disabled: Boolean(
                      o.value?.trim() &&
                        isInvestorTypeExhaustedByBlocklist(
                          o.value,
                          bookProfiles,
                          blockedProfileKeys,
                        ),
                    ),
                  }))}
                  value={profile}
                  onChange={(v) => {
                    setProfile(v)
                    setSavedUserProfileId("")
                    if (error) setError("")
                  }}
                  placeholder="Select profile type"
                  ariaLabel="Investor profile type"
                  disabled={submitting}
                  header={{
                    label: "+ Add Profile",
                    onClick: () => navigate("/investing/profiles/add"),
                  }}
                  triggerClassName={DROPDOWN_TRIGGER_PILL}
                />
              </div>

              {noSavedProfilesForType ? (
                <p
                  className="um_msg_error um_modal_form_error"
                  role="alert"
                >
                  {NO_SAVED_PROFILES_FOR_INVESTOR_TYPE_MSG}
                </p>
              ) : null}

              {allSavedBookProfilesInUse ? (
                <p
                  className="um_msg_error um_modal_form_error"
                  role="alert"
                >
                  {ALL_SAVED_PROFILES_IN_USE_ON_DEAL_MSG}
                </p>
              ) : null}

              {/*
                When options exist, profile name rows come from `fetchMyProfileBook`
                and `filterBookProfilesByCommitmentKind` (book profileType matches the
                commitment “investor profile” enum above).
              */}
              {profile.trim() && availableBookProfiles.length > 0 ? (
                <div className="um_field">
                  <label
                    className="um_field_label_row"
                    htmlFor="lp-invest-now-saved-profile"
                  >
                    <IdCard className="um_field_label_icon" size={17} aria-hidden />
                    <span>
                      Profile name{" "}
                      <span className="deal_inv_required" aria-hidden>
                        *
                      </span>
                    </span>
                  </label>
                  <DropdownSelect
                    {...MODAL_DROPDOWN_SELECT_PROPS}
                    id="lp-invest-now-saved-profile"
                    options={availableBookProfiles.map((p) =>
                      investNowProfileDropdownOption({
                        id: p.id,
                        profileName: p.profileName,
                        profileType: bookProfileTypeDisplayLabel(p),
                      }),
                    )}
                    value={savedUserProfileId}
                    onChange={(v) => {
                      setSavedUserProfileId(v)
                      if (error) setError("")
                    }}
                    placeholder={bookLoading ? "Loading profiles…" : "Select a saved profile"}
                    ariaLabel="Profile name from your Investing profiles"
                    disabled={submitting || bookLoading}
                    triggerClassName={DROPDOWN_TRIGGER_PILL}
                  />
                </div>
              ) : null}

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
              Close
            </button>
            <button
              type="button"
              className="um_btn_primary"
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
