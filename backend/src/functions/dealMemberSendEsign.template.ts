import {
  buildSyndicationXEmailBrandHeaderHtml,
  buildSyndicationXEmailFooterHtml,
  SX_EMAIL_BUTTON_STYLE,
  SX_EMAIL_MUTED,
  SX_EMAIL_PAGE_BG,
  SX_EMAIL_PRIMARY,
} from "./emailSyndicationXLayout.js";

export interface DealMemberSendEsignTemplateVars {
  dealName: string;
  memberDisplayName: string;
  memberEmail: string;
  portalDealUrl: string;
  /** Portal route that opens hellosign-embedded with client_id (required for signing). */
  signPageUrl?: string;
  senderBrand: string;
  documentNames?: string[];
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildDealMemberSendEsignEmailHtml(
  v: DealMemberSendEsignTemplateVars,
): string {
  const name = v.memberDisplayName.trim() || "there";
  const deal = escHtml(v.dealName.trim() || "this deal");
  const signPageUrl = escHtml(v.signPageUrl?.trim() ?? "");
  const portalUrl = escHtml(v.portalDealUrl.trim());
  const brandPlain = v.senderBrand.trim() || "SyndicationX";
  const brand = escHtml(brandPlain);
  const ctaHref = signPageUrl || portalUrl;
  const cta = ctaHref
    ? `<p style="margin:24px 0 0;text-align:center;">
         <a href="${ctaHref}" style="${SX_EMAIL_BUTTON_STYLE}">Sign documents</a>
       </p>`
    : "";
  const docNames = (v.documentNames ?? []).map((n) => n.trim()).filter(Boolean);
  const docsBlock =
    docNames.length > 0
      ? `<ul style="margin:0 0 16px;padding-left:1.25em;">${docNames
          .map((n) => `<li>${escHtml(n)}</li>`)
          .join("")}</ul>`
      : "";
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:${SX_EMAIL_PAGE_BG};font-family:Inter,Segoe UI,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;">
        ${buildSyndicationXEmailBrandHeaderHtml()}
        <tr><td style="padding:28px 32px;color:${SX_EMAIL_PRIMARY};font-size:15px;line-height:1.55;">
          <p style="margin:0 0 16px;">Hi ${escHtml(name)},</p>
          <p style="margin:0 0 16px;">
            Your eSign documents for <strong>${deal}</strong> are ready. Sign in to ${brand} to review and complete signing.
          </p>
          ${docsBlock}
          ${cta}
          <p style="margin:24px 0 0;font-size:13px;color:${SX_EMAIL_MUTED};">
            If you have questions, contact your deal sponsor.
          </p>
        </td></tr>
        ${buildSyndicationXEmailFooterHtml(brandPlain)}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function buildDealMemberSendEsignEmailText(
  v: DealMemberSendEsignTemplateVars,
): string {
  const name = v.memberDisplayName.trim() || "there";
  const deal = v.dealName.trim() || "this deal";
  const url = v.portalDealUrl.trim();
  const docNames = (v.documentNames ?? []).map((n) => n.trim()).filter(Boolean);
  const lines = [
    `Hi ${name},`,
    "",
    `Your eSign documents for ${deal} are ready. Sign in to ${v.senderBrand.trim() || "SyndicationX"} to review and complete signing.`,
  ];
  if (docNames.length > 0) {
    lines.push("", "Documents:");
    for (const n of docNames) lines.push(`- ${n}`);
  }
  const signPage = v.signPageUrl?.trim();
  if (signPage) lines.push("", `Sign documents: ${signPage}`);
  else if (url) lines.push("", `Open deal: ${url}`);
  lines.push("", "If you have questions, contact your deal sponsor.");
  return lines.join("\n");
}
