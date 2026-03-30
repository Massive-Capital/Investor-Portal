import type { Request, Response } from "express";
// import { isPlatformAdminRole } from "../constants/roles.js";
import {
  COMPANY_AUDIT_ACTION_EDIT,
  COMPANY_AUDIT_ACTION_SUSPEND,
  createCompany,
  listCompanies,
  updateCompany,
  type CompanyAuditAction,
} from "../../services/company.service.js";
// } from "../services/company.service.js";
import { getJwtUser } from "../../middleware/jwtUser.js";
import { isPlatformAdminRole } from "../../constants/roles.js";

export async function getCompanies(req: Request, res: Response): Promise<void> {
  const user = getJwtUser(req);
  if (!user?.id) {
    res.status(401).json({ message: "Authorization required" });
    return;
  }
  try {
    const rows = await listCompanies();
    res.status(200).json({ companies: rows });
  } catch (err) {
    console.error("getCompanies:", err);
    res.status(500).json({ message: "Could not load companies" });
  }
}

type CreateCompanyBody = {
  name?: unknown;
};

export async function postCompany(req: Request, res: Response): Promise<void> {
  const user = getJwtUser(req);
  if (!user?.id) {
    res.status(401).json({ message: "Authorization required" });
    return;
  }
  if (!isPlatformAdminRole(user.userRole)) {
    res.status(403).json({
      message: "Only platform administrators can create companies",
    });
    return;
  }

  const body = req.body as CreateCompanyBody;
  const name = typeof body.name === "string" ? body.name : "";

  const result = await createCompany(name);
  if (!result.ok) {
    res.status(result.status).json({ message: result.message });
    return;
  }

  res.status(201).json({
    message: "Company created",
    company: result.company,
  });
}

type PatchCompanyBody = {
  name?: unknown;
  status?: unknown;
  reason?: unknown;
  action?: unknown;
};

export async function patchCompany(req: Request, res: Response): Promise<void> {
  const user = getJwtUser(req);
  if (!user?.id) {
    res.status(401).json({ message: "Authorization required" });
    return;
  }
  if (!isPlatformAdminRole(user.userRole)) {
    res.status(403).json({
      message: "Only platform administrators can update companies",
    });
    return;
  }

  const companyId = req.params.companyId;
  if (typeof companyId !== "string" || !companyId.trim()) {
    res.status(400).json({ message: "Company id required" });
    return;
  }

  const body = req.body as PatchCompanyBody;
  const patch: { name?: string; status?: string } = {};
  if (typeof body.name === "string") patch.name = body.name;
  if (typeof body.status === "string") patch.status = body.status;

  if (patch.name === undefined && patch.status === undefined) {
    res.status(400).json({ message: "No changes" });
    return;
  }

  const reason =
    typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason) {
    res.status(400).json({ message: "A reason is required for this change" });
    return;
  }

  const actionRaw =
    typeof body.action === "string" ? body.action.trim() : "";
  if (
    actionRaw !== COMPANY_AUDIT_ACTION_EDIT &&
    actionRaw !== COMPANY_AUDIT_ACTION_SUSPEND
  ) {
    res.status(400).json({
      message: `action must be "${COMPANY_AUDIT_ACTION_EDIT}" or "${COMPANY_AUDIT_ACTION_SUSPEND}"`,
    });
    return;
  }

  const result = await updateCompany(companyId.trim(), patch, {
    actorUserId: user.id,
    reason,
    action: actionRaw as CompanyAuditAction,
  });
  if (!result.ok) {
    res.status(result.status).json({ message: result.message });
    return;
  }

  res.status(200).json({
    message: "Company updated",
    company: result.company,
  });
}
