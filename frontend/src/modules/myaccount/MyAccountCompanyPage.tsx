import { useCallback, useEffect, useState } from "react"
import { useLocation } from "react-router-dom"
import { Building2, Shield } from "lucide-react"
import { readSessionUser } from "./sessionUser"

function str(u: Record<string, unknown>, key: string): string {
  return String(u[key] ?? "").trim()
}

export function MyAccountCompanyPage() {
  const location = useLocation()
  const [companyName, setCompanyName] = useState("")
  const [role, setRole] = useState("")

  const loadFromSession = useCallback(() => {
    const u = readSessionUser()
    if (!u) return
    setCompanyName(str(u, "companyName"))
    setRole(str(u, "role"))
  }, [])

  useEffect(() => {
    loadFromSession()
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
        <label htmlFor="myaccount-company-role" className="um_field_label_row">
          <Shield className="um_field_label_icon" size={17} aria-hidden />
          <span>Role</span>
        </label>
        <input
          id="myaccount-company-role"
          name="role"
          type="text"
          value={role}
          onChange={() => {}}
          readOnly
        />
      </div>
    </div>
  )
}
