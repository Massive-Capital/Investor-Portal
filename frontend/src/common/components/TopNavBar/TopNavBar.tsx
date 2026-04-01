import {
  type LucideIcon,
  ArrowLeftRight,
  ChevronDown,
  LogOut,
  UserPlus,
  UserRound,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import {
  SESSION_BEARER_KEY,
  SESSION_USER_DETAILS_KEY,
} from "../../auth/sessionKeys"
import { usePortalMode } from "../../context/PortalModeContext"
import "./top_navbar.css"

interface TopNavBarProps {
  userName?: string
  userEmail?: string
}

function initialsFromFullName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function displayNameFromSessionUser(row: Record<string, unknown>): string {
  const first = String(row.firstName ?? "").trim()
  const last = String(row.lastName ?? "").trim()
  const full = [first, last].filter(Boolean).join(" ")
  if (full) return full
  const email = String(row.email ?? "").trim()
  if (email) return email
  const username = String(row.username ?? "").trim()
  if (username) return username
  return ""
}

function readSessionUserDisplayName(): string {
  try {
    const raw = sessionStorage.getItem(SESSION_USER_DETAILS_KEY)
    if (!raw) return ""
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed) || parsed.length === 0) return ""
    const entry = parsed[0]
    if (entry == null || typeof entry !== "object" || Array.isArray(entry))
      return ""
    return displayNameFromSessionUser(entry as Record<string, unknown>)
  } catch {
    return ""
  }
}

interface ProfileMenuRowProps {
  icon: LucideIcon
  label: string
  onClick: () => void
  variant?: "default" | "logout"
}

function ProfileMenuRow({
  icon: Icon,
  label,
  onClick,
  variant = "default",
}: ProfileMenuRowProps) {
  return (
    <li role="none">
      <button
        type="button"
        className={`top_navbar_dd_item${variant === "logout" ? " top_navbar_dd_item_logout" : ""}`}
        role="menuitem"
        onClick={onClick}
      >
        <Icon
          className="top_navbar_dd_item_icon"
          size={18}
          strokeWidth={2}
          aria-hidden
        />
        <span>{label}</span>
      </button>
    </li>
  )
}

export function TopNavBar({ userName: userNameProp }: TopNavBarProps) {
  const location = useLocation()
  const [sessionUserName, setSessionUserName] = useState(() =>
    readSessionUserDisplayName(),
  )
  const userName = userNameProp ?? (sessionUserName || "User")

  useEffect(() => {
    setSessionUserName(readSessionUserDisplayName())
  }, [location.pathname])

  useEffect(() => {
    function onSessionUserUpdated() {
      setSessionUserName(readSessionUserDisplayName())
    }
    window.addEventListener("portal-session-user-updated", onSessionUserUpdated)
    return () =>
      window.removeEventListener(
        "portal-session-user-updated",
        onSessionUserUpdated,
      )
  }, [])

  const initials = initialsFromFullName(userName)
  const { mode, switchToInvesting, switchToSyndicating } = usePortalMode()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const closeMenu = useCallback(() => setMenuOpen(false), [])

  useEffect(() => {
    if (!menuOpen) return
    function onDocMouseDown(e: MouseEvent) {
      const el = wrapRef.current
      if (el && !el.contains(e.target as Node)) closeMenu()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeMenu()
    }
    document.addEventListener("mousedown", onDocMouseDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [menuOpen, closeMenu])

  function handleMyAccount() {
    closeMenu()
    navigate("/account/company")
  }

  function handleRefer() {
    closeMenu()
    navigate("/refer-a-friend")
  }

  function handleLogout() {
    closeMenu()
    sessionStorage.removeItem(SESSION_BEARER_KEY)
    sessionStorage.removeItem(SESSION_USER_DETAILS_KEY)
    navigate("/signin")
  }

  function handleSwitchToInvesting() {
    switchToInvesting()
    closeMenu()
  }

  function handleSwitchToSyndicating() {
    switchToSyndicating()
    closeMenu()
  }

  return (
    <header className="top_navbar">
      <div className="top_navbar_user_wrap" ref={wrapRef}>
        <span className="top_navbar_avatar" aria-hidden>
          {initials}
        </span>
        <button
          type="button"
          className="top_navbar_profile_btn"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span className="top_navbar_user_name">{userName}</span>
          <ChevronDown
            size={18}
            className={`top_navbar_chevron${menuOpen ? " top_navbar_chevron_open" : ""}`}
            aria-hidden
          />
        </button>
        {menuOpen ? (
          <div className="top_navbar_dd" role="menu">
            {/* <div className="top_navbar_dd_header">
              <p className="top_navbar_dd_name">{userName}</p>
              <p className="top_navbar_dd_email">{userEmail}</p>
            </div> */}
            <ul className="top_navbar_dd_list">
              {/* <ProfileMenuRow
                icon={UserRound}
                label="My account"
                onClick={handleMyAccount}
              /> */}
              {mode === "syndicating" ? (
                <ProfileMenuRow
                  icon={ArrowLeftRight}
                  label="Switch to investing"
                  onClick={handleSwitchToInvesting}
                />
              ) : (
                <ProfileMenuRow
                  icon={ArrowLeftRight}
                  label="Switch to Syndicating"
                  onClick={handleSwitchToSyndicating}
                />
              )}
              <ProfileMenuRow
                icon={UserPlus}
                label="Refer a friend"
                onClick={handleRefer}
              />
              {/* <ProfileMenuRow
                icon={FileText}
                label="Terms & policies"
                onClick={handleTerms}
              /> */}
              {/* <ProfileMenuRow
                icon={Headphones}
                label="Help"
                onClick={handleHelp}
              /> */}
              <ProfileMenuRow
                icon={UserRound}
                label="My account"
                onClick={handleMyAccount}
              />
              <ProfileMenuRow
                icon={LogOut}
                label="Log out"
                onClick={handleLogout}
                variant="logout"
              />
            </ul>
          </div>
        ) : null}
      </div>
    </header>
  )
}
