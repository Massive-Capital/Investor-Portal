/**
 * Shared SyndicationX transactional email chrome — inline styles for broad client support.
 * Primary CTA blue matches existing invitation / auth mail buttons (#2463eb).
 */

export const SX_EMAIL_PRIMARY = "#00477a";

/** Primary action button (filled blue, white label). */
export const SX_EMAIL_BUTTON_STYLE = `background-color:${SX_EMAIL_PRIMARY};color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block;border:0;box-shadow:0 2px 8px rgba(36,99,235,0.28);`;

/** Subtle secondary text */
export const SX_EMAIL_MUTED = "#64748b";

/** Card / page background */
export const SX_EMAIL_PAGE_BG = "#f4f6f8";

/**
 * Logo shipped with the SPA at `frontend/public/email-assets/sx_logo_width_reduced.png`
 * (same asset as `frontend/src/assets/images/sx_logo_width_reduced.png`).
 * Resolved as `${origin}/email-assets/sx_logo_width_reduced.png` unless {@link process.env.EMAIL_LOGO_URL} is set.
 */
const EMAIL_LOGO_PATH = "/email-assets/sx_logo_width_reduced.png";

function syndicationXEmailAssetsOrigin(): string {
  const candidates = [
    process.env.EMAIL_ASSETS_BASE_URL,
    process.env.FRONTEND_URL,
    process.env.BASE_URL,
    process.env.APP_URL,
    process.env.CLIENT_URL,
    process.env.PUBLIC_APP_URL,
    process.env.VITE_BASE_URL,
  ];
  for (const raw of candidates) {
    const t = String(raw ?? "").trim();
    if (t) return t.replace(/\/$/, "");
  }
  return "";
}

function escapeAttrUrl(u: string): string {
  return u.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Centered logo `<img>` for HTML mail; empty string if no absolute URL can be built. */
export function buildSyndicationXEmailLogoImgHtml(): string {
  const override = process.env.EMAIL_LOGO_URL?.trim();
  const origin = syndicationXEmailAssetsOrigin();
  const src = override || (origin ? `${origin}${EMAIL_LOGO_PATH}` : "");
  if (!src) return "";
  return `<div style="text-align:center;margin:20px 0 4px 0;">
  <img src="${escapeAttrUrl(src)}" width="220" alt="SyndicationX" style="max-width:min(240px,88vw);height:auto;display:block;margin:0 auto;border:0;outline:none;text-decoration:none;" />
</div>`;
}

/** Wordmark + tagline under a light divider (UX: immediate brand recognition). */
export function buildSyndicationXEmailBrandHeaderHtml(): string {
  return `<div style="margin:0 0 22px 0;padding-bottom:18px;border-bottom:1px solid #e2e8f0;">
  <span style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:700;color:${SX_EMAIL_PRIMARY};letter-spacing:-0.03em;">SyndicationX</span>
</div>`;
}

export function buildSyndicationXEmailFooterHtml(senderBrandEsc: string): string {
  const logo = buildSyndicationXEmailLogoImgHtml();
  return `<p style="font-size:14px;line-height:1.5;color:${SX_EMAIL_MUTED};margin-top:28px;padding-top:20px;border-top:1px solid #f1f5f9;font-family:Arial,Helvetica,sans-serif;">— ${senderBrandEsc}</p>
${logo}
<p style="font-size:11px;line-height:1.45;color:#94a3b8;margin:16px 0 0 0;font-family:Arial,Helvetica,sans-serif;">You received this email because of activity on SyndicationX.</p>`;
}

/** Closing block for invite / password-reset flows (no workspace sender line). */
export function buildSyndicationXEmailAuthFooterHtml(): string {
  const logo = buildSyndicationXEmailLogoImgHtml();
  return `<p style="font-size:16px;line-height:1.5;color:#1e293b;margin-top:28px;padding-top:20px;border-top:1px solid #f1f5f9;font-family:Arial,Helvetica,sans-serif;">Thanks,<br><span style="color:#475569;font-weight:600;">The SyndicationX team</span></p>
${logo}
<p style="font-size:11px;line-height:1.45;color:#94a3b8;margin:16px 0 0 0;font-family:Arial,Helvetica,sans-serif;text-align:center;">© 2026 SyndicationX · All rights reserved</p>`;
}
