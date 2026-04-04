import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { getUploadsPhysicalRoot } from "../config/uploadPaths.js";
import { db } from "../database/db.js";
import {
  addDealForm,
  type AddDealFormInsert,
  type AddDealFormRow,
} from "../schema/deal.schema/add-deal-form.schema.js";
import { companies } from "../schema/schema.js";

const UPLOAD_SUBDIR = "deal-assets";

export type DealFormFieldErrors = Partial<
  Record<
    | "deal_name"
    | "deal_stage"
    | "sec_type"
    | "owning_entity_name"
    | "property_name"
    | "funds_required_before_gp_sign"
    | "auto_send_funding_instructions",
    string
  >
>;

export type CreateDealFormInput = {
  dealName: string;
  dealType: string;
  dealStage: string;
  secType: string;
  closeDate: string | null;
  owningEntityName: string;
  fundsRequiredBeforeGpSign: boolean | undefined;
  autoSendFundingInstructions: boolean | undefined;
  propertyName: string;
  country: string;
  city: string;
};

function validateCreateInput(
  input: CreateDealFormInput,
): DealFormFieldErrors | null {
  const errors: DealFormFieldErrors = {};
  if (!input.dealName.trim()) errors.deal_name = "Deal name is required.";
  if (!input.dealStage.trim())
    errors.deal_stage = "Deal stage is required.";
  if (!input.secType.trim()) errors.sec_type = "SEC type is required.";
  if (!input.owningEntityName.trim())
    errors.owning_entity_name = "Owning entity name is required.";
  if (!input.propertyName.trim())
    errors.property_name = "Property name is required.";
  if (typeof input.fundsRequiredBeforeGpSign !== "boolean") {
    errors.funds_required_before_gp_sign =
      "Funds required before GP sign must be yes or no.";
  }
  if (typeof input.autoSendFundingInstructions !== "boolean") {
    errors.auto_send_funding_instructions =
      "Auto send funding instructions must be yes or no.";
  }
  return Object.keys(errors).length ? errors : null;
}

const MAX_ORIGINAL_STEM_LEN = 80;

/** Safe stem from uploaded filename (no path, no extension). */
function sanitizeOriginalStem(originalName: string): string {
  const base = path.basename(originalName || "file");
  const stem = path.basename(base, path.extname(base));
  const cleaned = stem
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_ORIGINAL_STEM_LEN);
  return cleaned.length ? cleaned : "file";
}

function safeExtension(originalName: string): string {
  const ext = path.extname(path.basename(originalName || "")).toLowerCase();
  if (!ext || !/^\.[a-z0-9]{1,12}$/.test(ext)) return "";
  return ext;
}

/**
 * Stored filename: sanitized original name + UUID + Unix ms time + extension.
 * Example: `property-front_7c9e2b1a-...._1738123456789.jpg`
 */
export function buildStoredAssetName(
  originalName: string,
  timestampMs: number,
  fileId: string,
): string {
  const stem = sanitizeOriginalStem(originalName);
  const ext = safeExtension(originalName);
  return `${stem}_${fileId}_${timestampMs}${ext}`;
}

/** Memory-upload file shape from `multer.memoryStorage()` (no dependency on @types/multer). */
export interface DealMemoryUploadFile {
  buffer: Buffer;
  originalname: string;
}

export async function saveDealAssetFiles(params: {
  files: DealMemoryUploadFile[];
}): Promise<string[]> {
  if (!params.files.length) return [];
  const uploadRoot = path.join(getUploadsPhysicalRoot(), UPLOAD_SUBDIR);
  await mkdir(uploadRoot, { recursive: true });
  const relativePaths: string[] = [];
  const ts = Date.now();
  for (let i = 0; i < params.files.length; i += 1) {
    const file = params.files[i]!;
    const name = buildStoredAssetName(
      file.originalname,
      ts + i,
      randomUUID(),
    );
    const abs = path.join(uploadRoot, name);
    await writeFile(abs, file.buffer);
    relativePaths.push(`${UPLOAD_SUBDIR}/${name}`);
  }
  return relativePaths;
}

export async function insertAddDealForm(
  input: CreateDealFormInput,
  assetRelativePaths: string[],
  organizationId?: string | null,
): Promise<AddDealFormRow> {
  const validationErrors = validateCreateInput(input);
  if (validationErrors) {
    const err = new Error("VALIDATION") as Error & {
      fieldErrors: DealFormFieldErrors;
    };
    err.fieldErrors = validationErrors;
    throw err;
  }

  const row: AddDealFormInsert = {
    organizationId: organizationId ?? null,
    dealName: input.dealName.trim(),
    dealType: input.dealType.trim(),
    dealStage: input.dealStage.trim(),
    secType: input.secType.trim(),
    closeDate: input.closeDate?.trim() || null,
    owningEntityName: input.owningEntityName.trim(),
    fundsRequiredBeforeGpSign: input.fundsRequiredBeforeGpSign!,
    autoSendFundingInstructions: input.autoSendFundingInstructions!,
    propertyName: input.propertyName.trim(),
    country: input.country.trim(),
    city: input.city.trim(),
    assetImagePath: assetRelativePaths.length
      ? assetRelativePaths.join(";")
      : null,
  };

  const [created] = await db.insert(addDealForm).values(row).returning();
  if (!created) throw new Error("Insert failed");
  return created;
}

export async function listAddDealForms(): Promise<AddDealFormRow[]> {
  return db.select().from(addDealForm).orderBy(desc(addDealForm.createdAt));
}

/**
 * Who may list deals: `seesAllDeals` → every row; else → deals for the viewer’s
 * company (`organization_id` + legacy owning-entity name — `listAddDealFormsByOrganizationId`).
 */
export type DealViewerScope = {
  organizationId: string | null;
  isPlatformAdmin: boolean;
  /** Syndication list/detail: all deals (platform admin, or platform_user with no org). */
  seesAllDeals: boolean;
};

export async function listAddDealFormsForViewer(
  scope: DealViewerScope,
): Promise<AddDealFormRow[]> {
  if (scope.seesAllDeals) {
    return db.select().from(addDealForm).orderBy(desc(addDealForm.createdAt));
  }
  if (!scope.organizationId) {
    return [];
  }
  return listAddDealFormsByOrganizationId(scope.organizationId);
}

export async function listAddDealFormsByOrganizationId(
  organizationId: string,
): Promise<AddDealFormRow[]> {
  const [company] = await db
    .select({ name: companies.name })
    .from(companies)
    .where(eq(companies.id, organizationId))
    .limit(1);
  const nameKey = company?.name?.trim().toLowerCase() ?? "";

  if (!nameKey) {
    return db
      .select()
      .from(addDealForm)
      .where(eq(addDealForm.organizationId, organizationId))
      .orderBy(desc(addDealForm.createdAt));
  }

  return db
    .select()
    .from(addDealForm)
    .where(
      or(
        eq(addDealForm.organizationId, organizationId),
        and(
          isNull(addDealForm.organizationId),
          sql`lower(trim(${addDealForm.owningEntityName})) = ${nameKey}`,
        ),
      ),
    )
    .orderBy(desc(addDealForm.createdAt));
}

/** True if the deal row is visible under that company (FK or legacy name match). */
export async function isAddDealFormInOrganizationScope(
  row: AddDealFormRow,
  organizationId: string,
): Promise<boolean> {
  if (row.organizationId === organizationId) return true;
  if (row.organizationId != null) return false;
  const [company] = await db
    .select({ name: companies.name })
    .from(companies)
    .where(eq(companies.id, organizationId))
    .limit(1);
  const cn = company?.name?.trim().toLowerCase() ?? "";
  if (!cn) return false;
  const on = row.owningEntityName?.trim().toLowerCase() ?? "";
  return on === cn;
}

export async function getAddDealFormById(
  id: string,
): Promise<AddDealFormRow | undefined> {
  const rows = await db
    .select()
    .from(addDealForm)
    .where(eq(addDealForm.id, id))
    .limit(1);
  return rows[0];
}

export async function updateAddDealFormById(
  id: string,
  input: CreateDealFormInput,
  newAssetRelativePaths: string[],
  options?: { organizationId?: string | null },
): Promise<AddDealFormRow | undefined> {
  const existing = await getAddDealFormById(id);
  if (!existing) return undefined;

  const validationErrors = validateCreateInput(input);
  if (validationErrors) {
    const err = new Error("VALIDATION") as Error & {
      fieldErrors: DealFormFieldErrors;
    };
    err.fieldErrors = validationErrors;
    throw err;
  }

  const prevPaths = existing.assetImagePath?.split(";").filter(Boolean) ?? [];
  const mergedPaths = [...prevPaths, ...newAssetRelativePaths];
  const assetImagePath =
    mergedPaths.length > 0 ? mergedPaths.join(";") : existing.assetImagePath;

  const backfillOrg =
    !existing.organizationId && options?.organizationId
      ? { organizationId: options.organizationId }
      : {};

  const [updated] = await db
    .update(addDealForm)
    .set({
      ...backfillOrg,
      dealName: input.dealName.trim(),
      dealType: input.dealType.trim(),
      dealStage: input.dealStage.trim(),
      secType: input.secType.trim(),
      closeDate: input.closeDate?.trim() || null,
      owningEntityName: input.owningEntityName.trim(),
      fundsRequiredBeforeGpSign: input.fundsRequiredBeforeGpSign!,
      autoSendFundingInstructions: input.autoSendFundingInstructions!,
      propertyName: input.propertyName.trim(),
      country: input.country.trim(),
      city: input.city.trim(),
      assetImagePath,
    })
    .where(eq(addDealForm.id, id))
    .returning();

  return updated;
}
