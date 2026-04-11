import type { Request, Response } from "express";
import { getJwtUser } from "../../middleware/jwtUser.js";
import {
  assertDealIdInViewerScope,
  resolveDealViewerScope,
} from "../../services/dealAccess.service.js";
import {
  deleteDealMemberRosterEntry,
  listDealMembersMappedToInvestorApi,
} from "../../services/dealMember.service.js";
import { sendDealMemberInvitationEmail } from "../../services/dealMemberInvitationEmail.service.js";

/**
 * GET /deals/:dealId/members — roster from `deal_member`, merged with latest
 * `deal_investment` per contact for amounts/dates.
 */
export async function getDealMembers(
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
    const members = await listDealMembersMappedToInvestorApi(dealId);
    res.status(200).json({ members });
  } catch (err) {
    console.error("getDealMembers:", err);
    res.status(500).json({ message: "Could not load deal members" });
  }
}

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
 * POST /deals/:dealId/members/send-invitation-email
 * Body: { to_email: string, member_display_name?: string }
 * Sends the deal-member invitation template using SMTP / env from `.env.local`.
 */
export async function postDealMemberInvitationEmail(
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
  const toEmail = bodyString(b.to_email ?? b.toEmail);
  const memberDisplayName = bodyString(b.member_display_name ?? b.memberDisplayName);

  if (!toEmail.trim() || !toEmail.includes("@")) {
    res.status(400).json({ message: "Valid to_email is required" });
    return;
  }

  try {
    const scope = await resolveDealViewerScope(user.id, user.userRole);
    if (!(await assertDealIdInViewerScope(dealId, scope))) {
      res.status(404).json({ message: "Deal not found" });
      return;
    }

    const result = await sendDealMemberInvitationEmail({
      dealId,
      toEmail: toEmail.trim(),
      memberDisplayName: memberDisplayName.trim() || undefined,
    });

    if (!result.ok) {
      const msg =
        result.error instanceof Error
          ? result.error.message
          : "Could not send email";
      res.status(502).json({ message: msg });
      return;
    }

    res.status(200).json({ message: "Invitation email sent" });
  } catch (err) {
    console.error("postDealMemberInvitationEmail:", err);
    res.status(500).json({ message: "Could not send invitation email" });
  }
}

/**
 * DELETE /deals/:dealId/members/:rowId — remove member from roster (investment id or deal_member id).
 */
export async function deleteDealMember(
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
  const rowId =
    typeof req.params.rowId === "string"
      ? req.params.rowId
      : req.params.rowId?.[0];
  if (!dealId?.trim() || !rowId?.trim()) {
    res.status(400).json({ message: "Missing deal id or row id" });
    return;
  }
  try {
    const scope = await resolveDealViewerScope(user.id, user.userRole);
    if (!(await assertDealIdInViewerScope(dealId, scope))) {
      res.status(404).json({ message: "Deal not found" });
      return;
    }
    const result = await deleteDealMemberRosterEntry(dealId, rowId);
    if (!result.ok) {
      res.status(404).json({ message: result.message });
      return;
    }
    res.status(200).json({ message: "Member removed" });
  } catch (err) {
    console.error("deleteDealMember:", err);
    res.status(500).json({ message: "Could not remove member" });
  }
}
