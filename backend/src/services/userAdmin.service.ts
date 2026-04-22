import { desc, eq, getTableColumns } from "drizzle-orm";
import { db } from "../database/db.js";
import {
  companies,
  memberAdminAuditLogs,
  users,
  type UserRow,
} from "../schema/schema.js";
import {
  COMPANY_ADMIN,
  COMPANY_USER,
  isCompanyAdminRole,
  isInviteAssignableRole,
  isPlatformAdminRole,
  PLATFORM_ADMIN,
  PLATFORM_USER,
} from "../constants/roles.js";
import {
  enrichSerializedUsersWithDealParticipantRoles,
  enrichUserRecordForDealParticipant,
} from "./dealParticipantProfile.service.js";
import { enrichUserRowsWithMemberships } from "./userMemberships.service.js";

const ALLOWED_USER_STATUS = new Set(["active", "inactive"]);

export const MEMBER_AUDIT_ACTION_EDIT = "member_edit";
export const MEMBER_AUDIT_ACTION_SUSPEND = "member_suspend";

export type MemberAuditAction =
  | typeof MEMBER_AUDIT_ACTION_EDIT
  | typeof MEMBER_AUDIT_ACTION_SUSPEND;

const COMPANY_ADMIN_EDITABLE_ROLES = new Set([
  COMPANY_ADMIN,
  COMPANY_USER,
  PLATFORM_USER,
]);

function stripPassword(u: UserRow): Omit<UserRow, "passwordHash"> {
  const { passwordHash: _p, ...rest } = u;
  return rest;
}

/** Shape aligned with sign-in `userDetails` entries for the frontend. */
export function serializeUserForClient(u: UserRow): Record<string, unknown> {
  const rest = stripPassword(u);
  return {
    ...rest,
    organization_id: rest.organizationId ?? null,
  };
}

function serializeUserForClientWithResolvedCompany(
  u: UserRow,
  organizationNameFromJoin: string | null | undefined,
): Record<string, unknown> {
  const base = serializeUserForClient(u);
  const own = String(u.companyName ?? "").trim();
  const fromOrg = String(organizationNameFromJoin ?? "").trim();
  if (!own && fromOrg) {
    return { ...base, companyName: fromOrg };
  }
  return base;
}

const ORG_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function listUsersForAdmin(
  actorRole: string,
  actorOrganizationId: string | null,
  opts?: { filterOrganizationId?: string | null },
): Promise<Record<string, unknown>[] | null> {
  if (isPlatformAdminRole(actorRole)) {
    const filterOrg = opts?.filterOrganizationId?.trim() ?? "";
    const applyOrgFilter =
      filterOrg.length > 0 && ORG_UUID_RE.test(filterOrg);

    const rows = applyOrgFilter
      ? await db
          .select({
            ...getTableColumns(users),
            orgName: companies.name,
          })
          .from(users)
          .leftJoin(companies, eq(users.organizationId, companies.id))
          .where(eq(users.organizationId, filterOrg))
          .orderBy(desc(users.createdAt))
      : await db
          .select({
            ...getTableColumns(users),
            orgName: companies.name,
          })
          .from(users)
          .leftJoin(companies, eq(users.organizationId, companies.id))
          .orderBy(desc(users.createdAt));
    const mapped = rows.map((r) => {
      const { orgName, ...userCols } = r;
      return serializeUserForClientWithResolvedCompany(
        userCols as UserRow,
        orgName,
      );
    });
    const withDeal = await enrichSerializedUsersWithDealParticipantRoles(mapped);
    return enrichUserRowsWithMemberships(withDeal);
  }
  if (isCompanyAdminRole(actorRole) && actorOrganizationId) {
    const rows = await db
      .select({
        ...getTableColumns(users),
        orgName: companies.name,
      })
      .from(users)
      .leftJoin(companies, eq(users.organizationId, companies.id))
      .where(eq(users.organizationId, actorOrganizationId))
      .orderBy(desc(users.createdAt));
    const mapped = rows.map((r) => {
      const { orgName, ...userCols } = r;
      return serializeUserForClientWithResolvedCompany(
        userCols as UserRow,
        orgName,
      );
    });
    const withDeal = await enrichSerializedUsersWithDealParticipantRoles(mapped);
    return enrichUserRowsWithMemberships(withDeal);
  }
  return null;
}

export async function updateMemberUser(
  targetUserId: string,
  patch: { role?: string; userStatus?: string },
  actorId: string,
  actorRole: string,
  audit: { reason: string; action: MemberAuditAction },
): Promise<
  | { ok: true; user: Record<string, unknown> }
  | { ok: false; status: number; message: string }
> {
  const hasRole = patch.role !== undefined;
  const hasStatus = patch.userStatus !== undefined;
  if (!hasRole && !hasStatus) {
    return { ok: false, status: 400, message: "No changes" };
  }

  const [actor] = await db
    .select()
    .from(users)
    .where(eq(users.id, actorId))
    .limit(1);
  if (!actor) {
    return { ok: false, status: 401, message: "User not found" };
  }

  const [target] = await db
    .select()
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);
  if (!target) {
    return { ok: false, status: 404, message: "Member not found" };
  }

  if (!isPlatformAdminRole(actorRole) && !isCompanyAdminRole(actorRole)) {
    return { ok: false, status: 403, message: "Not allowed to update members" };
  }

  if (isCompanyAdminRole(actorRole)) {
    if (String(target.role ?? "").trim() === PLATFORM_ADMIN) {
      return {
        ok: false,
        status: 403,
        message: "Cannot edit platform administrators",
      };
    }
    const orgId = actor.organizationId;
    if (!orgId || target.organizationId !== orgId) {
      return {
        ok: false,
        status: 403,
        message: "You can only edit members in your organization",
      };
    }
    if (hasRole) {
      const r = String(patch.role ?? "").trim();
      if (!COMPANY_ADMIN_EDITABLE_ROLES.has(r)) {
        return { ok: false, status: 400, message: "Invalid role for your access level" };
      }
    }
  }

  if (isPlatformAdminRole(actorRole) && hasRole) {
    const r = String(patch.role ?? "").trim();
    if (!isInviteAssignableRole(r)) {
      return { ok: false, status: 400, message: "Invalid role" };
    }
  }

  if (hasStatus) {
    const s = String(patch.userStatus ?? "").trim().toLowerCase();
    if (!ALLOWED_USER_STATUS.has(s)) {
      return { ok: false, status: 400, message: "Invalid status" };
    }
  }

  const prevRole = String(target.role ?? "").trim();
  const prevStatus = String(target.userStatus ?? "").trim().toLowerCase();
  const nextRole = hasRole
    ? String(patch.role ?? "").trim()
    : prevRole;
  const nextStatus = hasStatus
    ? String(patch.userStatus ?? "").trim().toLowerCase()
    : prevStatus;

  const roleChanged = hasRole && nextRole !== prevRole;
  const statusChanged = hasStatus && nextStatus !== prevStatus;

  if (!roleChanged && !statusChanged) {
    return { ok: false, status: 400, message: "No changes" };
  }

  if (audit.action === MEMBER_AUDIT_ACTION_SUSPEND) {
    if (!statusChanged || nextStatus !== "inactive") {
      return {
        ok: false,
        status: 400,
        message: "Suspend requires changing member status to inactive",
      };
    }
    if (roleChanged) {
      return {
        ok: false,
        status: 400,
        message: "Suspend action cannot change role",
      };
    }
  }

  const updates: Partial<{
    role: string;
    userStatus: string;
    updatedAt: Date;
  }> = {
    updatedAt: new Date(),
  };
  if (roleChanged) {
    updates.role = nextRole;
  }
  if (statusChanged) {
    updates.userStatus = nextStatus;
  }

  const changesJson: Record<string, { from: string; to: string }> = {};
  if (roleChanged) {
    changesJson.role = { from: prevRole, to: nextRole };
  }
  if (statusChanged) {
    changesJson.userStatus = { from: prevStatus, to: nextStatus };
  }

  try {
    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(users)
        .set(updates)
        .where(eq(users.id, targetUserId))
        .returning();
      if (!row) throw new Error("update_returned_no_row");
      await tx.insert(memberAdminAuditLogs).values({
        actorUserId: actorId,
        targetUserId,
        action: audit.action,
        reason: audit.reason,
        changesJson,
      });
      return row;
    });
    return {
      ok: true,
      user: await enrichUserRecordForDealParticipant(
        serializeUserForClient(updated),
        targetUserId,
      ),
    };
  } catch (err) {
    if (err instanceof Error && err.message === "update_returned_no_row") {
      return { ok: false, status: 500, message: "Could not update member" };
    }
    const pg =
      err && typeof err === "object" && "code" in err
        ? (err as { code?: string; message?: string })
        : {};
    console.error("updateMemberUser:", err);
    if (pg.code === "42P01") {
      return {
        ok: false,
        status: 503,
        message:
          "Database is missing the member audit table. Restart the backend server (it will create it) or run migrations.",
      };
    }
    if (pg.code === "23503") {
      return {
        ok: false,
        status: 400,
        message: "Cannot record this change (reference error). Check that both users exist.",
      };
    }
    return { ok: false, status: 500, message: "Could not update member" };
  }
}

export async function listMemberAdminAuditLogsForTarget(
  targetUserId: string,
  actorId: string,
  actorRole: string,
  actorOrganizationId: string | null,
): Promise<
  | {
      ok: true;
      logs: {
        id: string;
        actorUserId: string;
        actorEmail: string;
        action: string;
        reason: string;
        changesJson: Record<string, unknown> | null;
        createdAt: string;
      }[];
    }
  | { ok: false; status: number; message: string }
> {
  const [target] = await db
    .select()
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);
  if (!target) {
    return { ok: false, status: 404, message: "Member not found" };
  }

  if (!isPlatformAdminRole(actorRole) && !isCompanyAdminRole(actorRole)) {
    return { ok: false, status: 403, message: "Not allowed" };
  }

  if (isCompanyAdminRole(actorRole)) {
    if (String(target.role ?? "").trim() === PLATFORM_ADMIN) {
      return { ok: false, status: 403, message: "Not allowed" };
    }
    const orgId = actorOrganizationId;
    if (!orgId || target.organizationId !== orgId) {
      return {
        ok: false,
        status: 403,
        message: "You can only view logs for members in your organization",
      };
    }
  }

  const actorUsers = users;
  const rows = await db
    .select({
      id: memberAdminAuditLogs.id,
      actorUserId: memberAdminAuditLogs.actorUserId,
      actorEmail: actorUsers.email,
      action: memberAdminAuditLogs.action,
      reason: memberAdminAuditLogs.reason,
      changesJson: memberAdminAuditLogs.changesJson,
      createdAt: memberAdminAuditLogs.createdAt,
    })
    .from(memberAdminAuditLogs)
    .innerJoin(actorUsers, eq(memberAdminAuditLogs.actorUserId, actorUsers.id))
    .where(eq(memberAdminAuditLogs.targetUserId, targetUserId))
    .orderBy(desc(memberAdminAuditLogs.createdAt))
    .limit(50);

  return {
    ok: true,
    logs: rows.map((r) => ({
      id: r.id,
      actorUserId: r.actorUserId,
      actorEmail: r.actorEmail,
      action: r.action,
      reason: r.reason,
      changesJson: (r.changesJson as Record<string, unknown> | null) ?? null,
      createdAt:
        r.createdAt instanceof Date
          ? r.createdAt.toISOString()
          : String(r.createdAt),
    })),
  };
}
