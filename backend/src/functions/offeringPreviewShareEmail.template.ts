export interface OfferingPreviewShareTemplateVars {
  dealName: string
  /** Public offering preview URL (no login). */
  previewUrl: string
  senderBrand: string
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function buildOfferingPreviewShareEmailText(
  v: OfferingPreviewShareTemplateVars,
): string {
  const lines = [
    `Offering preview: ${v.dealName}`,
    "",
    "You can view this investment offering without signing in:",
    v.previewUrl,
    "",
    `— ${v.senderBrand}`,
  ]
  return lines.join("\n")
}

export function buildOfferingPreviewShareEmailHtml(
  v: OfferingPreviewShareTemplateVars,
): string {
  const name = escHtml(v.dealName)
  const url = escHtml(v.previewUrl)
  const brand = escHtml(v.senderBrand)
  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#0f172a;">
<p style="margin:0 0 12px;font-size:16px;font-weight:600;">Offering preview: ${name}</p>
<p style="margin:0 0 12px;">You can view this investment offering without signing in:</p>
<p style="margin:0 0 16px;"><a href="${url}" style="color:#2563eb;">${url}</a></p>
<p style="margin:0;font-size:13px;color:#64748b;">— ${brand}</p>
</body></html>`
}
