import { Navigate, Outlet, useLocation } from "react-router-dom";
import { parseSafeNextPath } from "./parseSafeNextPath";
import { AUTH_RETURN_NEXT_KEY, SESSION_BEARER_KEY } from "./sessionKeys";

/** Wraps routes that require a valid session (JWT in sessionStorage). */
export function RequireAuth() {
  const location = useLocation();
  const token = sessionStorage.getItem(SESSION_BEARER_KEY);
  if (!token) {
    const returnPath = `${location.pathname}${location.search}`;
    const safeNext = parseSafeNextPath(returnPath);
    if (safeNext) {
      sessionStorage.setItem(AUTH_RETURN_NEXT_KEY, safeNext);
      return (
        <Navigate
          to={`/signin?next=${encodeURIComponent(safeNext)}`}
          replace
          state={{ from: safeNext }}
        />
      );
    }
    return <Navigate to="/signin" replace />;
  }
  return <Outlet />;
}
