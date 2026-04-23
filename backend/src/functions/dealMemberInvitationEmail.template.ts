export type DealInvitationSource = "investor" | "deal_member"

export interface DealMemberInvitationTemplateVars {
  dealName: string
  memberDisplayName: string
  memberEmail: string
  /** Absolute URL to open this deal in the portal (from FRONTEND_URL / BASE_URL). */
  portalDealUrl: string
  /** Product / org line, e.g. from SENDER_DISPLAY_NAME */
  senderBrand: string
  /**
   * `investor` — email triggered from the Investors tab (framed as an **investor**).
   * `deal_member` — from Deal members tab; copy includes `dealMemberRoleLabel` from that tab’s Role.
   */
  invitationSource: DealInvitationSource
  /**
   * Human-readable deal role(s) e.g. “Sponsor, Investor” — set when `invitationSource` is
   * `deal_member` (from row Role column).
   */
  dealMemberRoleLabel: string
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function roleLine(v: DealMemberInvitationTemplateVars): string {
  if (v.invitationSource !== "deal_member") return ""
  const r = (v.dealMemberRoleLabel ?? "").trim()
  if (!r || r === "—") {
    return "You’ve been invited in a deal team role. Sign in to the investor portal to view this deal and next steps."
  }
  return `You’ve been invited to this deal with the following role: ${r}. Sign in to the investor portal to view the offering and next steps.`
}

function investorLine(): string {
  return "You’ve been invited to participate in this deal as an investor. Sign in to the investor portal to view the offering and next steps."
}

/** Plain-text body: Investors tab = investor; Deal members tab = includes role from that tab. */
export function buildDealMemberInvitationEmailText(
  v: DealMemberInvitationTemplateVars,
): string {
  const bodyIntro =
    v.invitationSource === "investor" ? investorLine() : roleLine(v)
  const lines = [
    `You're invited to ${v.dealName}`,
    "",
    v.memberDisplayName
      ? `Hello ${v.memberDisplayName},`
      : "Hello,",
    "",
    bodyIntro,
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

/** HTML body for investor invitation / notification emails. */
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

  const isInvestor = v.invitationSource === "investor"
  const pageTitle = isInvestor ? "Investor invitation" : "Deal invitation"
  const h1 = isInvestor
    ? `You're invited to invest`
    : `You're invited to the deal team`
  const bodyPara = isInvestor
    ? `<p style="font-size:16px;line-height:1.5;color:#333;">You’ve been invited to participate in <strong>${deal}</strong> <strong>as an investor</strong> through the investor portal.</p>`
    : (() => {
        const r = (v.dealMemberRoleLabel ?? "").trim()
        if (!r || r === "—") {
          return `<p style="font-size:16px;line-height:1.5;color:#333;">You’ve been invited to <strong>${deal}</strong> in a <strong>deal team</strong> role. Sign in to the investor portal to view the offering and next steps.</p>`
        }
        const roleEsc = escHtml(r)
        return `<p style="font-size:16px;line-height:1.5;color:#333;">You’ve been invited to <strong>${deal}</strong> with the following <strong>role</strong> (from the Deal members tab): <strong>${roleEsc}</strong>. Sign in to the investor portal to view the offering and next steps.</p>`
      })()

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(pageTitle)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;color:#333;">
<div style="max-width:600px;margin:20px auto;padding:30px;background:#ffffff;border-radius:8px;">
  <h1 style="color:#2463eb;font-size:22px;margin:0 0 16px;">${h1}</h1>
  <p style="font-size:16px;line-height:1.5;color:#333;">Hello ${name},</p>
  ${bodyPara}
  ${buttonBlock}
  <p style="font-size:14px;line-height:1.5;color:#64748b;">This message was sent to <strong>${email}</strong>.</p>
  <p style="font-size:14px;line-height:1.5;color:#64748b;margin-top:24px;">— ${brand}</p>
</div>
</body>
</html>`
}
