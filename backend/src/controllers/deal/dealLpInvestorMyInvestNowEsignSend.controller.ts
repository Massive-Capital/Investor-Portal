import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { getJwtUser } from "../../middleware/jwtUser.js";
import {
  assertDealIdReadableOrAssignedParticipant,
  resolveDealViewerScope,
} from "../../services/deal/dealAccess.service.js";
import { requestedOrganizationIdFromRequest } from "../../services/org/orgResolution.service.js";
import { db } from "../../database/db.js";
import { users } from "../../schema/schema.js";
import { getAddDealFormById } from "../../services/deal/dealForm.service.js";
import { isDealStageCapitalRaising } from "../../utils/dealStageCapitalRaising.js";
import { sendMyInvestNowEsignIfNeeded } from "../../services/deal/dealLpInvestNowMyEsignSend.service.js";

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
 * POST /deals/:dealId/lp-investors/my-invest-now-esign-send
 * Investor self-serve: send profile-matched eSign templates after Invest Now commitment.
 */
export async function postDealLpInvestorMyInvestNowEsignSend(
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

  const b = req.body as Record<string, unknown>;
  const profileId = bodyString(b.profile_id ?? b.profileId);

  try {
    const scope = await resolveDealViewerScope(
      user.id,
      user.userRole,
      requestedOrganizationIdFromRequest(req),
    );
    if (
      !(await assertDealIdReadableOrAssignedParticipant(dealId.trim(), scope))
    ) {
      res.status(404).json({ message: "Deal not found" });
      return;
    }

    const dealRow = await getAddDealFormById(dealId.trim());
    if (!dealRow || !isDealStageCapitalRaising(dealRow.dealStage)) {
      res.status(403).json({
        message:
          "Investments can only be recorded while the deal is raising capital.",
      });
      return;
    }

    const [uRow] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    const emailNorm = String(uRow?.email ?? "")
      .trim()
      .toLowerCase();
    if (!emailNorm.includes("@")) {
      res.status(400).json({ message: "Missing investor email on account" });
      return;
    }

    const displayName = bodyString(b.member_display_name ?? b.memberDisplayName);

    const questionnaireRaw = b.questionnaire_answers ?? b.questionnaireAnswers;
    const w9Raw = b.w9_form ?? b.w9Form;
    const w9InBody =
      Object.prototype.hasOwnProperty.call(b, "w9_form") ||
      Object.prototype.hasOwnProperty.call(b, "w9Form");
    const isAdminActor =
      user.userRole === "company_admin" || user.userRole === "platform_admin";
    if (w9InBody && isAdminActor) {
      res.status(403).json({
        message:
          "Only investors can fill or update W-9 details. Sponsor/admin users have view-only access.",
      });
      return;
    }

    const result = await sendMyInvestNowEsignIfNeeded({
      dealId: dealId.trim(),
      viewerEmail: emailNorm,
      viewerUserId: user.id,
      profileId,
      memberDisplayName: displayName || undefined,
      questionnaireAnswers:
        questionnaireRaw != null && typeof questionnaireRaw === "object"
          ? (questionnaireRaw as Record<string, string>)
          : undefined,
      w9Form:
        w9Raw != null && typeof w9Raw === "object"
          ? (w9Raw as Record<string, string>)
          : undefined,
    });

    if (!result.ok) {
      res.status(400).json({ message: result.message });
      return;
    }

    res.status(200).json({
      message: result.alreadyCompleted
        ? "Documents already signed"
        : result.alreadySent
          ? "Documents already sent for signature"
          : "E-sign documents sent",
      alreadySent: result.alreadySent,
      alreadyCompleted: result.alreadyCompleted,
      signatureRequestId: result.signatureRequestId,
      investmentId: result.investmentId,
      documentNames: result.documentNames,
    });
  } catch (err) {
    console.error("postDealLpInvestorMyInvestNowEsignSend:", err);
    res.status(500).json({ message: "Could not send eSign documents" });
  }
}
