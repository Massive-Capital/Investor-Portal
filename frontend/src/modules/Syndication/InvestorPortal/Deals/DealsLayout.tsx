import { Navigate, Outlet, useLocation } from "react-router-dom"
import { usePortalMode } from "@/modules/Investing/context/PortalModeContext"

/** `/deals/:dealId` or `/deals/:dealId/offering-portfolio` — investing users may open a deal they participate in, not syndication tools. */
const INVESTING_DEAL_DETAIL_PATH =
  /^\/deals\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\/offering-portfolio)?$/i

/** Syndication-only shell for `/deals/*` */
export default function DealsLayout() {
  const { mode } = usePortalMode()
  const location = useLocation()

  if (mode === "investing") {
    const path = (location.pathname || "/").replace(/\/+$/, "") || "/"
    if (!INVESTING_DEAL_DETAIL_PATH.test(path)) {
      return <Navigate to="/investing/opportunities" replace />
    }
  }

  return <Outlet />
}
