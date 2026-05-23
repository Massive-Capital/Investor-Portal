import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { eq } from "drizzle-orm";
import type { DealInvestorEsignDocumentRef } from "../../constants/deal-investor-esign-status.js";
import { getUploadsPhysicalRoot } from "../../config/uploadPaths.js";
import { db } from "../../database/db.js";
import { addDealForm } from "../../schema/deal.schema/add-deal-form.schema.js";
import {
  appendW9ToPdfBuffer,
  isPdfFileName,
  isPdfUploadFile,
} from "./esignPdfMerge.service.js";
import {
  buildStoredAssetName,
  type DealMemoryUploadFile,
} from "./dealForm.service.js";

const UPLOAD_SUBDIR = "deal-assets";
const ESIGN_FOLDER = "e-signed";

/** Dropbox Sign template lifecycle stored alongside the uploaded file metadata. */
export type DropboxSignTemplateStatus = "none" | "draft" | "ready";

export type EsignTemplateFileRecord = {
  id: string;
  categoryId: string;
  relativePath: string;
  originalName: string;
  uploadedAt: string;
  /** Sponsor-defined display name for this template. */
  templateName?: string;
  /** When true, embedded draft includes standard investor questionnaire fields. */
  includeQuestionnaire?: boolean;
  /** True when the stored PDF includes the appendix W-9 form. */
  includesW9Appendix?: boolean;
  /** Dropbox Sign template id after embedded draft is created or saved. */
  dropboxSignTemplateId?: string;
  dropboxSignStatus?: DropboxSignTemplateStatus;
  dropboxSignTitle?: string;
  dropboxSignSavedAt?: string;
};

export type EsignTemplateUploadMeta = {
  templateName?: string;
  includeQuestionnaire?: boolean;
};

export type EsignTemplatesJson = {
  v: 1;
  files: EsignTemplateFileRecord[];
};

function safeDealFolderSegment(rawDealId: string): string {
  const t = rawDealId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
  return t || "deal";
}

function safeCategorySegment(raw: string): string {
  const t = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return t || "general";
}

export function parseEsignTemplatesJson(
  raw: string | null | undefined,
): EsignTemplatesJson {
  if (!raw?.trim()) return { v: 1, files: [] };
  try {
    const parsed = JSON.parse(raw) as {
      v?: number;
      files?: EsignTemplateFileRecord[];
    };
    const files = Array.isArray(parsed.files)
      ? parsed.files.filter(
          (f) =>
            f &&
            typeof f.id === "string" &&
            typeof f.categoryId === "string" &&
            typeof f.relativePath === "string",
        )
      : [];
    return { v: 1, files };
  } catch {
    return { v: 1, files: [] };
  }
}

export async function getDealEsignTemplatesState(
  dealId: string,
): Promise<EsignTemplatesJson> {
  const [row] = await db
    .select({ esignTemplatesJson: addDealForm.esignTemplatesJson })
    .from(addDealForm)
    .where(eq(addDealForm.id, dealId))
    .limit(1);
  return parseEsignTemplatesJson(row?.esignTemplatesJson);
}

export function dealHasEsignTemplateDocuments(state: EsignTemplatesJson): boolean {
  return state.files.length > 0;
}

export function isPdfEsignFile(record: EsignTemplateFileRecord): boolean {
  return (
    isPdfFileName(record.originalName) ||
    isPdfFileName(record.relativePath)
  );
}

export function resolveEsignTemplateAbsolutePath(relativePath: string): string {
  const rel = relativePath.replace(/^\/+/, "").replace(/^uploads\//i, "");
  return path.join(getUploadsPhysicalRoot(), rel);
}

export function findEsignTemplateFile(
  state: EsignTemplatesJson,
  fileId: string,
): EsignTemplateFileRecord | undefined {
  return state.files.find((f) => f.id === fileId);
}

/** Attach profile category ids from deal templates when missing on stored status. */
export async function enrichEsignDocumentsWithCategories(
  dealId: string,
  documents: Array<{
    fileId: string;
    name: string;
    categoryId?: string;
    templateRelativePath?: string;
    signedRelativePath?: string;
  }>,
): Promise<DealInvestorEsignDocumentRef[]> {
  const state = await getDealEsignTemplatesState(dealId);
  return documents.map((d) => {
    const template = findEsignTemplateFile(state, d.fileId);
    const categoryId =
      d.categoryId?.trim() || template?.categoryId?.trim() || undefined;
    const templateRelativePath =
      d.templateRelativePath?.trim() ||
      template?.relativePath?.trim() ||
      undefined;
    return {
      fileId: d.fileId,
      name: d.name,
      ...(categoryId ? { categoryId } : {}),
      ...(templateRelativePath ? { templateRelativePath } : {}),
      ...(d.signedRelativePath ? { signedRelativePath: d.signedRelativePath } : {}),
    };
  });
}

/**
 * Ensures the on-disk PDF includes the appendix W-9 when missing. Updates metadata when merged.
 */
export async function ensureEsignTemplatePdfIncludesW9(
  dealId: string,
  file: EsignTemplateFileRecord,
  state?: EsignTemplatesJson,
): Promise<{ file: EsignTemplateFileRecord; absolutePath: string }> {
  const absPath = resolveEsignTemplateAbsolutePath(file.relativePath);
  if (!isPdfEsignFile(file) || file.includesW9Appendix) {
    return { file, absolutePath: absPath };
  }

  const currentState = state ?? (await getDealEsignTemplatesState(dealId));
  const fileBuffer = await readFile(absPath);
  const merged = await appendW9ToPdfBuffer(fileBuffer);
  if (merged.w9Appended) {
    await writeFile(absPath, merged.buffer);
    file.includesW9Appendix = true;
    await persistEsignTemplatesJson(dealId, currentState);
  }
  return { file, absolutePath: absPath };
}

async function persistEsignTemplatesJson(
  dealId: string,
  state: EsignTemplatesJson,
): Promise<void> {
  await db
    .update(addDealForm)
    .set({ esignTemplatesJson: JSON.stringify(state) })
    .where(eq(addDealForm.id, dealId));
}

export function parseEsignTemplateUploadMeta(
  raw: unknown,
  fileCount: number,
): EsignTemplateUploadMeta[] {
  if (!raw) return Array.from({ length: fileCount }, () => ({}));
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      return Array.from({ length: fileCount }, () => ({}));
    }
  }
  if (!Array.isArray(parsed)) return Array.from({ length: fileCount }, () => ({}));
  return Array.from({ length: fileCount }, (_, i) => {
    const item = parsed[i];
    if (!item || typeof item !== "object" || Array.isArray(item)) return {};
    const o = item as Record<string, unknown>;
    const templateName = String(o.templateName ?? o.template_name ?? "").trim();
    const q = o.includeQuestionnaire ?? o.include_questionnaire;
    const includeQuestionnaire =
      q === true ||
      q === "true" ||
      q === "1" ||
      q === 1;
    return {
      templateName: templateName || undefined,
      includeQuestionnaire: includeQuestionnaire || undefined,
    };
  });
}

export async function saveDealEsignTemplateFiles(params: {
  dealId: string;
  categoryId: string;
  files: DealMemoryUploadFile[];
  meta?: EsignTemplateUploadMeta[];
}): Promise<EsignTemplateFileRecord[]> {
  if (!params.files.length) return [];
  const dealFolder = safeDealFolderSegment(params.dealId);
  const categoryFolder = safeCategorySegment(params.categoryId);
  const uploadRoot = path.join(
    getUploadsPhysicalRoot(),
    UPLOAD_SUBDIR,
    dealFolder,
    ESIGN_FOLDER,
    categoryFolder,
  );
  await mkdir(uploadRoot, { recursive: true });

  const added: EsignTemplateFileRecord[] = [];
  const ts = Date.now();
  for (let i = 0; i < params.files.length; i += 1) {
    const file = params.files[i]!;
    const storedName = buildStoredAssetName(
      file.originalname,
      ts + i,
      randomUUID(),
    );
    const abs = path.join(uploadRoot, storedName);
    let bytes = file.buffer;
    let includesW9Appendix = false;
    if (isPdfUploadFile(file)) {
      const merged = await appendW9ToPdfBuffer(bytes);
      bytes = merged.buffer;
      includesW9Appendix = merged.w9Appended;
    }
    await writeFile(abs, bytes);
    const relativePath = `${UPLOAD_SUBDIR}/${dealFolder}/${ESIGN_FOLDER}/${categoryFolder}/${storedName}`;
    const uploadMeta = params.meta?.[i] ?? {};
    const templateName =
      uploadMeta.templateName?.trim() ||
      (file.originalname.trim() || storedName).replace(/\.[^.]+$/i, "").trim();
    added.push({
      id: randomUUID(),
      categoryId: params.categoryId,
      relativePath,
      originalName: file.originalname.trim() || storedName,
      uploadedAt: new Date().toISOString(),
      templateName: templateName || undefined,
      includeQuestionnaire: Boolean(uploadMeta.includeQuestionnaire),
      includesW9Appendix: includesW9Appendix || undefined,
      dropboxSignTitle: templateName || undefined,
    });
  }

  const state = await getDealEsignTemplatesState(params.dealId);
  state.files.push(...added);
  await persistEsignTemplatesJson(params.dealId, state);
  return added;
}

export async function removeDealEsignTemplateFile(
  dealId: string,
  fileId: string,
): Promise<boolean> {
  const state = await getDealEsignTemplatesState(dealId);
  const before = state.files.length;
  state.files = state.files.filter((f) => f.id !== fileId);
  if (state.files.length === before) return false;
  await persistEsignTemplatesJson(dealId, state);
  return true;
}

export function groupEsignFilesByCategory(
  state: EsignTemplatesJson,
): Record<string, EsignTemplateFileRecord[]> {
  const out: Record<string, EsignTemplateFileRecord[]> = {};
  for (const f of state.files) {
    if (!out[f.categoryId]) out[f.categoryId] = [];
    out[f.categoryId]!.push(f);
  }
  return out;
}

export function parseSendEsignFileIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") continue;
    const id = x.trim();
    if (!id) continue;
    out.push(id);
    if (out.length >= 50) break;
  }
  return out;
}

export function resolveEsignFilesByIds(
  state: EsignTemplatesJson,
  fileIds: string[],
): EsignTemplateFileRecord[] {
  if (fileIds.length === 0) return [];
  const wanted = new Set(fileIds);
  return state.files.filter((f) => wanted.has(f.id));
}
