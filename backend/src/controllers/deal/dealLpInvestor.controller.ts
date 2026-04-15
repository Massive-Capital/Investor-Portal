import type { Request, Response } from "express";
import { getJwtUser } from "../../middleware/jwtUser.js";
import {
  assertDealIdInViewerScope,
  resolveDealViewerScope,
} from "../../services/dealAccess.service.js";
import { db } from "../../database/db.js";
import { users } from "../../schema/schema.js";
import { eq } from "drizzle-orm";
import {
  isLpInvestorRole,
  resolveInvestorClassForDealInvestment,
} from "../../services/dealInvestment.service.js";
import { reconcileAssigningDealUsersForDeal } from "../../services/assigningDealUser.service.js";
import { sendDealMemberInviteForInvestmentIfRequested } from "../../services/dealMemberInvitationEmail.service.js";
import {
  getDealLpInvestorById,
  getLpInvestorsTabPayload,
  updateDealLpInvestorById,
  updateMyCommittedAmountForLpDeal,
  upsertDealLpInvestor,
} from "../../services/dealLpInvestor.service.js";

function bodyString(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) {
    if (v.length === 0) return "";
    return bodyString(v[v.length - 1]);
  }
  if (v != null) return String(v);
  return "";
}

/** Debounced client saves send `autosave` — do not send invitation email on those requests. */
function isAutosaveJson(b: Record<string, unknown>): boolean {
  const raw = b.autosave;
  if (raw === true) return true;
  const v = bodyString(raw);
  return v === "true" || v === "1" || v.toLowerCase() === "yes";
}

/**
 * POST /deals/:dealId/lp-investors — JSON body (LP investor only; no `deal_investment` row).
 */
export async function postDealLpInvestor(
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
  const autosave = isAutosaveJson(b);
  const contactId = bodyString(b.contact_id ?? b.contactId);
  const contactDisplayName = bodyString(
    b.contact_display_name ?? b.contactDisplayName,
  );
  const investorClass = bodyString(b.investor_class ?? b.investorClass);
  const profileId = bodyString(b.profile_id ?? b.profileId);
  const sendInvitationMail = bodyString(
    b.send_invitation_mail ?? b.sendInvitationMail,
  );
  const contactEmail = bodyString(
    b.contact_email ?? b.contactEmail ?? b.email,
  );
  const investorRole = bodyString(
    b.investor_role ?? b.investorRole ?? b.role,
  );

  if (!contactId.trim()) {
    res.status(400).json({ message: "Member (contact) is required" });
    return;
  }

  try {
    const scope = await resolveDealViewerScope(user.id, user.userRole);
    if (!(await assertDealIdInViewerScope(dealId, scope))) {
      res.status(404).json({ message: "Deal not found" });
      return;
    }

    const classResolution = await resolveInvestorClassForDealInvestment(
      dealId,
      investorClass,
    );
    if (!classResolution.ok) {
      res.status(400).json({ message: classResolution.message });
      return;
    }

    const row = await upsertDealLpInvestor(dealId, {
      contactMemberId: contactId.trim(),
      contactDisplayName: contactDisplayName.trim(),
      profileId,
      investorClass: classResolution.storedInvestorClass,
      sendInvitationMail,
      addedByUserId: user.id,
      emailFromClient: contactEmail.trim() || null,
      roleFromClient: investorRole.trim() || null,
    });

    await reconcileAssigningDealUsersForDeal(dealId, user.id);
    if (!autosave) {
      await sendDealMemberInviteForInvestmentIfRequested({
        dealId,
        contactId: contactId.trim(),
        contactDisplayName: contactDisplayName.trim(),
        sendInvitationMail,
      });
    }

    const { investors } = await getLpInvestorsTabPayload(dealId, user.id);
    const inv = investors.find(
      (x) => String(x.id).toLowerCase() === String(row.id).toLowerCase(),
    );

    res.status(201).json({
      message: "LP investor saved",
      investor: inv ?? null,
    });
  } catch (err) {
    console.error("postDealLpInvestor:", err);
    res.status(500).json({ message: "Could not save LP investor" });
  }
}

/**
 * PUT /deals/:dealId/lp-investors/:lpInvestorId — JSON body.
 */
export async function putDealLpInvestor(
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
  const lpInvestorId =
    typeof req.params.lpInvestorId === "string"
      ? req.params.lpInvestorId
      : req.params.lpInvestorId?.[0];
  if (!dealId?.trim() || !lpInvestorId?.trim()) {
    res.status(400).json({ message: "Missing deal id or LP investor id" });
    return;
  }

  const b = req.body as Record<string, unknown>;
  const autosave = isAutosaveJson(b);
  const contactId = bodyString(b.contact_id ?? b.contactId);
  const contactDisplayName = bodyString(
    b.contact_display_name ?? b.contactDisplayName,
  );
  const investorClass = bodyString(b.investor_class ?? b.investorClass);
  const profileId = bodyString(b.profile_id ?? b.profileId);
  const sendInvitationMail = bodyString(
    b.send_invitation_mail ?? b.sendInvitationMail,
  );
  const contactEmail = bodyString(
    b.contact_email ?? b.contactEmail ?? b.email,
  );
  const investorRole = bodyString(
    b.investor_role ?? b.investorRole ?? b.role,
  );

  if (!contactId.trim()) {
    res.status(400).json({ message: "Member (contact) is required" });
    return;
  }

  try {
    const scope = await resolveDealViewerScope(user.id, user.userRole);
    if (!(await assertDealIdInViewerScope(dealId, scope))) {
      res.status(404).json({ message: "Deal not found" });
      return;
    }

    const existing = await getDealLpInvestorById(dealId, lpInvestorId);
    if (!existing) {
      res.status(404).json({ message: "LP investor row not found" });
      return;
    }

    const classResolution = await resolveInvestorClassForDealInvestment(
      dealId,
      investorClass,
    );
    if (!classResolution.ok) {
      res.status(400).json({ message: classResolution.message });
      return;
    }

    const row = await updateDealLpInvestorById(dealId, lpInvestorId, {
      contactMemberId: contactId.trim(),
      contactDisplayName: contactDisplayName.trim(),
      profileId,
      investorClass: classResolution.storedInvestorClass,
      sendInvitationMail,
      addedByUserId: user.id,
      emailFromClient: contactEmail.trim() || null,
      roleFromClient: investorRole.trim() || null,
    });
    if (!row) {
      res.status(404).json({ message: "Could not update LP investor" });
      return;
    }

    await reconcileAssigningDealUsersForDeal(dealId, user.id);
    if (!autosave) {
      await sendDealMemberInviteForInvestmentIfRequested({
        dealId,
        contactId: contactId.trim(),
        contactDisplayName: contactDisplayName.trim(),
        sendInvitationMail,
      });
    }

    const { investors } = await getLpInvestorsTabPayload(dealId, user.id);
    const inv = investors.find(
      (x) => String(x.id).toLowerCase() === String(row.id).toLowerCase(),
    );

    res.status(200).json({
      message: "LP investor updated",
      investor: inv ?? null,
    });
  } catch (err) {
    console.error("putDealLpInvestor:", err);
    res.status(500).json({ message: "Could not update LP investor" });
  }
}

/**
 * PATCH /deals/:dealId/lp-investors/my-commitment — LP sets `deal_investment.commitment_amount`
 * and optional `profile_id`; creates `deal_investment` when missing (profile required for insert).
 */
export async function patchDealLpInvestorMyCommitment(
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
    if (!(await assertDealIdInViewerScope(dealId.trim(), scope))) {
      res.status(404).json({ message: "Deal not found" });
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
    const result = await updateMyCommittedAmountForLpDeal({
      dealId: dealId.trim(),
      viewerEmailNorm: emailNorm,
      viewerUserId: user.id,
      committedAmount: raw,
      profileId: profileRaw,
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
    console.error("patchDealLpInvestorMyCommitment:", err);
    res.status(500).json({ message: "Could not save committed amount" });
  }
}
