import { SESSION_USER_DETAILS_KEY } from "../../common/auth/sessionKeys";

export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

/**
 * Backend sets pending-invite usernames to `invited_` + hex (invitePendingUser.service).
 */
const INVITED_PLACEHOLDER_USERNAME_RE = /^invited_[0-9a-f]+$/i;

export function isInvitedPlaceholderUsername(value: unknown): boolean {
  const s = String(value ?? "").trim();
  return INVITED_PLACEHOLDER_USERNAME_RE.test(s);
}

/** Username in members UI: em dash when unset or when value is an invite placeholder. */
export function formatMemberUsername(value: unknown): string {
  const s = String(value ?? "")
    .trim()
    .replace(/^@+/, "");
  if (!s || isInvitedPlaceholderUsername(s)) return "—";
  return s;
}

export function rowDisplayName(row: Record<string, unknown>): string {
  const first = String(row.firstName ?? "");
  const last = String(row.lastName ?? "");
  return [first, last].filter(Boolean).join(" ") || "—";
}

/** Matches backend `INVITE_ASSIGNABLE_ROLES` (platform admin invites only). */
export const PLATFORM_INVITE_ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "platform_admin", label: "Platform Admin" },
  { value: "platform_user", label: "Platform user" },
  { value: "company_admin", label: "Company administrator" },
  { value: "company_user", label: "Company user" },
];

/** Roles a company admin may assign when editing a member. */
export const COMPANY_EDIT_ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "company_admin", label: "Company administrator" },
  { value: "company_user", label: "Company user" },
  { value: "platform_user", label: "Platform user" },
];

export const MEMBER_STATUS_EDIT_OPTIONS: { value: string; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export const MEMBER_AUDIT_ACTION_EDIT = "member_edit";
export const MEMBER_AUDIT_ACTION_SUSPEND = "member_suspend";

export function normalizeMemberStatusForEdit(row: Record<string, unknown>): string {
  const s = String(row.userStatus ?? row.user_status ?? "active")
    .trim()
    .toLowerCase();
  if (s === "inactive" || s === "suspended") return "inactive";
  return "active";
}

export function syncSessionUserDetailsById(
  userId: string,
  patch: Record<string, unknown>,
): void {
  try {
    const raw = sessionStorage.getItem(SESSION_USER_DETAILS_KEY);
    if (!raw) return;
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return;
    const next = arr.map((item) => {
      if (
        item !== null &&
        typeof item === "object" &&
        !Array.isArray(item) &&
        String((item as Record<string, unknown>).id) === userId
      ) {
        return { ...(item as Record<string, unknown>), ...patch };
      }
      return item;
    });
    sessionStorage.setItem(SESSION_USER_DETAILS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
