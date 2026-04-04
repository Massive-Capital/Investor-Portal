import type { Request, Response } from "express";
import { getJwtUser } from "../../middleware/jwtUser.js";
import {
  getWorkspaceTabPayload,
  isWorkspaceTabKey,
  upsertWorkspaceTabPayload,
  userCanAccessCompanyWorkspace,
  userCanEditCompanyWorkspace,
} from "../../services/companyWorkspaceSettings.service.js";

function paramStr(v: string | string[] | undefined): string {
  if (v == null) return "";
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === "string" ? s.trim() : "";
}

export async function getWorkspaceTabSettings(
  req: Request,
  res: Response,
): Promise<void> {
  const user = getJwtUser(req);
  if (!user?.id) {
    res.status(401).json({ message: "Authorization required" });
    return;
  }
  const companyId = paramStr(req.params.companyId);
  const tabKeyRaw = paramStr(req.params.tabKey);
  if (!companyId || !tabKeyRaw || !isWorkspaceTabKey(tabKeyRaw)) {
    res.status(400).json({ message: "Invalid company or workspace tab" });
    return;
  }
  const can = await userCanAccessCompanyWorkspace(
    user.id,
    user.userRole,
    companyId,
  );
  if (!can) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }
  const payload = await getWorkspaceTabPayload(companyId, tabKeyRaw);
  res.status(200).json({ payload });
}

export async function putWorkspaceTabSettings(
  req: Request,
  res: Response,
): Promise<void> {
  const user = getJwtUser(req);
  if (!user?.id) {
    res.status(401).json({ message: "Authorization required" });
    return;
  }
  const companyId = paramStr(req.params.companyId);
  const tabKeyRaw = paramStr(req.params.tabKey);
  if (!companyId || !tabKeyRaw || !isWorkspaceTabKey(tabKeyRaw)) {
    res.status(400).json({ message: "Invalid company or workspace tab" });
    return;
  }
  const can = await userCanEditCompanyWorkspace(
    user.id,
    user.userRole,
    companyId,
  );
  if (!can) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }
  const b = req.body as unknown;
  let payload: Record<string, unknown> = {};
  if (b != null && typeof b === "object" && !Array.isArray(b)) {
    const o = b as Record<string, unknown>;
    const inner = o.payload;
    if (
      inner != null &&
      typeof inner === "object" &&
      !Array.isArray(inner)
    ) {
      payload = { ...(inner as Record<string, unknown>) };
    } else {
      payload = { ...o };
    }
  }
  try {
    await upsertWorkspaceTabPayload(companyId, tabKeyRaw, payload);
  } catch (err) {
    console.error("putWorkspaceTabSettings:", err);
    res.status(500).json({ message: "Could not save workspace settings" });
    return;
  }
  res.status(200).json({ ok: true });
}
