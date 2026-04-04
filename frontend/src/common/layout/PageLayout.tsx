import { type ComponentType, useEffect } from "react"
import {
  Briefcase,
  Building2,
  ContactRound,
  CreditCard,
  FileText,
  Files,
  LayoutDashboard,
  Mail,
  Settings,
  Star,
  TrendingUp,
  UserCircle,
  UserPlus,
  Users,
} from "lucide-react"
import { Link, NavLink, Outlet, useLocation } from "react-router-dom"
import { isPlatformAdmin } from "../auth/roleUtils"
import { TopNavBar } from "../components/TopNavBar/TopNavBar"
import {
  PortalModeProvider,
  usePortalMode,
} from "../context/PortalModeContext"
import { PortalSwitchLoader } from "./PortalSwitchLoader"
import {
  pageTitleForAppPathname,
  setAppDocumentTitle,
} from "../utils/appDocumentTitle"
import "./page_layout.css"

type SidebarIcon = ComponentType<{ size?: number; className?: string }>

type NavItem = {
  label: string
  to: string
  icon: SidebarIcon
  children?: undefined
}

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

const sharedSidebarItems: NavItem[] = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  { label: "Leads", to: "/leads", icon: UserPlus },
  { label: "All contacts", to: "/contacts", icon: ContactRound },
  { label: "Settings", to: "/settings", icon: Settings },
  { label: "Customers", to: "/customers", icon: Building2 },
  { label: "Billing", to: "/billing", icon: CreditCard },
  { label: "Members", to: "/members", icon: Users },
]

/** Syndicating — unique `to` per item so only one NavLink is active */
const syndicationPortalNavItems: NavItem[] = [
  { label: "Deals", to: "/deals", icon: Briefcase },
  { label: "Investor emails", to: "/deals/investor-emails", icon: Mail },
  { label: "Reporting", to: "/deals/reporting", icon: Files },
]

/** Investing mode — flat nav (reference UI) */
const investingNavItems: NavItem[] = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  { label: "Company overview", to: "/company", icon: Building2 },
  { label: "Investments", to: "/investing/investments", icon: TrendingUp },
  { label: "Documents", to: "/investing/documents", icon: FileText },
  { label: "Profiles", to: "/investing/profiles", icon: UserCircle },
  { label: "Deals", to: "/investing/deals", icon: Briefcase },
  { label: "Settings", to: "/investing/settings", icon: Settings },
  { label: "Leave a review", to: "/investing/review", icon: Star },
]

function PageLayoutInner() {
  const location = useLocation()
  const { mode, portalSwitchOverlay } = usePortalMode()

  useEffect(() => {
    if (!portalSwitchOverlay) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [portalSwitchOverlay])

  useEffect(() => {
    setAppDocumentTitle(pageTitleForAppPathname(location.pathname))
  }, [location.pathname])

  /** Dashboard → Leads → Contacts → Deals (syndication) → … → Settings, Customers (platform admin only), … */
  const sharedSidebarTail = isPlatformAdmin()
    ? sharedSidebarItems.slice(3)
    : sharedSidebarItems.slice(3).filter((item) => item.to !== "/customers")

  const sidebarItems: NavItem[] = [
    sharedSidebarItems[0],
    sharedSidebarItems[1],
    sharedSidebarItems[2],
    ...syndicationPortalNavItems,
    ...sharedSidebarTail,
  ]

  const modeLabel =
    mode === "syndicating" ? "Syndicating" : "Investing"

  return (
    <div className="app_shell">
      {portalSwitchOverlay ? (
        <PortalSwitchLoader caption={portalSwitchOverlay.caption} />
      ) : null}
      <aside className="app_sidebar">
        {mode === "investing" ? (
          <>
            <div className="app_sidebar_brand app_sidebar_brand_static">
              <h1 className="app_sidebar_title">Investor Portal</h1>
              <p className="app_sidebar_mode">{modeLabel}</p>
            </div>
            <nav className="app_sidebar_nav">
              {investingNavItems.map((item) => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.label}
                    to={item.to}
                    end
                    className={({ isActive }) =>
                      `app_sidebar_link${isActive ? " app_sidebar_link_active" : ""}`
                    }
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </NavLink>
                )
              })}
            </nav>
          </>
        ) : (
          <>
            <div className="app_sidebar_brand app_sidebar_brand_static">
              <h1 className="app_sidebar_title">Investor Portal</h1>
              <p className="app_sidebar_mode">{modeLabel}</p>
            </div>
            <nav className="app_sidebar_nav">
              {sidebarItems.map((item) => {
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
          </>
        )}
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
