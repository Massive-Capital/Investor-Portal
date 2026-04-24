import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { getJwtUser } from "../../middleware/jwtUser.js";
import {
  assertDealIdReadableOrAssignedParticipant,
  resolveDealViewerScope,
} from "../../services/dealAccess.service.js";
import { db } from "../../database/db.js";
import { users } from "../../schema/schema.js";
import { getAddDealFormById } from "../../services/dealForm.service.js";
import { isDealStageCapitalRaising } from "../../utils/dealStageCapitalRaising.js";
import { reconcileAssigningDealUsersForDeal } from "../../services/assigningDealUser.service.js";
import {
  getLpInvestorsTabPayload,
} from "../../services/dealLpInvestor.service.js";
import { applyMyInvestNowCommitmentAddon } from "../../services/dealLpInvestorMyInvestNowCommitment.addon.service.js";

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
 * PATCH /deals/:dealId/lp-investors/my-invest-now-commitment
 * copy_code parity: full commitment value + optional status + doc_signed_date; raising-capital guard.
 */
export async function patchDealLpInvestorMyInvestNowAddon(
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
  const raw =
    bodyString(b.committed_amount ?? b.committedAmount).trim() ||
    bodyString(b.amount).trim();
  const n = Number(String(raw).replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n <= 0) {
    res.status(400).json({
      message: "Committed amount must be a number greater than 0",
    });
    return;
  }

  try {
    const scope = await resolveDealViewerScope(user.id, user.userRole);
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

    const profileRaw = bodyString(b.profile_id ?? b.profileId);
    const hasUserInvestorProfileIdKey =
      Object.prototype.hasOwnProperty.call(b, "user_investor_profile_id") ||
      Object.prototype.hasOwnProperty.call(b, "userInvestorProfileId");
    const userInvestorProfileRaw = hasUserInvestorProfileIdKey
      ? bodyString(b.user_investor_profile_id ?? b.userInvestorProfileId)
      : undefined;
    const hasStatusKey = Object.prototype.hasOwnProperty.call(b, "status");
    const hasDocSignedKey =
      Object.prototype.hasOwnProperty.call(b, "doc_signed_date") ||
      Object.prototype.hasOwnProperty.call(b, "docSignedDate");
    const statusPatch = hasStatusKey
      ? bodyString(b.status).trim()
      : undefined;
    const docSignedRaw = hasDocSignedKey
      ? bodyString(b.doc_signed_date ?? b.docSignedDate).trim()
      : undefined;
    const docSignedPatch =
      hasDocSignedKey && docSignedRaw === "" ? null : docSignedRaw;

    const result = await applyMyInvestNowCommitmentAddon({
      dealId: dealId.trim(),
      viewerEmailNorm: emailNorm,
      viewerUserId: user.id,
      committedAmount: raw,
      profileId: profileRaw,
      userInvestorProfileInBody: hasUserInvestorProfileIdKey,
      userInvestorProfileId: hasUserInvestorProfileIdKey
        ? userInvestorProfileRaw
        : undefined,
      status: statusPatch,
      docSignedDate: hasDocSignedKey ? docSignedPatch : undefined,
    });
    if (!result.ok) {
      res.status(400).json({ message: result.message });
      return;
    }

    await reconcileAssigningDealUsersForDeal(dealId.trim(), user.id);

    const payload = await getLpInvestorsTabPayload(dealId.trim(), user.id);
    res.status(200).json({
      message: "Committed amount saved",
      investorsPayload: payload,
    });
  } catch (err) {
    console.error("patchDealLpInvestorMyInvestNowAddon:", err);
    res.status(500).json({ message: "Could not save committed amount" });
  }
}
