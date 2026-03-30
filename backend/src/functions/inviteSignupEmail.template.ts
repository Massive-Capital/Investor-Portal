function humanizeInviteExpiry(expiresIn: string): string {
  const m = /^(\d+)\s*d$/i.exec(expiresIn.trim());
  if (m) {
    const n = Number.parseInt(m[1], 10);
    if (Number.isFinite(n)) return `${n} day${n === 1 ? "" : "s"}`;
  }
  return expiresIn;
}

/** Plain-text body for the invite email (deliverability / plain clients). */
export function buildInviteSignupEmailText(
  inviteeEmail: string,
  signupLink: string,
  expiresDescription: string,
): string {
  const human = humanizeInviteExpiry(expiresDescription);
  return [
    "You're invited to Investor Portal",
    "",
    "An administrator invited you to create your account. Open this link to accept and complete registration:",
    signupLink,
    "",
    `This link expires in ${human}. If you did not expect this email, you can ignore it.`,
    "",
    `This invitation was sent to: ${inviteeEmail}`,
    "",
    "Thanks,",
    "The Investor Portal Team",
  ].join("\n");
}

/** HTML body for the invite / signup confirmation email. */
export function buildInviteSignupEmailHtml(
  inviteeEmail: string,
  signupLink: string,
  expiresDescription: string,
): string {
  const human = humanizeInviteExpiry(expiresDescription);
  const esc = human.replace(/</g, "&lt;");
  const escEmail = inviteeEmail.replace(/</g, "&lt;");
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>You're invited</title>
<style>
  body { font-family: Arial, sans-serif; margin:0; padding:0; background:#f4f6f8; color:#333333; }
  .container { max-width: 600px; margin: 20px auto; padding: 30px; background: #ffffff; border-radius: 8px; color:#333333; }
  h1 { color: #2463eb; }
  p { font-size:16px; line-height:1.5; color:#333333; }
  .button-container { margin:20px 0; }
  .confirm-button { background-color: #2463eb; color:#ffffff; padding:14px 28px; border-radius:6px; text-decoration:none; font-weight:bold; display:inline-block; }
  .footer { font-size:12px; color:#666666; margin-top:20px; text-align:center; }
</style>
</head>
<body style="font-family: Arial, sans-serif; margin:0; padding:0; background:#f4f6f8; color:#333333;">
<div class="container" style="max-width: 600px; margin: 20px auto; padding: 30px; background: #ffffff; border-radius: 8px; color:#333333;">
  <h1 style="color: #2463eb;">You're invited to Investor Portal</h1>
  <p style="font-size:16px; line-height:1.5; color:#333333;">An administrator invited you to create your account. Click the button below to confirm and complete registration.</p>
  <div class="button-container" style="margin:20px 0;">
    <a href="${signupLink}" class="confirm-button" style="background-color: #2463eb; color:#ffffff; padding:14px 28px; border-radius:6px; text-decoration:none; font-weight:bold; display:inline-block;">Accept invitation</a>
  </div>
  <p style="font-size:16px; line-height:1.5; color:#333333;">This link expires in <strong>${esc}</strong>. If you did not expect this email, you can ignore it.</p>
  <p style="font-size:14px; line-height:1.5; color:#64748b;">This invitation was sent to <strong>${escEmail}</strong>.</p>
  <p style="font-size:16px; line-height:1.5; color:#333333;">Thanks,<br>The Investor Portal Team</p>
  <div class="footer" style="font-size:12px; color:#666666; margin-top:20px; text-align:center;">&copy; 2026 Investor Portal LLC. All rights reserved.</div>
</div>
</body>
</html>`;
}
