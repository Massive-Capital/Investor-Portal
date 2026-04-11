import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { getJwtUser } from "../middleware/jwtUser.js";
import { db } from "../database/db.js";
import { users } from "../schema/schema.js";
import {
  isCompanyAdminRole,
  isPlatformAdminRole,
} from "../constants/roles.js";
import { countAssignedDealsByUserIdsForViewer } from "../services/assigningDealUser.service.js";
import {
  listMemberAdminAuditLogsForTarget,
  listUsersForAdmin,
  MEMBER_AUDIT_ACTION_EDIT,
  MEMBER_AUDIT_ACTION_SUSPEND,
  updateMemberUser,
} from "../services/userAdmin.service.js";
import { getUserContactsExportAuditFields } from "../services/contact.service.js";
import { sanitizeExportedLinesForNotify } from "../services/exportNotifySanitize.js";
import { sendWorkspaceExportAuditNotification } from "../services/workspaceExportAudit.service.js";

function bodyString(v: unknown): string {
  return typeof v === "string" ? v : v != null ? String(v) : "";
}

/** `organizationId` or `organization_id` — platform admin only (customer company drill-in). */
function organizationIdFromQuery(req: Request): string | undefined {
  const raw = req.query.organizationId ?? req.query.organization_id;
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (typeof s !== "string") return undefined;
  const t = s.trim();
  return t || undefined;
}

const ORG_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** DB `users.role` is authoritative; JWT `userRole` fills gaps (legacy rows). */
function actorRoleForMemberAdmin(
  actor: { role: string | null },
  jwtUser: { userRole?: string },
): string {
  return (
    String(actor.role ?? "").trim() || String(jwtUser.userRole ?? "").trim()
  );
}

export async function getUsers(req: Request, res: Response): Promise<void> {
  const jwtUser = getJwtUser(req);
  if (!jwtUser?.id) {
    res.status(401).json({ message: "Authorization required" });
    return;
  }

  const [actor] = await db
    .select()
    .from(users)
    .where(eq(users.id, jwtUser.id))
    .limit(1);
  if (!actor) {
    res.status(401).json({ message: "User not found" });
    return;
  }

  const role = actorRoleForMemberAdmin(actor, jwtUser);
  if (!isPlatformAdminRole(role) && !isCompanyAdminRole(role)) {
    res.status(403).json({ message: "Not allowed to list members" });
    return;
  }

  const filterOrganizationId = isPlatformAdminRole(role)
    ? organizationIdFromQuery(req)
    : undefined;

  const rows = await listUsersForAdmin(
    role,
    actor.organizationId ?? null,
    filterOrganizationId !== undefined
      ? { filterOrganizationId }
      : undefined,
  );
  if (rows === null) {
    res.status(403).json({ message: "Not allowed to list members" });
    return;
  }

  const restrictToOrganizationId: string | null =
    isCompanyAdminRole(role) && actor.organizationId
      ? actor.organizationId
      : filterOrganizationId && ORG_UUID_RE.test(filterOrganizationId)
        ? filterOrganizationId
        : null;

  const useGlobalCounts =
    isPlatformAdminRole(role) && restrictToOrganizationId == null;

  const userIds = [
    ...new Set(
      rows
        .map((r) => String(r.id ?? "").trim().toLowerCase())
        .filter((id) => ORG_UUID_RE.test(id)),
    ),
  ];
  const dealCounts = await countAssignedDealsByUserIdsForViewer({
    userIds,
    restrictToOrganizationId: useGlobalCounts ? null : restrictToOrganizationId,
  });

  const enriched = rows.map((r) => {
    const id = String(r.id ?? "").trim().toLowerCase();
    const c = dealCounts.get(id) ?? 0;
    return {
      ...r,
      assignedDealCount: c,
      assigned_deal_count: c,
    };
  });

  res.status(200).json({ users: enriched });
}

type PatchUserBody = {
  role?: unknown;
  userStatus?: unknown;
  reason?: unknown;
  action?: unknown;
};

const REASON_MAX_LEN = 4000;

export async function patchUser(req: Request, res: Response): Promise<void> {
  const jwtUser = getJwtUser(req);
  if (!jwtUser?.id) {
    res.status(401).json({ message: "Authorization required" });
    return;
  }

  const userId = req.params.userId;
  if (typeof userId !== "string" || !userId.trim()) {
    res.status(400).json({ message: "User id required" });
    return;
  }

  const [actor] = await db
    .select()
    .from(users)
    .where(eq(users.id, jwtUser.id))
    .limit(1);
  if (!actor) {
    res.status(401).json({ message: "User not found" });
    return;
  }

  const body = req.body as PatchUserBody;
  const patch: { role?: string; userStatus?: string } = {};
  if (typeof body.role === "string") patch.role = body.role;
  if (typeof body.userStatus === "string") patch.userStatus = body.userStatus;

  const reasonRaw =
    typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reasonRaw) {
    res.status(400).json({ message: "Reason is required" });
    return;
  }
  if (reasonRaw.length > REASON_MAX_LEN) {
    res.status(400).json({ message: "Reason is too long" });
    return;
  }

  const actionRaw = body.action;
  if (
    actionRaw !== MEMBER_AUDIT_ACTION_EDIT &&
    actionRaw !== MEMBER_AUDIT_ACTION_SUSPEND
  ) {
    res.status(400).json({
      message: `action must be "${MEMBER_AUDIT_ACTION_EDIT}" or "${MEMBER_AUDIT_ACTION_SUSPEND}"`,
    });
    return;
  }

  const result = await updateMemberUser(
    userId.trim(),
    patch,
    jwtUser.id,
    String(actor.role ?? "").trim(),
    { reason: reasonRaw, action: actionRaw },
  );

  if (!result.ok) {
    res.status(result.status).json({ message: result.message });
    return;
  }

  res.status(200).json({
    message: "Member updated",
    user: result.user,
  });
}

export async function getMemberAuditLogs(req: Request, res: Response): Promise<void> {
  const jwtUser = getJwtUser(req);
  if (!jwtUser?.id) {
    res.status(401).json({ message: "Authorization required" });
    return;
  }

  const targetUserId = req.params.userId;
  if (typeof targetUserId !== "string" || !targetUserId.trim()) {
    res.status(400).json({ message: "User id required" });
    return;
  }

  const [actor] = await db
    .select()
    .from(users)
    .where(eq(users.id, jwtUser.id))
    .limit(1);
  if (!actor) {
    res.status(401).json({ message: "User not found" });
    return;
  }

  const result = await listMemberAdminAuditLogsForTarget(
    targetUserId.trim(),
    jwtUser.id,
    actorRoleForMemberAdmin(actor, jwtUser),
    actor.organizationId ?? null,
  );

  if (!result.ok) {
    res.status(result.status).json({ message: result.message });
    return;
  }

  res.status(200).json({ logs: result.logs });
}

/** After members CSV export from the UI, same audit inbox as contacts export. */
export async function postMembersExportNotify(
  req: Request,
  res: Response,
): Promise<void> {
  const jwtUser = getJwtUser(req);
  if (!jwtUser?.id) {
    res.status(401).json({ message: "Authorization required" });
    return;
  }

  const [actor] = await db
    .select()
    .from(users)
    .where(eq(users.id, jwtUser.id))
    .limit(1);
  if (!actor) {
    res.status(401).json({ message: "User not found" });
    return;
  }

  const role = actorRoleForMemberAdmin(actor, jwtUser);
  if (!isPlatformAdminRole(role) && !isCompanyAdminRole(role)) {
    res.status(403).json({ message: "Not allowed" });
    return;
  }

  const b = req.body as Record<string, unknown>;
  const rowCountRaw = b.rowCount;
  const rowCount =
    typeof rowCountRaw === "number" && Number.isFinite(rowCountRaw)
      ? Math.max(0, Math.floor(rowCountRaw))
      : typeof rowCountRaw === "string" && /^\d+$/.test(rowCountRaw.trim())
        ? Math.max(0, parseInt(rowCountRaw.trim(), 10))
        : null;

  if (rowCount === null || rowCount < 1) {
    res.status(400).json({ message: "rowCount must be a positive integer" });
    return;
  }

  const exportedLines = sanitizeExportedLinesForNotify(
    b.exportedMemberLines ?? b.exportedLines,
  );

  try {
    const audit = await getUserContactsExportAuditFields(jwtUser.id);
    const exporterEmail =
      audit.email || bodyString(jwtUser.email).trim();
    const exporterLabel =
      audit.displayName.trim() || exporterEmail || jwtUser.id;

    const result = await sendWorkspaceExportAuditNotification("members", {
      exporterDisplayName: exporterLabel,
      exporterEmail,
      exporterOrgName: audit.orgName || "—",
      rowCount,
      exportedSampleLines: exportedLines,
    });

    if (result.status === "sent") {
      res.status(200).json({ notified: true });
      return;
    }
    if (result.status === "skipped_no_recipient") {
      res.status(200).json({
        notified: false,
        message:
          "SENDER_Update_EMAIL_ID (or CONTACTS_EXPORT_NOTIFY_EMAIL) is not set; no notification was sent.",
      });
      return;
    }
    res.status(200).json({
      notified: false,
      message: "Export notification email could not be sent. Check email configuration.",
    });
  } catch (err) {
    console.error("postMembersExportNotify:", err);
    res.status(200).json({
      notified: false,
      message: "Export notification email could not be sent.",
    });
  }
}
