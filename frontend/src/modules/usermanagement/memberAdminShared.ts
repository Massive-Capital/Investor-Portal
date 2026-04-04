import { SESSION_USER_DETAILS_KEY } from "../../common/auth/sessionKeys";

export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

/** Distinct deals for this member (API: `assignedDealCount` / `assigned_deal_count`). */
export function assignedDealCountFromRow(row: Record<string, unknown>): number {
  const v =
    row.assignedDealCount ??
    row.assigned_deal_count ??
    row.dealCount ??
    row.deal_count;
  if (typeof v === "number" && Number.isFinite(v))
    return Math.max(0, Math.floor(v));
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.max(0, Math.floor(n));
  }
  return 0;
}

export function accountStatusLabel(row: Record<string, unknown>): string {
  const raw = row.userSignupCompleted ?? row.user_signup_completed;
  const v = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (v === "true") return "Complete";
  if (v === "false") return "Incomplete";
  return formatValue(raw);
}

/** User row status (active = green dot; otherwise coral + label). */
export function userStatusForUi(row: Record<string, unknown>): {
  positive: boolean;
  label: string;
} {
  const raw = String(row.userStatus ?? "").trim();
  if (!raw) return { positive: false, label: "—" };
  const low = raw.toLowerCase();
  if (low === "active") return { positive: true, label: "Active" };
  if (low === "inactive" || low === "suspended") {
    return { positive: false, label: "Inactive" };
  }
  const label = raw
    .split(/[\s_-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
  return { positive: false, label };
}

/** Account signup status (complete = green; invited = blue; expired = coral). */
export function accountStatusForUi(row: Record<string, unknown>): {
  positive: boolean;
  label: string;
  dotTone?: "invited";
} {
  const raw = row.userSignupCompleted ?? row.user_signup_completed;
  const v = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (v === "true") return { positive: true, label: "Complete" };
  if (v === "false") {
    const expRaw = row.inviteExpiresAt ?? row.invite_expires_at;
    if (expRaw) {
      const t = new Date(String(expRaw)).getTime();
      if (!Number.isNaN(t) && Date.now() > t) {
        return { positive: false, label: "Invite expired" };
      }
    }
    return { positive: false, label: "Invited", dotTone: "invited" };
  }
  const l = accountStatusLabel(row);
  if (l === "—") return { positive: false, label: "—" };
  if (l === "Complete") return { positive: true, label: "Complete" };
  if (l === "Incomplete") return { positive: false, label: "Incomplete" };
  return { positive: false, label: l };
}

/** Matches account row label "Invite expired" — pending signup and invite link past expiry. */
export function accountInviteIsExpired(row: Record<string, unknown>): boolean {
  const raw = row.userSignupCompleted ?? row.user_signup_completed;
  const v = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (v !== "false") return false;
  const expRaw = row.inviteExpiresAt ?? row.invite_expires_at;
  if (!expRaw) return false;
  const t = new Date(String(expRaw)).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() > t;
}

export function companyCellValue(row: Record<string, unknown>): string {
  const raw = row.companyName ?? row.company_name;
  const s = String(raw ?? "").trim();
  return s || "—";
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
  { value: "company_admin", label: "Company Admin" },
  { value: "company_user", label: "Company Member" },
];

/** Roles a company admin may assign when editing a member. */
export const COMPANY_EDIT_ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "company_admin", label: "Company Admin" },
  { value: "company_user", label: "Company Member" },
  { value: "platform_user", label: "Platform user" },
];

/**
 * Human-readable role name for the members table, modals, export, and search.
 * Aligns with invite/edit options and the Role Definitions panel.
 */
export function memberRoleDisplayName(role: unknown): string {
  const r = String(role ?? "").trim().toLowerCase();
  if (!r) return "—";
  const byCode: Record<string, string> = {
    platform_admin: "Platform Admin",
    platform_user: "Platform user",
    /** Legacy alias stored for some accounts */
    user: "Platform user",
    company_admin: "Company Admin",
    company_user: "Company Member",
  };
  if (byCode[r]) return byCode[r];
  const raw = String(role ?? "").trim();
  return (
    raw
      .split(/[\s_-]+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ") || "—"
  );
}

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

export function memberRowIsInactive(row: Record<string, unknown>): boolean {
  const s = String(row.userStatus ?? "").trim().toLowerCase();
  return s === "suspended" || s === "inactive";
}

export function memberInvitePending(row: Record<string, unknown>): boolean {
  const v = String(
    row.userSignupCompleted ?? row.user_signup_completed ?? "",
  )
    .trim()
    .toLowerCase();
  return v === "false";
}

/** Compare row id to signed-in user (JWT `id`), case-insensitive. */
export function memberRowIsCurrentUser(
  row: Record<string, unknown>,
  sessionUserId: string,
): boolean {
  if (!sessionUserId) return false;
  const rid = row.id ?? row.userId ?? row.user_id;
  return String(rid ?? "").trim().toLowerCase() === sessionUserId;
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
