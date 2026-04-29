import { useCallback, useEffect, useState } from "react"
import { useLocation } from "react-router-dom"
import { Building2, CircleUser, Shield } from "lucide-react"
import { usePortalMode } from "@/modules/Investing/context/PortalModeContext"
import { primaryRoleLabelFromRow } from "../usermanagement/memberAdminShared"
import { fetchMyProfile } from "./accountApi"
import { mergeSessionUserDetails, readSessionUser } from "./sessionUser"

function str(u: Record<string, unknown>, key: string): string {
  return String(u[key] ?? "").trim()
}

export function MyAccountCompanyPage() {
  const location = useLocation()
  const { mode } = usePortalMode()
  const [companyName, setCompanyName] = useState("")
  const [role, setRole] = useState("")
  const portalRoleLabel = mode === "investing" ? "Investor" : "Sponsor"

  const loadFromSession = useCallback(() => {
    const u = readSessionUser()
    if (!u) return
    setCompanyName(str(u, "companyName"))
    /** Same resolution as Company Members “Roles” column — not raw `users.role` (`deal_participant`). */
    setRole(primaryRoleLabelFromRow(u))
  }, [])

  useEffect(() => {
    loadFromSession()
    void fetchMyProfile().then((user) => {
      if (user) mergeSessionUserDetails(user)
      loadFromSession()
    })
  }, [location.pathname, loadFromSession])

  return (
    <div>
      <h2 className="myaccount_section_title">Company details</h2>
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
          onChange={() => {}}
          readOnly
        />
      </div>
      <div className="um_field">
        <label htmlFor="myaccount-company-org-role" className="um_field_label_row">
          <Shield className="um_field_label_icon" size={17} aria-hidden />
          <span>Org Role</span>
        </label>
        <input
          id="myaccount-company-org-role"
          name="orgRole"
          type="text"
          value={role}
          onChange={() => {}}
          readOnly
          autoComplete="off"
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
    </div>
  )
}
