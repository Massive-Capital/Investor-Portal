import type { Request, Response } from "express";
import { getJwtUser } from "../../middleware/jwtUser.js";
import {
  assertDealIdInViewerScope,
  resolveDealViewerScope,
} from "../../services/dealAccess.service.js";
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

function isAutosaveBody(b: Record<string, unknown>): boolean {
  const raw = b.autosave;
  if (raw === true || raw === 1) return true;
  const v = bodyString(raw).toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

/**
 * POST /deals/:dealId/lp-investors — JSON body (LP roster only; no `deal_investment` row).
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
  const autosave = isAutosaveBody(b);
  const contactId = bodyString(b.contact_id ?? b.contactId);
  const contactDisplayName = bodyString(
    b.contact_display_name ?? b.contactDisplayName,
  );
  const investorClass = bodyString(b.investor_class ?? b.investorClass);
  const sendInvitationMail = bodyString(
    b.send_invitation_mail ?? b.sendInvitationMail,
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
      investorClass: classResolution.storedInvestorClass,
      sendInvitationMail,
      addedByUserId: user.id,
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

    const { investors } = await getLpInvestorsTabPayload(dealId);
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
  const autosave = isAutosaveBody(b);
  const contactId = bodyString(b.contact_id ?? b.contactId);
  const contactDisplayName = bodyString(
    b.contact_display_name ?? b.contactDisplayName,
  );
  const investorClass = bodyString(b.investor_class ?? b.investorClass);
  const sendInvitationMail = bodyString(
    b.send_invitation_mail ?? b.sendInvitationMail,
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
      investorClass: classResolution.storedInvestorClass,
      sendInvitationMail,
      addedByUserId: user.id,
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

    const { investors } = await getLpInvestorsTabPayload(dealId);
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
