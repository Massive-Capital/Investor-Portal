import emailConfig, {
  outgoingMailCcBcc,
  smtpEnvelopeForSendMail,
} from "../../functions/emailconfig.js";
import {
  buildDealMemberSendEsignEmailHtml,
  buildDealMemberSendEsignEmailText,
} from "../../functions/dealMemberSendEsign.template.js";
import { getAddDealFormById } from "./dealForm.service.js";
import { buildDealMemberInviteLandingUrl } from "./dealMemberInviteToken.service.js";
import { buildDealInvestorEsignSignPageUrl } from "./dealInvestorEsignSignPageUrl.service.js";

const SENDER_DISPLAY_NAME =
  process.env.SENDER_DISPLAY_NAME?.trim() || "SyndicationX";

export interface SendDealMemberSendEsignParams {
  dealId: string;
  toEmail: string;
  memberDisplayName?: string;
  documentNames?: string[];
  /** @deprecated Raw Dropbox sign_url must not be emailed — use signPageUrl. */
  signUrl?: string;
}

export async function sendDealMemberSendEsignEmail(
  params: SendDealMemberSendEsignParams,
): Promise<{ ok: true } | { ok: false; error: unknown }> {
  const to = params.toEmail.trim().toLowerCase();
  if (!to.includes("@")) {
    return { ok: false, error: new Error("Invalid recipient email") };
  }

  const deal = await getAddDealFormById(params.dealId);
  const dealName = deal?.dealName?.trim() || "this deal";
  const memberDisplayName = params.memberDisplayName?.trim() || "";
  const portalUrl =
    (await buildDealMemberInviteLandingUrl(params.dealId, to)) || "";
  const signPageUrl = await buildDealInvestorEsignSignPageUrl(
    params.dealId,
    to,
  );

  try {
    const transporter = emailConfig();
    const fromAddress = process.env.SENDER_EMAIL_ID?.trim() || "";
    if (!fromAddress) {
      return {
        ok: false,
        error: new Error("SENDER_EMAIL_ID is not configured"),
      };
    }

    const subject =
      process.env.DEAL_MEMBER_ESIGN_SUBJECT?.trim()?.replace(
        /\{dealName\}/g,
        dealName,
      ) || `eSign documents ready — ${dealName}`;

    const documentNames = (params.documentNames ?? [])
      .map((n) => n.trim())
      .filter(Boolean);

    const templateVars = {
      dealName,
      memberDisplayName,
      memberEmail: to,
      portalDealUrl: portalUrl,
      signPageUrl: signPageUrl || portalUrl || undefined,
      senderBrand: SENDER_DISPLAY_NAME,
      documentNames,
    };

    const ccBcc = outgoingMailCcBcc();
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
      subject,
      text: buildDealMemberSendEsignEmailText(templateVars),
      html: buildDealMemberSendEsignEmailHtml(templateVars),
    });

    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}
