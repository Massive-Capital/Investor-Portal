import type { Request, Response } from "express";
import { getJwtUser } from "../../middleware/jwtUser.js";
import type { AddDealFormRow } from "../../schema/deal.schema/add-deal-form.schema.js";
import {
  getAddDealFormById,
  insertAddDealForm,
  listAddDealForms,
  saveDealAssetFiles,
  type CreateDealFormInput,
  type DealFormFieldErrors,
  type DealMemoryUploadFile,
} from "../../services/dealForm.service.js";

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

function mapRowToJson(row: AddDealFormRow) {
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
      investors: "—",
      closeDateDisplay: row.closeDate ? String(row.closeDate) : "—",
      createdDateDisplay: formatDisplayDate(row.createdAt),
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

function formatDisplayDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

export async function getDeals(req: Request, res: Response): Promise<void> {
  const user = getJwtUser(req);
  if (!user?.id) {
    res.status(401).json({ message: "Authorization required" });
    return;
  }
  try {
    const rows = await listAddDealForms();
    res.status(200).json({
      deals: rows.map((r: AddDealFormRow) => mapRowToJson(r).listRow),
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
    const row = await getAddDealFormById(dealId);
    if (!row) {
      res.status(404).json({ message: "Deal not found" });
      return;
    }
    res.status(200).json({ deal: mapRowToJson(row) });
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
    const assetPaths = await saveDealAssetFiles({ files: fileList });
    const created = await insertAddDealForm(input, assetPaths);
    res.status(201).json({
      message: "Deal created",
      deal: mapRowToJson(created),
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
