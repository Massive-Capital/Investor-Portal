import {
  SESSION_BEARER_KEY,
  SESSION_USER_DETAILS_KEY,
} from "./sessionKeys";
import { decodeJwtPayload } from "../../modules/auth/utils/decode-jwt-payload";

export const PLATFORM_ADMIN = "platform_admin";
export const COMPANY_ADMIN = "company_admin";
export const PLATFORM_USER = "platform_user";
export const COMPANY_USER = "company_user";

/** Legacy role from older installs */
const LEGACY_USER = "user";

export function normalizeRole(role: string | null | undefined): string {
  const r = String(role ?? "").trim();
  if (r === "") return PLATFORM_USER;
  if (r === LEGACY_USER) return PLATFORM_USER;
  return r;
}

export function getStoredUserRole(): string | null {
  try {
    const raw = sessionStorage.getItem(SESSION_USER_DETAILS_KEY);
    if (raw) {
      const arr = JSON.parse(raw) as unknown;
      if (Array.isArray(arr) && arr[0] && typeof arr[0] === "object") {
        const role = (arr[0] as Record<string, unknown>).role;
        if (typeof role === "string") return normalizeRole(role);
      }
    }
  } catch {
    /* ignore */
  }
  const token = sessionStorage.getItem(SESSION_BEARER_KEY);
  if (token) {
    const p = decodeJwtPayload<{ userRole?: string }>(token);
    if (p?.userRole != null) return normalizeRole(p.userRole);
  }
  return null;
}

export function isPlatformAdmin(): boolean {
  return getStoredUserRole() === PLATFORM_ADMIN;
}

/** Platform + company admins can open the Members area. */
export function canAccessMembersPage(): boolean {
  const r = getStoredUserRole();
  return r === PLATFORM_ADMIN || r === COMPANY_ADMIN;
}

/** Platform admins, company admins, and members can open the Company page (create is admin-only). */
export function canAccessCompanyPage(): boolean {
  const r = getStoredUserRole();
  return (
    r === PLATFORM_ADMIN ||
    r === COMPANY_ADMIN ||
    r === PLATFORM_USER ||
    r === COMPANY_USER
  );
}

export function isCompanyAdmin(): boolean {
  return getStoredUserRole() === COMPANY_ADMIN;
}

/** Org-scoped roles may edit workspace tabs when their `organizationId` matches the target company. */
export function canEditCompanyWorkspace(): boolean {
  const r = getStoredUserRole();
  return (
    r === PLATFORM_ADMIN ||
    r === COMPANY_ADMIN ||
    r === PLATFORM_USER ||
    r === COMPANY_USER
  );
}
