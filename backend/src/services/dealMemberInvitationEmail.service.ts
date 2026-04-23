import { eq } from "drizzle-orm";
import emailConfig, {
  outgoingMailCcBcc,
  smtpEnvelopeForSendMail,
} from "../functions/emailconfig.js";
import {
  type DealInvitationSource,
  buildDealMemberInvitationEmailHtml,
  buildDealMemberInvitationEmailText,
} from "../functions/dealMemberInvitationEmail.template.js";
import { db } from "../database/db.js";
import { users } from "../schema/auth.schema/signin.js";
import { contact } from "../schema/contact.schema.js";
import { getAddDealFormById } from "./dealForm.service.js";
import { buildDealMemberInviteLandingUrl } from "./dealMemberInviteToken.service.js";

const SENDER_DISPLAY_NAME =
  process.env.SENDER_DISPLAY_NAME?.trim() || "Investor Portal";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function defaultSubject(
  dealName: string,
  source: DealInvitationSource,
  dealMemberRoleLabel: string,
): string {
  const custom = process.env.DEAL_MEMBER_INVITE_SUBJECT?.trim();
  if (custom) return custom.replace(/\{dealName\}/g, dealName);
  if (source === "investor") {
    return `You're invited to ${dealName} as an investor`;
  }
  const r = dealMemberRoleLabel.trim();
  if (r && r !== "—") {
    return `You're invited to ${dealName} — ${r}`;
  }
  return `You're invited to ${dealName} (deal team)`;
}

/**
 * Resolves an email for a `contact_id` / portal user id stored on `deal_investment`.
 */
export async function resolveEmailForContactMemberId(
  contactMemberId: string,
): Promise<string | null> {
  const id = contactMemberId.trim();
  if (!id) return null;
  if (id.includes("@")) {
    const lower = id.toLowerCase();
    return lower.includes("@") ? lower : null;
  }
  if (!UUID_RE.test(id)) return null;

  const [u] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  const fromUser = u?.email?.trim().toLowerCase();
  if (fromUser?.includes("@")) return fromUser;

  const [c] = await db
    .select({ email: contact.email })
    .from(contact)
    .where(eq(contact.id, id))
    .limit(1);
  const fromContact = c?.email?.trim().toLowerCase();
  if (fromContact?.includes("@")) return fromContact;

  return null;
}

export interface SendDealMemberInvitationParams {
  dealId: string
  toEmail: string
  memberDisplayName?: string
  /**
   * `investor` — from Investors tab; `deal_member` — from Deal members (email names the tab Role).
   */
  invitationSource: DealInvitationSource
  /** Shown in subject/body when `invitationSource` is `deal_member`. */
  dealMemberRoleLabel: string
}

export async function sendDealMemberInvitationEmail(
  params: SendDealMemberInvitationParams,
): Promise<{ ok: true } | { ok: false; error: unknown }> {
  const to = params.toEmail.trim().toLowerCase();
  if (!to.includes("@")) {
    return { ok: false, error: new Error("Invalid recipient email") };
  }

  const deal = await getAddDealFormById(params.dealId);
  const dealName = deal?.dealName?.trim() || "this deal";
  const memberDisplayName = params.memberDisplayName?.trim() || "";
  const invitationSource = params.invitationSource;
  const dealMemberRoleLabel = (params.dealMemberRoleLabel ?? "").trim();
  const portalUrl =
    (await buildDealMemberInviteLandingUrl(params.dealId, to)) || "";

  try {
    const transporter = emailConfig();
    const fromAddress = process.env.SENDER_EMAIL_ID?.trim() || "";
    if (!fromAddress) {
      return {
        ok: false,
        error: new Error(
          "SENDER_EMAIL_ID must be set (configure SMTP in .env.local).",
        ),
      };
    }

    const ccBcc = outgoingMailCcBcc();
    const html = buildDealMemberInvitationEmailHtml({
      dealName,
      memberDisplayName,
      memberEmail: to,
      portalDealUrl: portalUrl,
      senderBrand: SENDER_DISPLAY_NAME,
      invitationSource,
      dealMemberRoleLabel,
    });
    const text = buildDealMemberInvitationEmailText({
      dealName,
      memberDisplayName,
      memberEmail: to,
      portalDealUrl: portalUrl,
      senderBrand: SENDER_DISPLAY_NAME,
      invitationSource,
      dealMemberRoleLabel,
    });

    await transporter.sendMail({
      from: {
        name: SENDER_DISPLAY_NAME,
        address: fromAddress,
      },
      to,
      ...ccBcc,
      envelope: smtpEnvelopeForSendMail({
        fromAddress,
        to,
        cc: ccBcc.cc,
        bcc: ccBcc.bcc,
      }),
      subject: defaultSubject(dealName, invitationSource, dealMemberRoleLabel),
      text,
      html,
    });
    return { ok: true };
  } catch (error: unknown) {
    return { ok: false, error };
  }
}

/** After saving an investment: notify the investor by email when the form asked for it. */
export async function sendDealMemberInviteForInvestmentIfRequested(input: {
  dealId: string
  contactId: string
  contactDisplayName: string
  sendInvitationMail: string
}): Promise<void> {
  if (String(input.sendInvitationMail).toLowerCase() !== "yes") return;
  const to = await resolveEmailForContactMemberId(input.contactId);
  if (!to) {
    console.warn(
      "sendDealMemberInviteForInvestmentIfRequested: no email for contact",
      input.contactId,
    );
    return;
  }
  const result = await sendDealMemberInvitationEmail({
    dealId: input.dealId,
    toEmail: to,
    memberDisplayName: input.contactDisplayName,
    invitationSource: "investor",
    dealMemberRoleLabel: "",
  });
  if (!result.ok) {
    console.warn(
      "sendDealMemberInviteForInvestmentIfRequested: send failed",
      result.error,
    );
  }
}
