import { Navigate, Outlet, useLocation } from "react-router-dom";
import { SESSION_BEARER_KEY } from "./sessionKeys";

/** Wraps routes that require a valid session (JWT in sessionStorage). */
export function RequireAuth() {
  const location = useLocation();
  const token = sessionStorage.getItem(SESSION_BEARER_KEY);
  if (!token) {
    return (
      <Navigate to="/signin" replace state={{ from: location.pathname }} />
    );
  }
  return <Outlet />;
}
