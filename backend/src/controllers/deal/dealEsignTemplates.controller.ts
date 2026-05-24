import * as fs from "node:fs";
import type { Request, Response } from "express";
import { getJwtUser } from "../../middleware/jwtUser.js";
import {
  assertDealIdInViewerScope,
  resolveDealViewerScope,
} from "../../services/deal/dealAccess.service.js";
import type { DealMemoryUploadFile } from "../../services/deal/dealForm.service.js";
import { isPortalUserLeadSponsorOnDeal } from "../../services/deal/dealMemberScope.service.js";
import {
  dealHasEsignTemplateDocuments,
  ensureEsignTemplatePdfPrepared,
  findEsignTemplateFile,
  getDealEsignTemplatesState,
  groupEsignFilesByCategory,
  isPdfEsignFile,
  removeDealEsignTemplateFile,
  parseEsignTemplateUploadMeta,
  saveDealEsignTemplateFiles,
} from "../../services/deal/dealEsignTemplates.service.js";

function bodyString(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) {
    if (v.length === 0) return "";
    return bodyString(v[v.length - 1]);
  }
  if (v != null) return String(v);
  return "";
}

const ALLOWED_ESIGN_CATEGORIES = new Set([
  "individual",
  "custodian_ira_401k",
  "joint_tenancy",
  "llc",
]);

/**
 * GET /deals/:dealId/esign-templates
 */
export async function getDealEsignTemplates(
  req: Request,
  res: Response,
): Promise<void> {
  const user = getJwtUser(req);
  if (!user?.id) {
    res.status(401).json({ message: "Authorization required" });
    return;
  }
  const dealId =
    typeof req.params.dealId === "string"
      ? req.params.dealId
      : req.params.dealId?.[0];
  if (!dealId) {
    res.status(400).json({ message: "Missing deal id" });
    return;
  }
  try {
    const scope = await resolveDealViewerScope(user.id, user.userRole);
    if (!(await assertDealIdInViewerScope(dealId, scope))) {
      res.status(404).json({ message: "Deal not found" });
      return;
    }
    const state = await getDealEsignTemplatesState(dealId);
    res.status(200).json({
      hasDocuments: dealHasEsignTemplateDocuments(state),
      filesByCategory: groupEsignFilesByCategory(state),
    });
  } catch (err) {
    console.error("getDealEsignTemplates:", err);
    res.status(500).json({ message: "Could not load eSign templates" });
  }
}

function safeInlineFilename(raw: string): string {
  const base = raw.trim().replace(/[^\w.\- ()]+/g, "_").slice(0, 180);
  if (!base) return "esign-template.pdf";
  return base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
}

/**
 * GET /deals/:dealId/esign-templates/:fileId/view-url
 * Ensures W-9 is on disk when needed; returns a static /uploads URL for read-only preview.
 */
export async function getDealEsignTemplateViewUrl(
  req: Request,
  res: Response,
): Promise<void> {
  const user = getJwtUser(req);
  if (!user?.id) {
    res.status(401).json({ message: "Authorization required" });
    return;
  }
  const dealId =
    typeof req.params.dealId === "string"
      ? req.params.dealId
      : req.params.dealId?.[0];
  const fileId =
    typeof req.params.fileId === "string"
      ? req.params.fileId
      : req.params.fileId?.[0];
  if (!dealId || !fileId) {
    res.status(400).json({ message: "Missing deal id or file id" });
    return;
  }

  try {
    const scope = await resolveDealViewerScope(user.id, user.userRole);
    if (!(await assertDealIdInViewerScope(dealId, scope))) {
      res.status(404).json({ message: "Deal not found" });
      return;
    }

    const state = await getDealEsignTemplatesState(dealId);
    const file = findEsignTemplateFile(state, fileId);
    if (!file) {
      res.status(404).json({ message: "File not found" });
      return;
    }

    if (!isPdfEsignFile(file)) {
      const rel = file.relativePath?.replace(/^\/+/, "").replace(/^uploads\//i, "");
      res.status(200).json({
        viewUrl: rel ? `/uploads/${rel}` : "",
        displayName:
          file.templateName?.trim() || file.originalName?.trim() || "Document",
        isPdf: false,
      });
      return;
    }

    const { file: updated } = await ensureEsignTemplatePdfPrepared(
      dealId,
      file,
      state,
    );
    const rel = updated.relativePath
      ?.replace(/^\/+/, "")
      .replace(/^uploads\//i, "");
    if (!rel) {
      res.status(404).json({ message: "File not found on disk" });
      return;
    }

    res.status(200).json({
      viewUrl: `/uploads/${rel}`,
      displayName:
        updated.templateName?.trim() ||
        updated.originalName?.trim() ||
        "Document",
      isPdf: true,
      includesW9Appendix: Boolean(updated.includesW9Appendix),
    });
  } catch (err) {
    console.error("getDealEsignTemplateViewUrl:", err);
    res.status(500).json({ message: "Could not open eSign template preview" });
  }
}

/**
 * GET /deals/:dealId/esign-templates/:fileId/view
 * PDFs are served with W-9 appendix merged when missing (same as upload / Dropbox editor).
 */
export async function getDealEsignTemplateView(
  req: Request,
  res: Response,
): Promise<void> {
  const user = getJwtUser(req);
  if (!user?.id) {
    res.status(401).json({ message: "Authorization required" });
    return;
  }
  const dealId =
    typeof req.params.dealId === "string"
      ? req.params.dealId
      : req.params.dealId?.[0];
  const fileId =
    typeof req.params.fileId === "string"
      ? req.params.fileId
      : req.params.fileId?.[0];
  if (!dealId || !fileId) {
    res.status(400).json({ message: "Missing deal id or file id" });
    return;
  }

  try {
    const scope = await resolveDealViewerScope(user.id, user.userRole);
    if (!(await assertDealIdInViewerScope(dealId, scope))) {
      res.status(404).json({ message: "Deal not found" });
      return;
    }

    const state = await getDealEsignTemplatesState(dealId);
    const file = findEsignTemplateFile(state, fileId);
    if (!file) {
      res.status(404).json({ message: "File not found" });
      return;
    }

    if (!isPdfEsignFile(file)) {
      res.status(400).json({
        message: "W-9 preview is only merged for PDF eSign templates",
      });
      return;
    }

    const { absolutePath } = await ensureEsignTemplatePdfPrepared(
      dealId,
      file,
      state,
    );
    if (!fs.existsSync(absolutePath)) {
      res.status(404).json({ message: "File not found on disk" });
      return;
    }

    const displayName =
      file.templateName?.trim() ||
      file.originalName.trim() ||
      "esign-template";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${safeInlineFilename(displayName)}"`,
    );
    res.sendFile(absolutePath, (err) => {
      if (err && !res.headersSent) {
        console.error("getDealEsignTemplateView sendFile:", err);
        res.status(500).json({ message: "Could not open eSign template" });
      }
    });
  } catch (err) {
    console.error("getDealEsignTemplateView:", err);
    if (!res.headersSent) {
      res.status(500).json({ message: "Could not open eSign template" });
    }
  }
}

/**
 * POST /deals/:dealId/esign-template-uploads
 * multipart field `esignFiles`; body field `categoryId`.
 * Lead sponsor only.
 */
export async function postDealEsignTemplateUploads(
  req: Request,
  res: Response,
): Promise<void> {
  const user = getJwtUser(req);
  if (!user?.id) {
    res.status(401).json({ message: "Authorization required" });
    return;
  }
  const dealId =
    typeof req.params.dealId === "string"
      ? req.params.dealId
      : req.params.dealId?.[0];
  if (!dealId) {
    res.status(400).json({ message: "Missing deal id" });
    return;
  }

  const b = req.body as Record<string, unknown>;
  const categoryId = bodyString(b.categoryId ?? b.category_id).trim();
  if (!categoryId || !ALLOWED_ESIGN_CATEGORIES.has(categoryId)) {
    res.status(400).json({ message: "Valid categoryId is required" });
    return;
  }

  const files = (req as Request & { files?: DealMemoryUploadFile[] }).files;
  const fileList = Array.isArray(files) ? files : [];
  if (!fileList.length) {
    res.status(400).json({ message: "No files uploaded." });
    return;
  }

  try {
    const scope = await resolveDealViewerScope(user.id, user.userRole);
    if (!(await assertDealIdInViewerScope(dealId, scope))) {
      res.status(404).json({ message: "Deal not found" });
      return;
    }
    if (!(await isPortalUserLeadSponsorOnDeal(dealId, user.id))) {
      res.status(403).json({
        message: "Only the lead sponsor on this deal can upload eSign templates",
      });
      return;
    }

    const templateMeta = parseEsignTemplateUploadMeta(
      b.templateMeta ?? b.template_meta,
      fileList.length,
    );

    const added = await saveDealEsignTemplateFiles({
      dealId,
      categoryId,
      files: fileList,
      meta: templateMeta,
    });
    const state = await getDealEsignTemplatesState(dealId);
    res.status(200).json({
      message: "eSign templates uploaded",
      added,
      hasDocuments: dealHasEsignTemplateDocuments(state),
      filesByCategory: groupEsignFilesByCategory(state),
    });
  } catch (err) {
    console.error("postDealEsignTemplateUploads:", err);
    res.status(500).json({ message: "Could not upload eSign templates" });
  }
}

/**
 * DELETE /deals/:dealId/esign-templates/:fileId — lead sponsor only.
 */
export async function deleteDealEsignTemplate(
  req: Request,
  res: Response,
): Promise<void> {
  const user = getJwtUser(req);
  if (!user?.id) {
    res.status(401).json({ message: "Authorization required" });
    return;
  }
  const dealId =
    typeof req.params.dealId === "string"
      ? req.params.dealId
      : req.params.dealId?.[0];
  const fileId =
    typeof req.params.fileId === "string"
      ? req.params.fileId
      : req.params.fileId?.[0];
  if (!dealId || !fileId) {
    res.status(400).json({ message: "Missing deal id or file id" });
    return;
  }

  try {
    const scope = await resolveDealViewerScope(user.id, user.userRole);
    if (!(await assertDealIdInViewerScope(dealId, scope))) {
      res.status(404).json({ message: "Deal not found" });
      return;
    }
    if (!(await isPortalUserLeadSponsorOnDeal(dealId, user.id))) {
      res.status(403).json({
        message: "Only the lead sponsor on this deal can remove eSign templates",
      });
      return;
    }

    const removed = await removeDealEsignTemplateFile(dealId, fileId);
    if (!removed) {
      res.status(404).json({ message: "File not found" });
      return;
    }
    const state = await getDealEsignTemplatesState(dealId);
    res.status(200).json({
      hasDocuments: dealHasEsignTemplateDocuments(state),
      filesByCategory: groupEsignFilesByCategory(state),
    });
  } catch (err) {
    console.error("deleteDealEsignTemplate:", err);
    res.status(500).json({ message: "Could not remove eSign template" });
  }
}
