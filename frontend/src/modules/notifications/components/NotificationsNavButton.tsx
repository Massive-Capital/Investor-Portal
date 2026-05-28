import { Bell } from "lucide-react"
import { useCallback, useRef, useState } from "react"
import { useNotifications } from "../hooks/useNotifications"
import { NotificationsPopup } from "./NotificationsPopup"
import "./notifications-nav-button.css"

export function NotificationsNavButton() {
  const anchorRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const { unreadCount } = useNotifications()

  const badgeLabel =
    unreadCount > 99 ? "99+" : unreadCount > 0 ? String(unreadCount) : null

  const close = useCallback(() => setOpen(false), [])
  const toggle = useCallback(() => setOpen((v) => !v), [])

  return (
    <div className="notifications_nav_root" ref={anchorRef}>
      <button
        type="button"
        className={`notifications_nav_btn${open ? " notifications_nav_btn--open" : ""}`}
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={toggle}
      >
        <Bell size={20} strokeWidth={2} aria-hidden />
        {badgeLabel ? (
          <span className="notifications_nav_badge" aria-hidden>
            {badgeLabel}
          </span>
        ) : null}
      </button>
      <NotificationsPopup open={open} onClose={close} anchorRef={anchorRef} />
    </div>
  )
}
