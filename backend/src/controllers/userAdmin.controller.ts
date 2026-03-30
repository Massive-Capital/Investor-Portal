import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { getJwtUser } from "../middleware/jwtUser.js";
import { db } from "../database/db.js";
import { users } from "../schema/schema.js";
import {
  isCompanyAdminRole,
  isPlatformAdminRole,
} from "../constants/roles.js";
import {
  listMemberAdminAuditLogsForTarget,
  listUsersForAdmin,
  MEMBER_AUDIT_ACTION_EDIT,
  MEMBER_AUDIT_ACTION_SUSPEND,
  updateMemberUser,
} from "../services/userAdmin.service.js";

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

  const role = String(actor.role ?? "").trim();
  if (!isPlatformAdminRole(role) && !isCompanyAdminRole(role)) {
    res.status(403).json({ message: "Not allowed to list members" });
    return;
  }

  const rows = await listUsersForAdmin(role, actor.organizationId ?? null);
  if (rows === null) {
    res.status(403).json({ message: "Not allowed to list members" });
    return;
  }

  res.status(200).json({ users: rows });
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
    String(actor.role ?? "").trim(),
    actor.organizationId ?? null,
  );

  if (!result.ok) {
    res.status(result.status).json({ message: result.message });
    return;
  }

  res.status(200).json({ logs: result.logs });
}
