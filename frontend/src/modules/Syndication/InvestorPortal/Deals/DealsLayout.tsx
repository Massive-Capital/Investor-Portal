import { Navigate, Outlet } from "react-router-dom"
import { usePortalMode } from "../../../../common/context/PortalModeContext"

/** Syndication-only shell for `/deals/*` */
export default function DealsLayout() {
  const { mode } = usePortalMode()

  if (mode === "investing")
    return <Navigate to="/investing/opportunities" replace />

  return <Outlet />
}
