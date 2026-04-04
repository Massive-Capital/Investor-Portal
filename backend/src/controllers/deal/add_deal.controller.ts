import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { getJwtUser } from "../../middleware/jwtUser.js";
import { db } from "../../database/db.js";
import { users } from "../../schema/schema.js";
import { isPlatformAdminRole } from "../../constants/roles.js";
import type { AddDealFormRow } from "../../schema/deal.schema/add-deal-form.schema.js";
import {
  getAddDealFormForViewer,
  resolveDealViewerScope,
} from "../../services/dealAccess.service.js";
import {
  insertAddDealForm,
  listAddDealFormsByOrganizationId,
  listAddDealFormsForViewer,
  saveDealAssetFiles,
  updateAddDealFormById,
  type CreateDealFormInput,
  type DealFormFieldErrors,
  type DealMemoryUploadFile,
} from "../../services/dealForm.service.js";
import { formatDdMmmYyyy } from "../../utils/formatDdMmmYyyy.js";
import { countInvestmentsByDealIds } from "../../services/dealInvestment.service.js";

function parseBoolField(
  v: unknown,
): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (v === undefined || v === null || v === "") return undefined;
  const s = String(v).toLowerCase().trim();
  if (s === "true" || s === "yes" || s === "1") return true;
  if (s === "false" || s === "no" || s === "0") return false;
  return undefined;
}

function bodyString(v: unknown): string {
  return typeof v === "string" ? v : v != null ? String(v) : "";
}

/** Platform admin may set customer company on a deal via multipart field. */
function organizationIdFromBody(b: Record<string, unknown>): string | null {
  const raw = bodyString(b.organization_id ?? b.organizationId).trim();
  return DEALS_ORG_UUID_RE.test(raw) ? raw : null;
}

function mapRowToJson(
  row: AddDealFormRow,
  opts?: { investmentRowCount?: number },
) {
  const investorsDisplay =
    opts?.investmentRowCount !== undefined
      ? String(Math.max(0, Math.floor(opts.investmentRowCount)))
      : "—";
  return {
    id: row.id,
    dealName: row.dealName,
    dealType: row.dealType,
    dealStage: row.dealStage,
    secType: row.secType,
    closeDate: row.closeDate ?? null,
    owningEntityName: row.owningEntityName,
    fundsRequiredBeforeGpSign: row.fundsRequiredBeforeGpSign,
    autoSendFundingInstructions: row.autoSendFundingInstructions,
    propertyName: row.propertyName,
    country: row.country,
    city: row.city,
    assetImagePath: row.assetImagePath ?? null,
    createdAt: row.createdAt?.toISOString?.() ?? String(row.createdAt),
    listRow: {
      id: row.id,
      dealName: row.dealName,
      dealType: row.dealType,
      dealStage: row.dealStage,
      totalInProgress: "—",
      totalAccepted: "—",
      raiseTarget: "—",
      distributions: "—",
      investors: investorsDisplay,
      closeDateDisplay: row.closeDate
        ? formatDdMmmYyyy(String(row.closeDate).slice(0, 10))
        : "—",
      createdDateDisplay: formatDdMmmYyyy(row.createdAt),
      createdAt:
        row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : String(row.createdAt),
      locationDisplay:
        [row.city, row.country].filter((x) => x?.trim()).join(", ") || "—",
      assetImagePath: row.assetImagePath ?? null,
    },
  };
}

const DEALS_ORG_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function mapRowToJsonWithInvestmentCount(row: AddDealFormRow) {
  const id = String(row.id);
  const counts = await countInvestmentsByDealIds([id]);
  return mapRowToJson(row, {
    investmentRowCount: counts.get(id) ?? 0,
  });
}

export async function getDeals(req: Request, res: Response): Promise<void> {
  const user = getJwtUser(req);
  if (!user?.id) {
    res.status(401).json({ message: "Authorization required" });
    return;
  }
  try {
    const orgQ = req.query.organizationId;
    const orgParam =
      typeof orgQ === "string"
        ? orgQ.trim()
        : Array.isArray(orgQ)
          ? String(orgQ[0] ?? "").trim()
          : "";

    const scope = await resolveDealViewerScope(user.id, user.userRole);

    let rows: AddDealFormRow[];

    if (orgParam && DEALS_ORG_UUID_RE.test(orgParam)) {
      if (!scope.isPlatformAdmin) {
        res.status(403).json({ message: "Not allowed" });
        return;
      }
      rows = await listAddDealFormsByOrganizationId(orgParam);
    } else {
      rows = await listAddDealFormsForViewer(scope);
    }

    const dealIds = rows.map((r) => String(r.id ?? ""));
    const investmentCounts =
      dealIds.length > 0 ? await countInvestmentsByDealIds(dealIds) : new Map();

    res.status(200).json({
      deals: rows.map((r: AddDealFormRow) =>
        mapRowToJson(r, {
          investmentRowCount: investmentCounts.get(String(r.id)) ?? 0,
        }).listRow,
      ),
    });
  } catch (err) {
    console.error("getDeals:", err);
    res.status(500).json({ message: "Could not load deals" });
  }
}

export async function getDealById(req: Request, res: Response): Promise<void> {
  const user = getJwtUser(req);
  if (!user?.id) {
    res.status(401).json({ message: "Authorization required" });
    return;
  }
  const rawId = req.params.dealId;
  const dealId = typeof rawId === "string" ? rawId : rawId?.[0];
  if (!dealId) {
    res.status(400).json({ message: "Missing deal id" });
    return;
  }
  try {
    const scope = await resolveDealViewerScope(user.id, user.userRole);
    const row = await getAddDealFormForViewer(dealId, scope);
    if (!row) {
      res.status(404).json({ message: "Deal not found" });
      return;
    }
    res.status(200).json({ deal: await mapRowToJsonWithInvestmentCount(row) });
  } catch (err) {
    console.error("getDealById:", err);
    res.status(500).json({ message: "Could not load deal" });
  }
}

export async function postDeal(req: Request, res: Response): Promise<void> {
  const user = getJwtUser(req);
  if (!user?.id) {
    res.status(401).json({ message: "Authorization required" });
    return;
  }

  const b = req.body as Record<string, unknown>;
  const funds = parseBoolField(b.funds_required_before_gp_sign);
  const auto = parseBoolField(b.auto_send_funding_instructions);

  const input: CreateDealFormInput = {
    dealName: bodyString(b.deal_name),
    dealType: bodyString(b.deal_type),
    dealStage: bodyString(b.deal_stage),
    secType: bodyString(b.sec_type),
    closeDate: bodyString(b.close_date) || null,
    owningEntityName: bodyString(b.owning_entity_name),
    fundsRequiredBeforeGpSign: funds,
    autoSendFundingInstructions: auto,
    propertyName: bodyString(b.property_name),
    country: bodyString(b.country),
    city: bodyString(b.city),
  };

  const files = (req as Request & { files?: DealMemoryUploadFile[] }).files;
  const fileList = Array.isArray(files) ? files : [];

  try {
    const [actor] = await db
      .select({ organizationId: users.organizationId, role: users.role })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    let organizationId = actor?.organizationId ?? null;
    if (actor && isPlatformAdminRole(actor.role)) {
      const fromBody = organizationIdFromBody(b);
      if (fromBody) organizationId = fromBody;
    }

    const assetPaths = await saveDealAssetFiles({ files: fileList });
    const created = await insertAddDealForm(input, assetPaths, organizationId);
    res.status(201).json({
      message: "Deal created",
      deal: mapRowToJson(created, { investmentRowCount: 0 }),
    });
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      err.message === "VALIDATION" &&
      "fieldErrors" in err
    ) {
      res.status(400).json({
        message: "Validation failed",
        errors: (err as Error & { fieldErrors: DealFormFieldErrors })
          .fieldErrors,
      });
      return;
    }
    console.error("postDeal:", err);
    res.status(500).json({ message: "Could not create deal" });
  }
}

export async function putDeal(req: Request, res: Response): Promise<void> {
  const user = getJwtUser(req);
  if (!user?.id) {
    res.status(401).json({ message: "Authorization required" });
    return;
  }

  const rawId = req.params.dealId;
  const dealId = typeof rawId === "string" ? rawId : rawId?.[0];
  if (!dealId) {
    res.status(400).json({ message: "Missing deal id" });
    return;
  }

  const b = req.body as Record<string, unknown>;
  const funds = parseBoolField(b.funds_required_before_gp_sign);
  const auto = parseBoolField(b.auto_send_funding_instructions);

  const input: CreateDealFormInput = {
    dealName: bodyString(b.deal_name),
    dealType: bodyString(b.deal_type),
    dealStage: bodyString(b.deal_stage),
    secType: bodyString(b.sec_type),
    closeDate: bodyString(b.close_date) || null,
    owningEntityName: bodyString(b.owning_entity_name),
    fundsRequiredBeforeGpSign: funds,
    autoSendFundingInstructions: auto,
    propertyName: bodyString(b.property_name),
    country: bodyString(b.country),
    city: bodyString(b.city),
  };

  const files = (req as Request & { files?: DealMemoryUploadFile[] }).files;
  const fileList = Array.isArray(files) ? files : [];

  try {
    const scope = await resolveDealViewerScope(user.id, user.userRole);
    const visible = await getAddDealFormForViewer(dealId, scope);
    if (!visible) {
      res.status(404).json({ message: "Deal not found" });
      return;
    }

    const [actor] = await db
      .select({ organizationId: users.organizationId, role: users.role })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    let organizationId = actor?.organizationId ?? null;
    if (actor && isPlatformAdminRole(actor.role)) {
      const fromBody = organizationIdFromBody(b);
      if (fromBody) organizationId = fromBody;
    }

    const assetPaths = await saveDealAssetFiles({ files: fileList });
    const updated = await updateAddDealFormById(dealId, input, assetPaths, {
      organizationId,
    });
    if (!updated) {
      res.status(404).json({ message: "Deal not found" });
      return;
    }
    res.status(200).json({
      message: "Deal updated",
      deal: await mapRowToJsonWithInvestmentCount(updated),
    });
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      err.message === "VALIDATION" &&
      "fieldErrors" in err
    ) {
      res.status(400).json({
        message: "Validation failed",
        errors: (err as Error & { fieldErrors: DealFormFieldErrors })
          .fieldErrors,
      });
      return;
    }
    console.error("putDeal:", err);
    res.status(500).json({ message: "Could not update deal" });
  }
}
