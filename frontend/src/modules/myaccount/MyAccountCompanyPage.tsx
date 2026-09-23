import type { FormEvent } from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import {
  Building2,
  CircleUser,
  Loader2,
  Rocket,
  Save,
  Shield,
} from "lucide-react"
import { usePortalMode } from "@/modules/Investing/context/PortalModeContext"
import { refreshAuthTokens } from "../../common/auth/authTokensApi"
import { COMPANY_ADMIN, INVESTOR } from "../../common/auth/roleUtils"
import { RadioPillGroup } from "../../common/components/radio-pill-group/RadioPillGroup"
import { fetchMyProfile, patchMyProfile } from "./accountApi"
import {
  orgRoleLabelForMyAccount,
  viewerShowsOrgRoleInMyAccount,
} from "./myAccountOrgRole"
import { profileRoleLabelForMyAccount } from "./myAccountProfileRole"
import { MyAccountPanelLoader } from "./MyAccountPanelLoader"
import {
  getActiveWorkspaceCompanyName,
  getSessionOrganizationCompanyId,
} from "../../common/auth/sessionOrganization"
import { patchCompanyDisplayName } from "../Syndication/company/companyWorkspaceSettingsApi"
import { PORTAL_ACTIVE_COMPANY_CHANGED_EVENT } from "../../common/auth/setActiveCompany"
import { toast } from "../../common/components/Toast"
import { mergeSessionUserDetails, readSessionUser } from "./sessionUser"

const START_SYNDICATING_OPTIONS = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
] as const

type StartSyndicatingChoice = "yes" | "no"

function sessionRole(u: Record<string, unknown> | null): string {
  return String(u?.role ?? "").trim()
}

export function MyAccountCompanyPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { mode: portalMode, switchToSyndicating } = usePortalMode()
  const [companyName, setCompanyName] = useState("")
  const [initialCompanyName, setInitialCompanyName] = useState("")
  const [sessionUser, setSessionUser] = useState<Record<string, unknown> | null>(
    () => readSessionUser(),
  )
  const [startSyndicating, setStartSyndicating] =
    useState<StartSyndicatingChoice>("no")
  const [error, setError] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const portalRoleLabel = profileRoleLabelForMyAccount(portalMode)
  const showOrgRole = viewerShowsOrgRoleInMyAccount(sessionUser)
  const orgRoleLabel = orgRoleLabelForMyAccount(sessionUser)
  const isInvestorAccount = sessionRole(sessionUser) === INVESTOR
  const canRenameOrgCompany = sessionRole(sessionUser) === COMPANY_ADMIN
  const canEditCompanyName = isInvestorAccount || canRenameOrgCompany

  const loadFromSession = useCallback(() => {
    const u = readSessionUser()
    setSessionUser(u)
    const name = getActiveWorkspaceCompanyName()
    setCompanyName(name)
    setInitialCompanyName(name)
  }, [])

  const hasChanges = useMemo(
    () =>
      companyName.trim() !== initialCompanyName.trim() ||
      startSyndicating === "yes",
    [companyName, initialCompanyName, startSyndicating],
  )

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    loadFromSession()
    void fetchMyProfile().then((user) => {
      if (cancelled) return
      if (user) mergeSessionUserDetails(user)
      loadFromSession()
      setIsLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [location.pathname, loadFromSession])

  useEffect(() => {
    function onSessionUserUpdated() {
      loadFromSession()
    }
    function onActiveCompanyChanged() {
      loadFromSession()
    }
    window.addEventListener("portal-session-user-updated", onSessionUserUpdated)
    window.addEventListener(PORTAL_ACTIVE_COMPANY_CHANGED_EVENT, onActiveCompanyChanged)
    return () => {
      window.removeEventListener(
        "portal-session-user-updated",
        onSessionUserUpdated,
      )
      window.removeEventListener(
        PORTAL_ACTIVE_COMPANY_CHANGED_EVENT,
        onActiveCompanyChanged,
      )
    }
  }, [loadFromSession])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!canEditCompanyName || !hasChanges || isSaving) return
    const name = companyName.trim()
    if (!name) {
      setError("Enter a company name.")
      return
    }
    setError("")
    setIsSaving(true)
    try {
      if (canRenameOrgCompany) {
        const companyId = getSessionOrganizationCompanyId()
        if (!companyId) {
          setError("Company workspace is not available.")
          return
        }
        const result = await patchCompanyDisplayName(companyId, name)
        if (!result.ok) {
          setError(result.message)
          toast.error("Could not update company name", result.message)
          return
        }
        const saved = result.name
        mergeSessionUserDetails({
          companyName: saved,
          company_name: saved,
          organizationName: saved,
          organization_name: saved,
        })
        const session = readSessionUser()
        if (session && Array.isArray(session.memberships)) {
          const id = companyId.trim().toLowerCase()
          mergeSessionUserDetails({
            memberships: session.memberships.map((item) => {
              if (item == null || typeof item !== "object" || Array.isArray(item)) {
                return item
              }
              const rec = item as Record<string, unknown>
              const recId = String(
                rec.companyId ?? rec.company_id ?? "",
              )
                .trim()
                .toLowerCase()
              if (recId !== id) return item
              return {
                ...rec,
                companyName: saved,
                company_name: saved,
                company: saved,
                organization_name: saved,
              }
            }),
          })
        }
        loadFromSession()
        window.dispatchEvent(new CustomEvent(PORTAL_ACTIVE_COMPANY_CHANGED_EVENT))
        toast.success("Saved", "Company name updated.")
        return
      }
      const wantsSyndicating = startSyndicating === "yes"
      const { user, joinedExistingCompany, startedSyndicating } =
        await patchMyProfile({
          companyName: name,
          ...(wantsSyndicating ? { startSyndicating: true } : {}),
        })
      mergeSessionUserDetails(user)
      loadFromSession()
      if (startedSyndicating) {
        // New role lives in the access token, so mint a fresh pair before the
        // syndicating workspace loads.
        await refreshAuthTokens()
        const refreshed = await fetchMyProfile()
        if (refreshed) mergeSessionUserDetails(refreshed)
        setStartSyndicating("no")
        toast.success(
          "Syndicating is on",
          `You can now run deals for ${name}.`,
        )
        switchToSyndicating()
        navigate("/dashboard", { replace: true })
        return
      }
      toast.success(
        "Company details saved",
        joinedExistingCompany
          ? `This company already exists. Your account was added to ${name}.`
          : `${name} was created and linked to your account.`,
      )
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save company name.",
      )
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return <MyAccountPanelLoader label="Loading company details…" />

  return (
    <div className="myaccount_form_body myaccount_form_body--grid">
      {error ? (
        <p className="um_msg_error" role="alert">
          {error}
        </p>
      ) : null}
      <form className="myaccount_fields_grid" onSubmit={handleSubmit} noValidate>
        <div className="um_field">
          <label htmlFor="myaccount-companyName" className="um_field_label_row">
            <Building2 className="um_field_label_icon" size={17} aria-hidden />
            <span>Company name</span>
          </label>
          <input
            id="myaccount-companyName"
            name="companyName"
            type="text"
            value={companyName}
            onChange={(e) => {
              if (!canEditCompanyName) return
              setCompanyName(e.target.value)
              if (error) setError("")
            }}
            placeholder={
              canEditCompanyName ? "Your company name" : undefined
            }
            readOnly={!canEditCompanyName}
            disabled={isSaving}
            autoComplete="organization"
          />
        </div>
        <div className="um_field">
          <label htmlFor="myaccount-portal-role" className="um_field_label_row">
            <CircleUser className="um_field_label_icon" size={17} aria-hidden />
            <span>Profile Role</span>
          </label>
          <input
            id="myaccount-portal-role"
            name="portalRole"
            type="text"
            value={portalRoleLabel}
            onChange={() => {}}
            readOnly
            autoComplete="off"
          />
        </div>
        {showOrgRole ? (
          <div className="um_field">
            <label
              htmlFor="myaccount-company-org-role"
              className="um_field_label_row"
            >
              <Shield className="um_field_label_icon" size={17} aria-hidden />
              <span>Org Role</span>
            </label>
            <input
              id="myaccount-company-org-role"
              name="orgRole"
              type="text"
              value={orgRoleLabel}
              onChange={() => {}}
              readOnly
              autoComplete="off"
            />
          </div>
        ) : null}
        {isInvestorAccount ? (
          <section
            className="um_panel myaccount_question_card"
            aria-labelledby="myaccount-start-syndicating-label"
          >
            <p
              id="myaccount-start-syndicating-label"
              className="um_field_label_row"
            >
              <Rocket className="um_field_label_icon" size={17} aria-hidden />
              <span>Do you want to start syndicating?</span>
            </p>
            <p className="myaccount_field_hint">
              {companyName.trim()
                ? "Choose Yes to open the syndicating workspace for this company and raise your own deals."
                : "Add your company name above first, then choose Yes to open the syndicating workspace."}
            </p>
            <fieldset
              className="myaccount_question_fieldset"
              disabled={isSaving || !companyName.trim()}
            >
              <RadioPillGroup
                name="myaccount-start-syndicating"
                value={startSyndicating}
                options={START_SYNDICATING_OPTIONS}
                onChange={(next) => {
                  setStartSyndicating(next)
                  if (error) setError("")
                }}
                ariaLabelledBy="myaccount-start-syndicating-label"
              />
            </fieldset>
          </section>
        ) : null}
        {canEditCompanyName ? (
          <div className="myaccount_actions">
            <button
              type="submit"
              className="um_btn_primary"
              disabled={isSaving || !hasChanges || !companyName.trim()}
            >
              {isSaving ? (
                <>
                  <Loader2
                    size={16}
                    strokeWidth={2}
                    className="myaccount_btn_spin"
                    aria-hidden
                  />
                  Saving…
                </>
              ) : (
                <>
                  <Save size={16} strokeWidth={2} aria-hidden />
                  Save changes
                </>
              )}
            </button>
          </div>
        ) : null}
      </form>
    </div>
  )
}
