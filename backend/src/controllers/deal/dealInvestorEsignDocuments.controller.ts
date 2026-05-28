import type { Request, Response } from "express";
import {
  esignBundleHasPending,
  esignBundleIsAllCompleted,
  esignSignedColumnLabelFromApi,
  parseEsignStatusBundle,
  parseEsignStatusJson,
} from "../../constants/deal-investor-esign-status.js";
import { getJwtUser } from "../../middleware/jwtUser.js";
import {
  assertDealIdReadableOrAssignedParticipant,
  resolveDealViewerScope,
} from "../../services/deal/dealAccess.service.js";
import { requestedOrganizationIdFromRequest } from "../../services/org/orgResolution.service.js";
import {
  listMyEsignDocumentsForInvestor,
  syncDealInvestorEsignAfterEmbeddedSign,
  syncDealInvestorEsignByTarget,
  syncDealInvestorEsignSignProgress,
} from "../../services/deal/dealMemberEsignCompletion.service.js";
import {
  findInvestorEsignTargetForInvestNowCommitment,
  findInvestorEsignTargetForPortalUser,
  investorEsignTargetHasPositiveCommitment,
  markDealInvestorEsignViewed,
  readInvestorEsignStatusJson,
} from "../../services/deal/dealMemberEsignStatus.service.js";
import { getDealMyEsignSignSession } from "../../services/deal/dealMemberEsignSignSession.service.js";

/**
 * GET /deals/:dealId/my-esign-documents
 * eSign documents for the signed-in investor: template previews while pending,
 * signed PDF after completion.
 */
export async function getDealMyEsignDocuments(
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
  if (!dealId?.trim()) {
    res.status(400).json({ message: "Missing deal id" });
    return;
  }

  const email = String(user.email ?? "").trim().toLowerCase();
  if (!email.includes("@")) {
    res.status(400).json({ message: "Your account has no email on file" });
    return;
  }

  try {
    const scope = await resolveDealViewerScope(
      user.id,
      user.userRole,
      requestedOrganizationIdFromRequest(req),
    );
    if (!(await assertDealIdReadableOrAssignedParticipant(dealId, scope))) {
      res.status(404).json({ message: "Deal not found" });
      return;
    }

    let target = await findInvestorEsignTargetForPortalUser(dealId, {
      email,
      userId: user.id,
    });
    if (!target) {
      target = await findInvestorEsignTargetForInvestNowCommitment(dealId, {
        email,
        userId: user.id,
      });
    }
    if (!target) {
      res.status(200).json({
        documents: [],
        esignCompleted: false,
        esignPending: false,
      });
      return;
    }

    if (!(await investorEsignTargetHasPositiveCommitment(dealId, target))) {
      res.status(200).json({
        documents: [],
        esignCompleted: false,
        esignPending: false,
      });
      return;
    }

    await syncDealInvestorEsignByTarget(dealId, target);

    const raw = await readInvestorEsignStatusJson(dealId, target);
    const bundle = parseEsignStatusBundle(raw);
    const documents = await listMyEsignDocumentsForInvestor(dealId, raw);
    const esignStatus = parseEsignStatusJson(raw);
    const workflowLabel = esignSignedColumnLabelFromApi(esignStatus) ?? "Sent";

    res.status(200).json({
      documents,
      esignCompleted: bundle ? esignBundleIsAllCompleted(bundle) : false,
      esignPending: bundle ? esignBundleHasPending(bundle) : false,
      esignStatus,
      workflowLabel,
      completedAt: esignStatus?.completedAt ?? null,
      sentAt: esignStatus?.sentAt ?? null,
    });
  } catch (err) {
    console.error("getDealMyEsignDocuments:", err);
    res.status(500).json({ message: "Could not load eSign documents" });
  }
}

/**
 * GET /deals/:dealId/my-esign-sign-session
 * Fresh embedded sign URL + public client id for hellosign-embedded (investor portal).
 */
export async function getDealMyEsignSignSessionHandler(
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
  if (!dealId?.trim()) {
    res.status(400).json({ message: "Missing deal id" });
    return;
  }

  const email = String(user.email ?? "").trim().toLowerCase();
  if (!email.includes("@")) {
    res.status(400).json({ message: "Your account has no email on file" });
    return;
  }

  try {
    const scope = await resolveDealViewerScope(
      user.id,
      user.userRole,
      requestedOrganizationIdFromRequest(req),
    );
    if (!(await assertDealIdReadableOrAssignedParticipant(dealId, scope))) {
      res.status(404).json({ message: "Deal not found" });
      return;
    }

    const signatureRequestId =
      typeof req.query.signatureRequestId === "string"
        ? req.query.signatureRequestId
        : typeof req.query.signature_request_id === "string"
          ? req.query.signature_request_id
          : undefined;

    const result = await getDealMyEsignSignSession({
      dealId,
      email,
      userId: user.id,
      signatureRequestId,
    });
    if (!result.ok) {
      const status =
        result.code === "not_configured"
          ? 503
          : result.code === "not_found"
            ? 404
            : 400;
      res.status(status).json({ message: result.message });
      return;
    }

    res.status(200).json({
      alreadyCompleted: result.alreadyCompleted,
      signUrl: result.signUrl,
      clientId: result.clientId,
      testMode: result.testMode,
      configured: result.configured,
      signatureRequestId: result.signatureRequestId ?? null,
    });
  } catch (err) {
    console.error("getDealMyEsignSignSessionHandler:", err);
    res.status(500).json({ message: "Could not load eSign signing session" });
  }
}

/**
 * POST /deals/:dealId/my-esign-sync
 * Pull latest Dropbox Sign state after embedded signing (Invest Now / portal).
 */
export async function postDealMyEsignSync(
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
  if (!dealId?.trim()) {
    res.status(400).json({ message: "Missing deal id" });
    return;
  }

  const email = String(user.email ?? "").trim().toLowerCase();
  if (!email.includes("@")) {
    res.status(400).json({ message: "Your account has no email on file" });
    return;
  }

  const body = req.body as Record<string, unknown> | undefined;
    const signatureRequestId = String(
      body?.signatureRequestId ??
        body?.signature_request_id ??
        "",
    ).trim();
    const phase = String(body?.phase ?? body?.event ?? "finish")
      .trim()
      .toLowerCase();

    try {
    const scope = await resolveDealViewerScope(
      user.id,
      user.userRole,
      requestedOrganizationIdFromRequest(req),
    );
    if (!(await assertDealIdReadableOrAssignedParticipant(dealId, scope))) {
      res.status(404).json({ message: "Deal not found" });
      return;
    }

    let target = await findInvestorEsignTargetForPortalUser(dealId, {
      email,
      userId: user.id,
    });
    if (!target) {
      target = await findInvestorEsignTargetForInvestNowCommitment(dealId, {
        email,
        userId: user.id,
      });
    }
    if (!target) {
      res.status(200).json({
        esignStatus: null,
        esignCompleted: false,
        esignPending: false,
      });
      return;
    }

    if (!(await investorEsignTargetHasPositiveCommitment(dealId, target))) {
      res.status(200).json({
        esignStatus: null,
        esignCompleted: false,
        esignPending: false,
      });
      return;
    }

    if (phase === "sign") {
      await syncDealInvestorEsignSignProgress(
        dealId,
        target,
        signatureRequestId || undefined,
      );
    } else {
      await syncDealInvestorEsignAfterEmbeddedSign(
        dealId,
        target,
        signatureRequestId || undefined,
      );
    }

    const raw = await readInvestorEsignStatusJson(dealId, target);
    const bundle = parseEsignStatusBundle(raw);
    const esignStatus = parseEsignStatusJson(raw);

    res.status(200).json({
      esignStatus,
      workflowLabel: esignSignedColumnLabelFromApi(esignStatus) ?? "Sent",
      esignCompleted: bundle ? esignBundleIsAllCompleted(bundle) : false,
      esignPending: bundle ? esignBundleHasPending(bundle) : false,
    });
  } catch (err) {
    console.error("postDealMyEsignSync:", err);
    res.status(500).json({ message: "Could not sync eSign status" });
  }
}

async function resolveMyEsignTargetForUser(
  dealId: string,
  userId: string,
  email: string,
) {
  let target = await findInvestorEsignTargetForPortalUser(dealId, {
    email,
    userId,
  });
  if (!target) {
    target = await findInvestorEsignTargetForInvestNowCommitment(dealId, {
      email,
      userId,
    });
  }
  return target;
}

/**
 * POST /deals/:dealId/my-esign-mark-viewed
 * Invest Now: investor opened preview or signing UI (Dropbox Document History → Viewed).
 */
export async function postDealMyEsignMarkViewed(
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
  if (!dealId?.trim()) {
    res.status(400).json({ message: "Missing deal id" });
    return;
  }

  const email = String(user.email ?? "").trim().toLowerCase();
  if (!email.includes("@")) {
    res.status(400).json({ message: "Your account has no email on file" });
    return;
  }

  const body = req.body as Record<string, unknown> | undefined;
  const signatureRequestId = String(
    body?.signatureRequestId ?? body?.signature_request_id ?? "",
  ).trim();

  try {
    const scope = await resolveDealViewerScope(
      user.id,
      user.userRole,
      requestedOrganizationIdFromRequest(req),
    );
    if (!(await assertDealIdReadableOrAssignedParticipant(dealId, scope))) {
      res.status(404).json({ message: "Deal not found" });
      return;
    }

    const target = await resolveMyEsignTargetForUser(dealId, user.id, email);
    if (!target || !signatureRequestId) {
      res.status(200).json({ ok: false });
      return;
    }

    await markDealInvestorEsignViewed(dealId, target, signatureRequestId);

    const raw = await readInvestorEsignStatusJson(dealId, target);
    const esignStatus = parseEsignStatusJson(raw);

    res.status(200).json({
      ok: true,
      workflowLabel: esignSignedColumnLabelFromApi(esignStatus) ?? "Sent",
      esignStatus,
    });
  } catch (err) {
    console.error("postDealMyEsignMarkViewed:", err);
    res.status(500).json({ message: "Could not record viewed status" });
  }
}
