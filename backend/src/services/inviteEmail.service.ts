import emailConfig from "../functions/emailconfig.js";
import {
  buildInviteSignupEmailHtml,
  buildInviteSignupEmailText,
} from "../functions/inviteSignupEmail.template.js";

const SENDER_DISPLAY_NAME =
  process.env.SENDER_DISPLAY_NAME?.trim() || "Investor Portal";

export async function sendInviteSignupEmail(
  toEmail: string,
  signupUrl: string,
  expiresDescription: string,
): Promise<{ ok: true } | { ok: false; error: unknown }> {
  const to = toEmail.trim().toLowerCase();
  if (!to || !to.includes("@")) {
    return { ok: false, error: new Error("Invalid invitee email address") };
  }

  try {
    const transporter = emailConfig();
    const fromAddress = process.env.SENDER_EMAIL_ID?.trim() || "";
    if (!fromAddress) {
      return {
        ok: false,
        error: new Error(
          "SENDER_EMAIL_ID must be set (From address for invite emails).",
        ),
      };
    }

    await transporter.sendMail({
      from: {
        name: SENDER_DISPLAY_NAME,
        address: fromAddress,
      },
      to,
      subject: "You're invited to Investor Portal",
      text: buildInviteSignupEmailText(to, signupUrl, expiresDescription),
      html: buildInviteSignupEmailHtml(to, signupUrl, expiresDescription),
    });
    return { ok: true };
  } catch (error: unknown) {
    return { ok: false, error };
  }
}
