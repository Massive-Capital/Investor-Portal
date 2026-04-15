export interface DealMemberInvitationTemplateVars {
  dealName: string
  memberDisplayName: string
  memberEmail: string
  /** Absolute URL to open this deal in the portal (from FRONTEND_URL / BASE_URL). */
  portalDealUrl: string
  /** Product / org line, e.g. from SENDER_DISPLAY_NAME */
  senderBrand: string
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/** Plain-text body for deal-member invitation / notification emails. */
export function buildDealMemberInvitationEmailText(
  v: DealMemberInvitationTemplateVars,
): string {
  const lines = [
    `You've been added to ${v.dealName}`,
    "",
    v.memberDisplayName
      ? `Hello ${v.memberDisplayName},`
      : "Hello,",
    "",
    "You've been added as a member on this deal in the investor portal.",
    v.portalDealUrl
      ? `Open the deal: ${v.portalDealUrl}`
      : "Sign in to the investor portal to view details.",
    "",
    `This message was sent to: ${v.memberEmail}`,
    "",
    `— ${v.senderBrand}`,
  ]
  return lines.join("\n")
}

/** HTML body for deal-member invitation / notification emails. */
export function buildDealMemberInvitationEmailHtml(
  v: DealMemberInvitationTemplateVars,
): string {
  const deal = escHtml(v.dealName)
  const name = escHtml(v.memberDisplayName || "there")
  const email = escHtml(v.memberEmail)
  const brand = escHtml(v.senderBrand)
  const url = v.portalDealUrl
  const href = escHtml(url)
  const buttonBlock = url
    ? `<div style="margin:20px 0;">
  <a href="${href}" style="background-color:#2463eb;color:#ffffff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">Continue to portal</a>
</div>`
    : `<p style="font-size:14px;line-height:1.5;color:#64748b;">Sign in to the investor portal to view this deal.</p>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Deal membership</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;color:#333;">
<div style="max-width:600px;margin:20px auto;padding:30px;background:#ffffff;border-radius:8px;">
  <h1 style="color:#2463eb;font-size:22px;margin:0 0 16px;">You've been added to a deal</h1>
  <p style="font-size:16px;line-height:1.5;color:#333;">Hello ${name},</p>
  <p style="font-size:16px;line-height:1.5;color:#333;">You've been added as a member on <strong>${deal}</strong> in the investor portal.</p>
  ${buttonBlock}
  <p style="font-size:14px;line-height:1.5;color:#64748b;">This message was sent to <strong>${email}</strong>.</p>
  <p style="font-size:14px;line-height:1.5;color:#64748b;margin-top:24px;">— ${brand}</p>
</div>
</body>
</html>`
}
