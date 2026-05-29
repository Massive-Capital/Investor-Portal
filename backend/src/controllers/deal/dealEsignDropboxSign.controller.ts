import type { Request, Response } from "express";
import { getJwtUser } from "../../middleware/jwtUser.js";
import {
  assertDealIdInViewerScope,
  resolveDealViewerScope,
} from "../../services/deal/dealAccess.service.js";
import { requestedOrganizationIdFromRequest } from "../../services/org/orgResolution.service.js";
import { isPortalUserLeadOrAdminSponsorOnDeal } from "../../services/deal/dealMemberScope.service.js";
import {
  completeDealEsignEmbeddedTemplate,
  getDealEsignDropboxSignPublicConfig,
  startDealEsignEmbeddedTemplateDraft,
} from "../../services/deal/dealEsignDropboxSign.service.js";
import {
  getDealEsignTemplatesState,
  groupEsignFilesByCategory,
  dealHasEsignTemplateDocuments,
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

/**
 * GET /deals/esign-templates/dropbox-sign-config
 * Returns client id for hellosign-embedded (never exposes API key).
 */
export async function getDealEsignDropboxSignConfig(
  _req: Request,
  res: Response,
): Promise<void> {
  const user = getJwtUser(_req);
  if (!user?.id) {
    res.status(401).json({ message: "Authorization required" });
    return;
  }
  res.status(200).json(getDealEsignDropboxSignPublicConfig());
}

/**
 * POST /deals/:dealId/esign-templates/:fileId/embedded-draft
 * Creates (or resumes) a Dropbox Sign embedded template draft; returns edit_url for iframe.
 */
export async function postDealEsignEmbeddedDraft(
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

  const b = req.body as Record<string, unknown>;
  const title = bodyString(b.title).trim() || undefined;

  try {
    const scope = await resolveDealViewerScope(
      user.id,
      user.userRole,
      requestedOrganizationIdFromRequest(req),
    );
    if (!(await assertDealIdInViewerScope(dealId, scope))) {
      res.status(404).json({ message: "Deal not found" });
      return;
    }
    if (!(await isPortalUserLeadOrAdminSponsorOnDeal(dealId, user.id))) {
      res.status(403).json({
        message:
          "Only the lead or admin sponsor can configure Dropbox Sign templates",
      });
      return;
    }

    const result = await startDealEsignEmbeddedTemplateDraft({
      dealId,
      fileId,
      title,
    });

    const state = await getDealEsignTemplatesState(dealId);
    res.status(200).json({
      editUrl: result.editUrl,
      templateId: result.templateId,
      expiresAt: result.expiresAt,
      clientId: result.clientId,
      testMode: result.testMode,
      file: result.file,
      hasDocuments: dealHasEsignTemplateDocuments(state),
      filesByCategory: groupEsignFilesByCategory(state),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not start embedded template editor";
    console.error("postDealEsignEmbeddedDraft:", err);
    const status = message.includes("not configured") ? 503 : 400;
    res.status(status).json({ message });
  }
}

/**
 * POST /deals/:dealId/esign-templates/:fileId/complete-embedded-template
 * Persists template_id after sponsor saves in embedded editor (createTemplate event).
 */
export async function postDealEsignCompleteEmbeddedTemplate(
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

  const b = req.body as Record<string, unknown>;
  const dropboxSignTemplateId = bodyString(
    b.dropboxSignTemplateId ?? b.template_id ?? b.templateId,
  ).trim();
  const title = bodyString(b.title).trim() || undefined;

  if (!dropboxSignTemplateId) {
    res.status(400).json({ message: "dropboxSignTemplateId is required" });
    return;
  }

  try {
    const scope = await resolveDealViewerScope(
      user.id,
      user.userRole,
      requestedOrganizationIdFromRequest(req),
    );
    if (!(await assertDealIdInViewerScope(dealId, scope))) {
      res.status(404).json({ message: "Deal not found" });
      return;
    }
    if (!(await isPortalUserLeadOrAdminSponsorOnDeal(dealId, user.id))) {
      res.status(403).json({
        message:
          "Only the lead or admin sponsor can save Dropbox Sign templates",
      });
      return;
    }

    const file = await completeDealEsignEmbeddedTemplate({
      dealId,
      fileId,
      dropboxSignTemplateId,
      title,
    });

    const state = await getDealEsignTemplatesState(dealId);
    res.status(200).json({
      message: "Dropbox Sign template saved",
      file,
      hasDocuments: dealHasEsignTemplateDocuments(state),
      filesByCategory: groupEsignFilesByCategory(state),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not save embedded template";
    console.error("postDealEsignCompleteEmbeddedTemplate:", err);
    res.status(400).json({ message });
  }
}
