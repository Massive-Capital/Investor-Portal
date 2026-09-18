import { and, eq } from "drizzle-orm";
import { isPlatformAdminRole } from "../../constants/roles.js";
import { canInvestorAccessPublicOffering } from "../../constants/deal-lifecycle/deal-status-rules.js";
import { db } from "../../database/db.js";
import { users } from "../../schema/auth.schema/signin.js";
import { dealLpInvestor } from "../../schema/deal.schema/deal-lp-investor.schema.js";
import { resolvePublicPreviewDealId } from "../../utils/offeringPreviewCrypto.js";
import { dealSaasLockHttpPayload } from "../billing/dealBilling.service.js";
import { isDealAllowedByContactOfferingVisibility } from "../contact/contactOfferingVisibility.service.js";
import {
  isUserAssignedToDeal,
  reconcileAssigningDealUsersForDeal,
} from "./assigningDealUser.service.js";
import { getAddDealFormById } from "./dealForm.service.js";
import { resolveInvestNowViewerContactOnDeal } from "./dealInvestNowViewerContact.service.js";
import {
  isPortalUserDealSponsorOnDeal,
  isPortalUserOnDealMemberRoster,
} from "./dealMemberScope.service.js";

export type OfferingPreviewAccessGrantResult =
  | { ok: true; dealId: string }
  | { ok: false; status: 400 | 402 | 403 | 404; message: string };

/**
 * Converts a valid public-preview visit into access to this one offering.
 * This creates only an LP roster link; it never creates a deal-member/sponsor role.
 */
export async function grantOfferingPreviewInvestorAccess(params: {
  userId: string;
  previewToken: string;
}): Promise<OfferingPreviewAccessGrantResult> {
  const userId = String(params.userId ?? "").trim();
  const previewToken = String(params.previewToken ?? "").trim();
  if (!userId || !previewToken) {
    return { ok: false, status: 400, message: "Preview token is required." };
  }

  const dealId = resolvePublicPreviewDealId(previewToken);
  if (!dealId) {
    return { ok: false, status: 400, message: "Invalid preview link." };
  }

  const [user, deal] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        username: users.username,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .then((rows) => rows[0]),
    getAddDealFormById(dealId),
  ]);

  if (!user) {
    return { ok: false, status: 404, message: "User not found." };
  }
  if (!deal) {
    return { ok: false, status: 404, message: "Offering not found." };
  }
  if (
    deal.archived ||
    !canInvestorAccessPublicOffering(deal.dealStage, deal.offeringStatus)
  ) {
    return { ok: false, status: 403, message: "This offering is not available." };
  }
  if (await dealSaasLockHttpPayload(deal)) {
    return {
      ok: false,
      status: 402,
      message: "This offering is temporarily unavailable.",
    };
  }

  const emailNorm = String(user.email ?? "").trim().toLowerCase();
  if (
    !(await isDealAllowedByContactOfferingVisibility({
      emailNorm,
      dealId,
      secType: deal.secType,
    }))
  ) {
    return {
      ok: false,
      status: 403,
      message: "This offering is hidden by your contact preferences.",
    };
  }

  const resolved = await resolveInvestNowViewerContactOnDeal({
    dealId,
    viewerEmailNorm: emailNorm,
    viewerUserId: userId,
  });
  const contactMemberId = resolved.contactMemberId.trim();
  if (!contactMemberId) {
    return {
      ok: false,
      status: 400,
      message: "Could not link this offering to your account.",
    };
  }

  if (resolved.lpInvestorRow) {
    if (resolved.lpInvestorRow.isDraft) {
      await db
        .update(dealLpInvestor)
        .set({ isDraft: false, updatedAt: new Date() })
        .where(
          and(
            eq(dealLpInvestor.dealId, dealId),
            eq(dealLpInvestor.id, resolved.lpInvestorRow.id),
          ),
        );
      await reconcileAssigningDealUsersForDeal(dealId, userId);
    }
    return { ok: true, dealId };
  }

  if (
    isPlatformAdminRole(user.role) ||
    (await isPortalUserDealSponsorOnDeal(dealId, userId)) ||
    (await isPortalUserOnDealMemberRoster(dealId, userId)) ||
    (await isUserAssignedToDeal(userId, dealId))
  ) {
    return { ok: true, dealId };
  }

  {
    const investorName =
      [user.firstName, user.lastName]
        .map((part) => String(part ?? "").trim())
        .filter(Boolean)
        .join(" ") ||
      String(user.username ?? "").trim() ||
      emailNorm;

    await db
      .insert(dealLpInvestor)
      .values({
        dealId,
        investorName,
        addedBy: null,
        contactMemberId,
        email: emailNorm || null,
        role: "LP Investor",
        profileId: "",
        investorClass: "",
        sendInvitationMail: "no",
        isDraft: false,
        updatedAt: new Date(),
      })
      .onConflictDoNothing({
        target: [dealLpInvestor.dealId, dealLpInvestor.contactMemberId],
      });
  }

  await reconcileAssigningDealUsersForDeal(dealId, userId);
  return { ok: true, dealId };
}
