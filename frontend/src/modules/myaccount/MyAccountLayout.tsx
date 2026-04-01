import { NavLink, Outlet } from "react-router-dom"
import { Building2, LockKeyhole, UserCircle } from "lucide-react"
import "../usermanagement/user_management.css"
import "./my_account.css"

export function MyAccountLayout() {
  return (
    <div className="myaccount_shell">
      <header className="myaccount_header">
        <h1 className="myaccount_title">My account</h1>
      </header>

      <div className="um_members_tabs_outer">
        <div
          className="um_members_tabs_row"
          role="tablist"
          aria-label="Account sections"
        >
          <NavLink
            to="/account/company"
            className={({ isActive }) =>
              `um_members_tab${isActive ? " um_members_tab_active" : ""}`
            }
            role="tab"
          >
            <Building2 size={18} strokeWidth={1.75} aria-hidden />
            <span>Company Details</span>
          </NavLink>
          <NavLink
            to="/account/personal"
            className={({ isActive }) =>
              `um_members_tab${isActive ? " um_members_tab_active" : ""}`
            }
            role="tab"
          >
            <UserCircle size={18} strokeWidth={1.75} aria-hidden />
            <span>Personal Details</span>
          </NavLink>
          <NavLink
            to="/account/password"
            className={({ isActive }) =>
              `um_members_tab${isActive ? " um_members_tab_active" : ""}`
            }
            role="tab"
          >
            <LockKeyhole size={18} strokeWidth={1.75} aria-hidden />
            <span>Change Password</span>
          </NavLink>
        </div>
      </div>

      <div className="um_members_tab_content">
        <div className="um_panel um_members_tab_panel">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
