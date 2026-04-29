import { type ComponentType, useEffect, useId, useState } from "react"
import {
  Briefcase,
  Building2,
  ChevronDown,
  ContactRound,
  FileText,
  Files,
  LayoutDashboard,
  Mails,
  Settings,
  Star,
  TrendingUp,
  UserCircle,
  Users,
} from "lucide-react"
import { Link, NavLink, Outlet, useLocation } from "react-router-dom"
import {
  getStoredUserRole,
  isLpInvestorSessionUser,
} from "../auth/roleUtils"
import { canAccessSyndicationSidebarPath } from "../config/sideNavAccess.config"
import { TopNavBar } from "../components/TopNavBar/TopNavBar"
import {
  PortalModeProvider,
  usePortalMode,
} from "@/modules/Investing/context/PortalModeContext"
import { PortalSwitchLoader } from "@/modules/Investing/components/portal-switch-loader/PortalSwitchLoader"
import {
  pageTitleForAppPathname,
  setAppDocumentTitle,
} from "../utils/appDocumentTitle"
import { useAppShellBranding } from "../hooks/useAppShellBranding"
import "./page_layout.css"

type SidebarIcon = ComponentType<{ size?: number; className?: string }>

type NavSubItem = { label: string; to: string; icon?: SidebarIcon }

type NavItemLink = { label: string; to: string; icon: SidebarIcon }

type NavItemGroup = { label: string; icon: SidebarIcon; submenu: NavSubItem[] }

/** Top-level link, or a collapsible group (e.g. Contacts → All contacts, Email Templates). */
type NavItem = NavItemLink | NavItemGroup

/** Deals list, create, or deal detail — not investor-emails / reporting (their own nav items). */
function isSyndicatingDealsNavActive(pathname: string): boolean {
  const p = pathname.replace(/\/$/, "") || "/"
  if (p === "/deals") return true
  if (p.startsWith("/deals/investor-emails")) return false
  if (p.startsWith("/deals/reporting")) return false
  if (p === "/deals/create") return true
  if (p.startsWith("/deals/")) return true
  return false
}

function isNavItemGroup(item: NavItem): item is NavItemGroup {
  return "submenu" in item && Array.isArray(item.submenu)
}

/**
 * Collapsible sidebar group (e.g. Contacts: All contacts + Email Templates).
 */
function SidebarNavGroup({
  label,
  icon: Icon,
  items,
  pathname,
  isPathInGroup,
}: {
  label: string
  icon: SidebarIcon
  items: NavSubItem[]
  pathname: string
  isPathInGroup: (p: string) => boolean
}) {
  const reactId = useId()
  const inSection = isPathInGroup(pathname)
  const [open, setOpen] = useState(inSection)
  useEffect(() => {
    if (inSection) setOpen(true)
  }, [inSection])
  const headId = `${reactId}-nav-group-head`
  const subId = `${reactId}-nav-group-sub`
  return (
    <div className="app_sidebar_group">
      <button
        type="button"
        id={headId}
        className={`app_sidebar_expand_btn${open ? " app_sidebar_expand_btn_open" : ""}${
          inSection ? " app_sidebar_link_active" : ""
        }`}
        aria-expanded={open}
        aria-controls={subId}
        onClick={() => {
          setOpen((o) => !o)
        }}
      >
        <Icon size={18} />
        <span className="app_sidebar_expand_label">{label}</span>
        <ChevronDown
          size={16}
          className={`app_sidebar_expand_chevron${open ? " app_sidebar_expand_chevron_open" : ""}`}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          id={subId}
          className="app_sidebar_subnav"
          role="group"
          aria-labelledby={headId}
        >
          {items.map((s) => {
            const SubIcon = s.icon
            return (
              <NavLink
                key={s.to}
                to={s.to}
                end
                className={({ isActive }) =>
                  `app_sidebar_link app_sidebar_sublink${
                    SubIcon ? " app_sidebar_sublink_with_icon" : ""
                  }${
                    isActive
                      ? " app_sidebar_link_active app_sidebar_sublink_active"
                      : ""
                  }`
                }
              >
                {SubIcon ? (
                  <SubIcon
                    size={16}
                    className="app_sidebar_sublink_icon"
                    aria-hidden
                  />
                ) : null}
                <span>{s.label}</span>
              </NavLink>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

const sharedSidebarItems: NavItem[] = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  // { label: "Leads", to: "/leads", icon: UserPlus },
  {
    label: "Contacts",
    icon: ContactRound,
    submenu: [
      { label: "All contacts", to: "/contacts", icon: Users },
      { label: "Email Templates", to: "/contacts/email-templates", icon: Mails },
    ],
  },
  { label: "Settings", to: "/settings", icon: Settings },
  { label: "Customers", to: "/customers", icon: Building2 },
  // { label: "Billing", to: "/billing", icon: CreditCard },
  // { label: "Members", to: "/members", icon: Users },
]

/** Syndicating — unique `to` per item so only one NavLink is active */
const syndicationPortalNavItems: NavItemLink[] = [
  { label: "Deals", to: "/deals", icon: Briefcase },
  // { label: "Investor emails", to: "/deals/investor-emails", icon: Mail },
  { label: "Reporting", to: "/deals/reporting", icon: Files },
]

/** Investing mode — flat nav (reference UI) */
const investingNavItems: NavItemLink[] = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  { label: "Company overview", to: "/investing/company", icon: Building2 },
  { label: "Investments", to: "/investing/investments", icon: TrendingUp },
  { label: "Documents", to: "/investing/documents", icon: FileText },
  { label: "Profiles", to: "/investing/profiles", icon: UserCircle },
  { label: "Deals", to: "/investing/deals", icon: Briefcase },
  { label: "Settings", to: "/investing/settings", icon: Settings },
  { label: "Leave a review", to: "/investing/review", icon: Star },
]

/** LP Investor deal participants — investing shell only; no company admin / syndication items */
// const lpInvestorInvestingNavItems: NavItem[] = [
//   { label: "Dashboard", to: "/", icon: LayoutDashboard },
//   { label: "Deals", to: "/investing/deals", icon: Briefcase },
//   { label: "Portfolio", to: "/investing/investments", icon: TrendingUp },
//   { label: "Cashflows", to: "/investing/cashflows", icon: Banknote },
//   { label: "Contacts", to: "/contacts", icon: ContactRound },
// ]

function PageLayoutInner() {
  const location = useLocation()
  const { mode, portalSwitchOverlay } = usePortalMode()
  const lpInvestor = isLpInvestorSessionUser()
  const { sidebarLogoSrc: workspaceSidebarLogoSrc } = useAppShellBranding()

  useEffect(() => {
    if (!portalSwitchOverlay) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [portalSwitchOverlay])

  useEffect(() => {
    setAppDocumentTitle(
      pageTitleForAppPathname(location.pathname, location.search),
    )
  }, [location.pathname, location.search])

  /** After Contacts group: Settings, Customers, Billing, Members — filtered by {@link canAccessSyndicationSidebarPath} */
  const sharedSidebarTail = sharedSidebarItems
    .slice(2)
    .filter((item) => {
      const path = "to" in item && item.to ? item.to : null
      if (!path) return true
      return canAccessSyndicationSidebarPath(path, getStoredUserRole())
    })

  const sidebarItems: NavItem[] = [
    sharedSidebarItems[0],
    // [1] is Contacts group (sub: All contacts, Email Templates)
    sharedSidebarItems[1],
    ...syndicationPortalNavItems,
    ...sharedSidebarTail,
  ]

  const showInvestingSidebar = lpInvestor || mode === "investing"
  const modeLabel = lpInvestor
    ? "Investing"
    : mode === "syndicating"
      ? "Syndicating"
      : "Investing"
  const investingSidebarItems = lpInvestor
    ? investingNavItems
    : investingNavItems

  return (
    <div className="app_shell">
      {portalSwitchOverlay ? (
        <PortalSwitchLoader caption={portalSwitchOverlay.caption} />
      ) : null}
      <aside className="app_sidebar">
        <div className="app_sidebar_brand app_sidebar_brand_static">
          {workspaceSidebarLogoSrc ? (
            <div className="app_sidebar_brand_mark">
              <img
                className="app_sidebar_brand_logo"
                src={workspaceSidebarLogoSrc}
                alt=""
                width={200}
                height={80}
                loading="eager"
                fetchPriority="high"
                decoding="async"
                key={workspaceSidebarLogoSrc}
              />
            </div>
          ) : null}
          <h1 className="app_sidebar_title">Investor Portal</h1>
        </div>
        <div className="app_sidebar_nav_region">
          <nav className="app_sidebar_nav" aria-label="Main navigation">
            {showInvestingSidebar
              ? investingSidebarItems.map((item) => {
                  const Icon = item.icon
                  if (item.to === "/investing/profiles") {
                    const profilesActive = location.pathname.startsWith(
                      "/investing/profiles",
                    )
                    return (
                      <Link
                        key={item.label}
                        to={item.to}
                        className={`app_sidebar_link${profilesActive ? " app_sidebar_link_active" : ""}`}
                        aria-current={profilesActive ? "page" : undefined}
                      >
                        <Icon size={18} />
                        <span>{item.label}</span>
                      </Link>
                    )
                  }
                  return (
                    <NavLink
                      key={item.label}
                      to={item.to}
                      end={item.to === "/"}
                      className={({ isActive }) =>
                        `app_sidebar_link${isActive ? " app_sidebar_link_active" : ""}`
                      }
                    >
                      <Icon size={18} />
                      <span>{item.label}</span>
                    </NavLink>
                  )
                })
              : sidebarItems.map((item) => {
                  if (isNavItemGroup(item)) {
                    return (
                      <SidebarNavGroup
                        key={item.label}
                        label={item.label}
                        icon={item.icon}
                        items={item.submenu}
                        pathname={location.pathname}
                        isPathInGroup={(p) =>
                          p === "/contacts" || p.startsWith("/contacts/")
                        }
                      />
                    )
                  }

                  const { label, to, icon: Icon } = item

                  if (to === "/deals") {
                    const dealsActive = isSyndicatingDealsNavActive(
                      location.pathname,
                    )
                    return (
                      <Link
                        key={label}
                        to={to}
                        className={`app_sidebar_link${dealsActive ? " app_sidebar_link_active" : ""}`}
                        aria-current={dealsActive ? "page" : undefined}
                      >
                        <Icon size={18} />
                        <span>{label}</span>
                      </Link>
                    )
                  }

                  const linkEnd = to === "/"
                  return (
                    <NavLink
                      key={label}
                      to={to}
                      end={linkEnd}
                      className={({ isActive }) =>
                        `app_sidebar_link${isActive ? " app_sidebar_link_active" : ""}`
                      }
                    >
                      <Icon size={18} />
                      <span>{label}</span>
                    </NavLink>
                  )
                })}
          </nav>
        </div>
        <footer
          className="app_sidebar_mode_footer"
          role="status"
          aria-live="polite"
          aria-label="Workspace mode"
        >
          {/* <span className="app_sidebar_mode_eyebrow">Workspace</span> */}
          <p className="app_sidebar_mode">{modeLabel}</p>
        </footer>
      </aside>

      <section className="app_main_section">
        <TopNavBar />
        <main className="app_main_content">
          <Outlet />
        </main>
      </section>
    </div>
  )
}

function PageLayout() {
  return (
    <PortalModeProvider>
      <PageLayoutInner />
    </PortalModeProvider>
  )
}

export default PageLayout
