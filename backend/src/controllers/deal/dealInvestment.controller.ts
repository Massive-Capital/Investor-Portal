import type { Request, Response } from "express";
import { getJwtUser } from "../../middleware/jwtUser.js";
import {
  assertDealIdInViewerScope,
  assertDealIdReadableOrAssignedParticipant,
  resolveDealViewerScope,
} from "../../services/dealAccess.service.js";
import { reconcileAssigningDealUsersForDeal } from "../../services/assigningDealUser.service.js";
import {
  filterMergedLpInvestorsForCoSponsorViewer,
  getLpInvestorsTabPayload,
  isViewerCoSponsorOnDeal,
} from "../../services/dealLpInvestor.service.js";
import {
  buildInvestorKpisFromRows,
  DEAL_INVESTMENT_AUTOSAVE_CONTACT_PLACEHOLDER,
  enrichInvestorApiRowsWithAddedBy,
  getDealInvestmentById,
  getLatestCommitmentAmountForDealContact,
  insertDealInvestment,
  isLpInvestorRole,
  listDealInvestmentsByDealId,
  mapDealInvestmentsToInvestorApi,
  resolveFirstInvestorClassForDeal,
  resolveInvestorClassForDealInvestment,
  saveSubscriptionDocument,
  updateDealInvestment,
} from "../../services/dealInvestment.service.js";
import { upsertDealMemberForDeal } from "../../services/dealMember.service.js";
import { sendDealMemberInviteForInvestmentIfRequested } from "../../services/dealMemberInvitationEmail.service.js";

function bodyString(v: unknown): string {
  if (typeof v === "string") return v;
  // multipart parsers may expose duplicate keys as string[]
  if (Array.isArray(v)) {
    if (v.length === 0) return "";
    return bodyString(v[v.length - 1]);
  }
  if (v != null) return String(v);
  return "";
}

function parseExtras(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((x) => String(x));
  if (typeof raw === "string" && raw.trim()) {
    try {
      const j = JSON.parse(raw) as unknown;
      if (Array.isArray(j)) return j.map((x) => String(x));
    } catch {
      /* ignore */
    }
  }
  return [];
}

function isAutosaveBody(b: Record<string, unknown>): boolean {
  const v = bodyString(b.autosave);
  return v === "true" || v === "1" || v.toLowerCase() === "yes";
}

export async function getDealInvestors(
  req: Request,
  res: Response,
): Promise<void> {
  const user = getJwtUser(req);
  if (!user?.id) {
    res.status(401).json({ message: "Authorization required" });
    return;
  }
  const dealId =
    typeof req.params.dealId === "string" ? req.params.dealId : req.params.dealId?.[0];
  if (!dealId) {
    res.status(400).json({ message: "Missing deal id" });
    return;
  }
  try {
    const scope = await resolveDealViewerScope(user.id, user.userRole);
    if (!(await assertDealIdReadableOrAssignedParticipant(dealId, scope))) {
      res.status(404).json({ message: "Deal not found" });
      return;
    }
    const q = req.query as Record<string, unknown>;
    const lpRaw = q.lpInvestorsOnly ?? q.lp_investors_only ?? q.lp;
    const lpInvestorsOnly =
      lpRaw === "1" ||
      lpRaw === "true" ||
      String(lpRaw).toLowerCase() === "yes";
    if (lpInvestorsOnly) {
      const { kpis, investors } = await getLpInvestorsTabPayload(
        dealId,
        user.id,
      );
      res.status(200).json({ kpis, investors });
      return;
    }
    let rows = await listDealInvestmentsByDealId(dealId, {
      lpInvestorsOnly: false,
    });
    if (await isViewerCoSponsorOnDeal(dealId, user.id)) {
      rows = await filterMergedLpInvestorsForCoSponsorViewer(
        dealId,
        user.id,
        rows,
      );
    }
    const mapped = await mapDealInvestmentsToInvestorApi(rows);
    const investors = await enrichInvestorApiRowsWithAddedBy(dealId, mapped);
    const kpis = buildInvestorKpisFromRows(rows);
    res.status(200).json({
      kpis,
      investors,
    });
  } catch (err) {
    console.error("getDealInvestors:", err);
    res.status(500).json({ message: "Could not load investors" });
  }
}

/**
 * GET /deals/:dealId/commitment-amount?contact_id=...
 * Isolated lookup: latest stored `commitment_amount` for this deal + contact (viewer-scoped).
 */
export async function getDealCommitmentAmountByContact(
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
  const q = req.query as Record<string, unknown>;
  const contactId = bodyString(q.contact_id ?? q.contactId).trim();

  if (!dealId?.trim()) {
    res.status(400).json({ message: "Missing deal id" });
    return;
  }
  if (!contactId) {
    res
      .status(400)
      .json({ message: "Missing contact_id query parameter" });
    return;
  }

  try {
    const scope = await resolveDealViewerScope(user.id, user.userRole);
    if (!(await assertDealIdReadableOrAssignedParticipant(dealId, scope))) {
      res.status(404).json({ message: "Deal not found" });
      return;
    }
    const commitmentAmount = await getLatestCommitmentAmountForDealContact(
      dealId.trim(),
      contactId,
    );
    res.status(200).json({
      dealId: dealId.trim(),
      contactId,
      commitmentAmount,
      found: commitmentAmount != null,
    });
  } catch (err) {
    console.error("getDealCommitmentAmountByContact:", err);
    res.status(500).json({ message: "Could not load commitment amount" });
  }
}

export async function putDealInvestment(
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
  const investmentId =
    typeof req.params.investmentId === "string"
      ? req.params.investmentId
      : req.params.investmentId?.[0];
  if (!dealId || !investmentId) {
    res.status(400).json({ message: "Missing deal id or investment id" });
    return;
  }

  const b = req.body as Record<string, unknown>;
  const autosave = isAutosaveBody(b);
  const offeringId = bodyString(b.offering_id);
  let contactId = bodyString(b.contact_id);
  const contactDisplayName = bodyString(b.contact_display_name);
  const profileId = bodyString(b.profile_id);
  const userInvestorProfileIdFromBody = bodyString(
    b.user_investor_profile_id ?? b.userInvestorProfileId,
  ).trim();
  const hasUipInBody =
    Object.prototype.hasOwnProperty.call(b, "user_investor_profile_id") ||
    Object.prototype.hasOwnProperty.call(b, "userInvestorProfileId");
  const investor_role = bodyString(b.investor_role);
  const status = bodyString(b.status);
  const investorClass = bodyString(b.investor_class);
  const docSignedDate = bodyString(b.doc_signed_date) || null;
  let commitmentAmount = bodyString(b.commitment_amount);
  const extraContributionAmounts = parseExtras(b.extra_contribution_amounts);
  const sendInvitationMail = bodyString(b.send_invitation_mail);

  if (autosave) {
    if (!contactId.trim()) {
      contactId = DEAL_INVESTMENT_AUTOSAVE_CONTACT_PLACEHOLDER;
    }
    if (!commitmentAmount.trim()) {
      commitmentAmount = "0";
    }
  } else {
    if (!contactId.trim()) {
      res.status(400).json({ message: "Member (contact) is required" });
      return;
    }
    if (!commitmentAmount.trim()) {
      res.status(400).json({ message: "Commitment amount is required" });
      return;
    }
  }

  const file = req.file;
  try {
    const scope = await resolveDealViewerScope(user.id, user.userRole);
    if (!(await assertDealIdInViewerScope(dealId, scope))) {
      res.status(404).json({ message: "Deal not found" });
      return;
    }

    const classResolution =
      autosave && !investorClass.trim()
        ? await resolveFirstInvestorClassForDeal(dealId)
        : await resolveInvestorClassForDealInvestment(dealId, investorClass);
    if (!classResolution.ok) {
      res.status(400).json({ message: classResolution.message });
      return;
    }
    const resolvedInvestorClass = classResolution.storedInvestorClass;

    const existing = await getDealInvestmentById(dealId, investmentId);
    if (!existing) {
      res.status(404).json({ message: "Investment not found" });
      return;
    }

    let documentStoragePath: string | null = existing.documentStoragePath;
    if (file && "buffer" in file && file.buffer && file.buffer.length > 0) {
      documentStoragePath = await saveSubscriptionDocument({
        dealId,
        file: {
          buffer: file.buffer,
          originalname: file.originalname || "document",
        },
      });
    }

    const oldUip = String(existing.userInvestorProfileId ?? "").trim();
    const newUip = userInvestorProfileIdFromBody;
    const switchingBookProfile =
      !autosave &&
      Boolean(oldUip) &&
      Boolean(newUip) &&
      oldUip.toLowerCase() !== newUip.toLowerCase();

    const row = switchingBookProfile
      ? await insertDealInvestment({
          dealId,
          input: {
            offeringId,
            contactId,
            contactDisplayName,
            profileId,
            userInvestorProfileId: newUip,
            investor_role,
            status,
            investorClass: resolvedInvestorClass,
            docSignedDate,
            commitmentAmount,
            extraContributionAmounts,
            documentStoragePath,
          },
        })
      : await updateDealInvestment({
          dealId,
          investmentId,
          input: {
            offeringId,
            contactId,
            contactDisplayName,
            profileId,
            ...(hasUipInBody
              ? { userInvestorProfileId: userInvestorProfileIdFromBody || null }
              : {}),
            investor_role,
            status,
            investorClass: resolvedInvestorClass,
            docSignedDate,
            commitmentAmount,
            extraContributionAmounts,
            documentStoragePath,
          },
        });
    if (!row) {
      res.status(404).json({ message: "Investment not found" });
      return;
    }
    const contactIsPlaceholder =
      contactId.trim() === DEAL_INVESTMENT_AUTOSAVE_CONTACT_PLACEHOLDER;
    if (!contactIsPlaceholder && !isLpInvestorRole(investor_role)) {
      await upsertDealMemberForDeal(dealId, {
        contactMemberId: contactId,
        dealMemberRole: investor_role,
        sendInvitationMail,
        addedByUserId: user.id,
      });
    }
    await reconcileAssigningDealUsersForDeal(dealId, user.id);
    /* Invitation email only on explicit Save — not on debounced autosave (would spam). */
    if (!autosave && !contactIsPlaceholder) {
      await sendDealMemberInviteForInvestmentIfRequested({
        dealId,
        contactId,
        contactDisplayName: contactDisplayName.trim(),
        sendInvitationMail,
      });
    }
    const [investor] = await mapDealInvestmentsToInvestorApi([row]);
    console.log("[putDealInvestment] saved to database", {
      deal_investment: {
        id: row.id,
        deal_id: row.dealId,
        offering_id: row.offeringId,
        contact_id: row.contactId,
        contact_display_name: row.contactDisplayName,
        profile_id: row.profileId,
        investor_role: row.investor_role,
        status: row.status,
        investor_class: row.investorClass,
        doc_signed_date: row.docSignedDate,
        commitment_amount: row.commitmentAmount,
        extra_contribution_amounts: row.extraContributionAmounts,
        document_storage_path: row.documentStoragePath ?? null,
      },
      deal_member_upsert: {
        deal_id: dealId,
        added_by: user.id,
        contact_member_id: contactId,
        deal_member_role: investor_role,
        send_invitation_mail: sendInvitationMail,
      },
    });
    if (switchingBookProfile) {
      res.status(201).json({
        message: "Investment recorded for this profile; previous commitment row kept.",
        investor,
      });
    } else {
      res.status(200).json({
        message: "Investment updated",
        investor,
      });
    }
  } catch (err) {
    console.error("putDealInvestment:", err);
    res.status(500).json({ message: "Could not update investment" });
  }
}

export async function postDealInvestment(
  req: Request,
  res: Response,
): Promise<void> {
  const user = getJwtUser(req);
  if (!user?.id) {
    res.status(401).json({ message: "Authorization required" });
    return;
  }

  const dealId =
    typeof req.params.dealId === "string" ? req.params.dealId : req.params.dealId?.[0];
  if (!dealId) {
    res.status(400).json({ message: "Missing deal id" });
    return;
  }

  const b = req.body as Record<string, unknown>;
  const autosave = isAutosaveBody(b);
  const offeringId = bodyString(b.offering_id);
  let contactId = bodyString(b.contact_id);
  const contactDisplayName = bodyString(b.contact_display_name);
  const profileId = bodyString(b.profile_id);
  const userInvestorProfileId = bodyString(
    b.user_investor_profile_id ?? b.userInvestorProfileId,
  ).trim();
  const investor_role = bodyString(b.investor_role);

  const status = bodyString(b.status);
  const investorClass = bodyString(b.investor_class);
  const docSignedDate = bodyString(b.doc_signed_date) || null;
  let commitmentAmount = bodyString(b.commitment_amount);
  const extraContributionAmounts = parseExtras(b.extra_contribution_amounts);
  const sendInvitationMail = bodyString(b.send_invitation_mail);

  if (isLpInvestorRole(investor_role)) {
    res.status(400).json({
      message:
        "LP investors are stored in deal_lp_investor. Use POST /deals/:dealId/lp-investors (JSON), not POST .../investments.",
    });
    return;
  }

  if (autosave) {
    if (!contactId.trim()) {
      contactId = DEAL_INVESTMENT_AUTOSAVE_CONTACT_PLACEHOLDER;
    }
    if (!commitmentAmount.trim()) {
      commitmentAmount = "0";
    }
  } else {
    if (!contactId.trim()) {
      res.status(400).json({ message: "Member (contact) is required" });
      return;
    }
    if (!commitmentAmount.trim()) {
      res.status(400).json({ message: "Commitment amount is required" });
      return;
    }
  }

  const file = req.file;
  let documentStoragePath: string | null = null;

  try {
    const scope = await resolveDealViewerScope(user.id, user.userRole);
    if (!(await assertDealIdInViewerScope(dealId, scope))) {
      res.status(404).json({ message: "Deal not found" });
      return;
    }

    const classResolution =
      autosave && !investorClass.trim()
        ? await resolveFirstInvestorClassForDeal(dealId)
        : await resolveInvestorClassForDealInvestment(dealId, investorClass);
    if (!classResolution.ok) {
      res.status(400).json({ message: classResolution.message });
      return;
    }
    const resolvedInvestorClass = classResolution.storedInvestorClass;

    if (file && "buffer" in file && file.buffer && file.buffer.length > 0) {
      documentStoragePath = await saveSubscriptionDocument({
        dealId,
        file: {
          buffer: file.buffer,
          originalname: file.originalname || "document",
        },
      });
    }

    const row = await insertDealInvestment({
      dealId,
      input: {
        offeringId,
        contactId,
        contactDisplayName,
        profileId,
        userInvestorProfileId: userInvestorProfileId || null,
        investor_role,
        status,
        investorClass: resolvedInvestorClass,
        docSignedDate,
        commitmentAmount,
        extraContributionAmounts,
        documentStoragePath,
      },
    });

    const contactIsPlaceholder =
      contactId.trim() === DEAL_INVESTMENT_AUTOSAVE_CONTACT_PLACEHOLDER;
    if (!contactIsPlaceholder) {
      await upsertDealMemberForDeal(dealId, {
        contactMemberId: contactId,
        dealMemberRole: investor_role,
        sendInvitationMail,
        addedByUserId: user.id,
      });
    }
    await reconcileAssigningDealUsersForDeal(dealId, user.id);
    if (!autosave && !contactIsPlaceholder) {
      await sendDealMemberInviteForInvestmentIfRequested({
        dealId,
        contactId,
        contactDisplayName: contactDisplayName.trim(),
        sendInvitationMail,
      });
    }
    const [investor] = await mapDealInvestmentsToInvestorApi([row]);
    console.log("[postDealInvestment] saved to database", {
      deal_investment: {
        id: row.id,
        deal_id: row.dealId,
        offering_id: row.offeringId,
        contact_id: row.contactId,
        contact_display_name: row.contactDisplayName,
        profile_id: row.profileId,
        investor_role: row.investor_role,
        status: row.status,
        investor_class: row.investorClass,
        doc_signed_date: row.docSignedDate,
        commitment_amount: row.commitmentAmount,
        extra_contribution_amounts: row.extraContributionAmounts,
        document_storage_path: row.documentStoragePath ?? null,
      },
      deal_member_upsert: {
        deal_id: dealId,
        added_by: user.id,
        contact_member_id: contactId,
        deal_member_role: investor_role,
        send_invitation_mail: sendInvitationMail,
      },
    });
    res.status(201).json({
      message: "Investment recorded",
      investor,
    });
  } catch (err) {
    console.error("postDealInvestment:", err);
    res.status(500).json({ message: "Could not save investment" });
  }
}
