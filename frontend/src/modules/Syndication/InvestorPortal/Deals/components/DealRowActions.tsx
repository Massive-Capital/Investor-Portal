import { Archive, Eye, MoreHorizontal, Trash2 } from "lucide-react"
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useNavigate } from "react-router-dom"

interface DealRowActionsProps {
  dealId: string
  dealName: string
  onArchived?: () => void
  onDeleted?: () => void
}

export function DealRowActions({
  dealId,
  dealName,
  onArchived,
  onDeleted,
}: DealRowActionsProps) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)

  const close = useCallback(() => setOpen(false), [])

  useLayoutEffect(() => {
    if (!open) return
    const trigger = wrapRef.current
    const menu = menuRef.current
    if (!trigger || !menu) return

    function syncPosition() {
      const r = trigger.getBoundingClientRect()
      const mw = menu.offsetWidth || 180
      const mh = menu.offsetHeight || 120
      const gap = 6
      const vh = window.innerHeight
      const vw = window.innerWidth
      let top = r.bottom + gap
      if (top + mh > vh - gap)
        top = Math.max(gap, r.top - mh - gap)
      let left = r.right - mw
      left = Math.min(Math.max(gap, left), vw - mw - gap)
      menu.style.position = "fixed"
      menu.style.top = `${top}px`
      menu.style.left = `${left}px`
      menu.style.right = "auto"
      menu.style.zIndex = "11000"
    }

    syncPosition()
    const raf = requestAnimationFrame(syncPosition)
    const ro = new ResizeObserver(syncPosition)
    ro.observe(menu)
    window.addEventListener("scroll", syncPosition, true)
    window.addEventListener("resize", syncPosition)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener("scroll", syncPosition, true)
      window.removeEventListener("resize", syncPosition)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      if (wrapRef.current?.contains(t)) return
      if (menuRef.current?.contains(t)) return
      close()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close()
    }
    document.addEventListener("mousedown", onDoc)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDoc)
      document.removeEventListener("keydown", onKey)
    }
  }, [open, close])

  function handleViewDeal() {
    close()
    navigate(`/deals/${dealId}`)
  }

  function handleArchiveDeal() {
    const label = dealName.trim() || "this deal"
    if (
      !window.confirm(
        `Archive “${label}”? You can restore it later when archive is connected to the server.`,
      )
    )
      return
    close()
    onArchived?.()
  }

  function handleDeleteDeal() {
    const label = dealName.trim() || "this deal"
    if (
      !window.confirm(
        `Delete “${label}”? This cannot be undone once the server supports permanent delete.`,
      )
    )
      return
    close()
    onDeleted?.()
  }

  return (
    <div className="um_kebab_root" ref={wrapRef}>
      <button
        type="button"
        className="um_kebab_trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${dealName.trim() || "deal"}`}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal size={18} strokeWidth={2} aria-hidden />
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <ul
              ref={menuRef}
              className="um_kebab_menu um_kebab_menu--portal"
              role="menu"
            >
              <li role="none">
                <button
                  type="button"
                  className="um_kebab_menuitem"
                  role="menuitem"
                  onClick={handleViewDeal}
                >
                  <Eye className="um_kebab_menuitem_icon" size={16} strokeWidth={2} aria-hidden />
                  View Deal
                </button>
              </li>
              <li role="none">
                <button
                  type="button"
                  className="um_kebab_menuitem"
                  role="menuitem"
                  onClick={handleArchiveDeal}
                >
                  <Archive className="um_kebab_menuitem_icon" size={16} strokeWidth={2} aria-hidden />
                  Archive Deal
                </button>
              </li>
              <li role="none">
                <button
                  type="button"
                  className="um_kebab_menuitem deals_kebab_menuitem_danger"
                  role="menuitem"
                  onClick={handleDeleteDeal}
                >
                  <Trash2 className="um_kebab_menuitem_icon" size={16} strokeWidth={2} aria-hidden />
                  Delete Deal
                </button>
              </li>
            </ul>,
            document.body,
          )
        : null}
    </div>
  )
}
