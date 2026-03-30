import {
  type ComponentType,
  useEffect,
  useRef,
  useState,
} from "react"
import {
  Briefcase,
  Building2,
  ChevronDown,
  ChevronRight,
  CreditCard,
  FileText,
  Files,
  LayoutDashboard,
  Landmark,
  Mail,
  Settings,
  Star,
  TrendingUp,
  UserCircle,
  Users,
} from "lucide-react"
import { NavLink, Outlet, useLocation } from "react-router-dom"
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

type NavChild = {
  label: string
  to: string
  icon?: SidebarIcon
}

type ExpandableNavItem = {
  label: string
  icon: SidebarIcon
  children: NavChild[]
}

const sharedSidebarItems: NavItem[] = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  { label: "Company", to: "/company", icon: Building2 },
  { label: "Billing", to: "/billing", icon: CreditCard },
  { label: "Members", to: "/members", icon: Users },
]

/** Syndicating — unique `to` per item so only one NavLink is active */
const syndicationPortalChildren: NavChild[] = [
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

  const isSyndicationUnderPortal =
    mode === "syndicating" &&
    syndicationPortalChildren.some((c) => {
      const path = c.to
      return location.pathname === path || location.pathname.startsWith(`${path}/`)
    })

  const [investorPortalOpen, setInvestorPortalOpen] = useState(
    () => isSyndicationUnderPortal,
  )
  /** Tracks prior route so we collapse the group when leaving /deals/*, not when toggling on other pages. */
  const wasSyndicationUnderPortal = useRef(false)

  useEffect(() => {
    if (mode !== "syndicating") {
      wasSyndicationUnderPortal.current = false
      return
    }
    if (isSyndicationUnderPortal) {
      setInvestorPortalOpen(true)
      wasSyndicationUnderPortal.current = true
      return
    }
    if (wasSyndicationUnderPortal.current) {
      setInvestorPortalOpen(false)
      wasSyndicationUnderPortal.current = false
    }
  }, [mode, isSyndicationUnderPortal, location.pathname])

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

  const sidebarItems: (NavItem | ExpandableNavItem)[] = [
    sharedSidebarItems[0],
    {
      label: "Investor Portal",
      icon: Landmark,
      children: syndicationPortalChildren,
    },
    ...sharedSidebarItems.slice(1),
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
            <button
              type="button"
              className="app_sidebar_brand"
              onClick={() => setInvestorPortalOpen((open) => !open)}
              aria-expanded={investorPortalOpen}
              aria-controls="sidebar-investor-portal-subnav"
            >
              <h1 className="app_sidebar_title">Investor Portal</h1>
              <p className="app_sidebar_mode">{modeLabel}</p>
            </button>
            <nav className="app_sidebar_nav">
              {sidebarItems.map((item) => {
                if ("children" in item && item.children) {
                  const ExpandIcon = investorPortalOpen ? ChevronDown : ChevronRight
                  const ParentIcon = item.icon
                  return (
                    <div key={item.label} className="app_sidebar_group">
                      <button
                        type="button"
                        className={`app_sidebar_expand_btn${investorPortalOpen ? " app_sidebar_expand_btn_open" : ""}`}
                        onClick={() => setInvestorPortalOpen((v) => !v)}
                        aria-expanded={investorPortalOpen}
                        aria-controls="sidebar-investor-portal-subnav"
                        id="sidebar-investor-portal-trigger"
                      >
                        <ParentIcon size={18} />
                        <span className="app_sidebar_expand_label">{item.label}</span>
                        <ExpandIcon
                          size={16}
                          className="app_sidebar_expand_chevron"
                          aria-hidden
                        />
                      </button>
                      <div
                        id="sidebar-investor-portal-subnav"
                        className="app_sidebar_subnav"
                        role="region"
                        aria-labelledby="sidebar-investor-portal-trigger"
                        hidden={!investorPortalOpen}
                      >
                        {item.children.map((child) => {
                          const ChildIcon = child.icon
                          const useEnd = child.to === "/deals"
                          return (
                            <NavLink
                              key={`${child.label}-${child.to}`}
                              to={child.to}
                              end={useEnd}
                              className={({ isActive }) =>
                                `app_sidebar_link app_sidebar_sublink app_sidebar_sublink_with_icon${isActive ? " app_sidebar_sublink_active" : ""}`
                              }
                            >
                              {ChildIcon ? (
                                <ChildIcon
                                  size={18}
                                  className="app_sidebar_sublink_icon"
                                  aria-hidden
                                />
                              ) : null}
                              <span>{child.label}</span>
                            </NavLink>
                          )
                        })}
                      </div>
                    </div>
                  )
                }

                const { label, to, icon: Icon } = item
                return (
                  <NavLink
                    key={label}
                    to={to}
                    end={to === "/"}
                    className={({ isActive }) =>
                      `app_sidebar_link ${isActive ? "app_sidebar_link_active" : ""}`
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
