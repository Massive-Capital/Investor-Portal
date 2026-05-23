import type { Request, Response } from "express";
import {
  esignBundleHasPending,
  esignBundleIsAllCompleted,
  parseEsignStatusBundle,
} from "../../constants/deal-investor-esign-status.js";
import { getJwtUser } from "../../middleware/jwtUser.js";
import {
  assertDealIdReadableOrAssignedParticipant,
  resolveDealViewerScope,
} from "../../services/deal/dealAccess.service.js";
import {
  listMyEsignDocumentsForInvestor,
  syncDealInvestorEsignByTarget,
} from "../../services/deal/dealMemberEsignCompletion.service.js";
import {
  findInvestorEsignTargetForPortalUser,
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
    const scope = await resolveDealViewerScope(user.id, user.userRole);
    if (!(await assertDealIdReadableOrAssignedParticipant(dealId, scope))) {
      res.status(404).json({ message: "Deal not found" });
      return;
    }

    const target = await findInvestorEsignTargetForPortalUser(dealId, {
      email,
      userId: user.id,
    });
    if (!target) {
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

    res.status(200).json({
      documents,
      esignCompleted: bundle ? esignBundleIsAllCompleted(bundle) : false,
      esignPending: bundle ? esignBundleHasPending(bundle) : false,
      completedAt: bundle?.sends.every((s) => s.completedAt)
        ? bundle.sends
            .map((s) => s.completedAt?.trim())
            .filter(Boolean)
            .sort()
            .at(-1) ?? null
        : null,
      sentAt: bundle?.sends[0]?.sentAt ?? null,
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
    const scope = await resolveDealViewerScope(user.id, user.userRole);
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
