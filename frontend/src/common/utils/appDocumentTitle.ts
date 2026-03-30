export const APP_DOCUMENT_TITLE_PREFIX = "Investor Portal LLC"

export function formatAppDocumentTitle(pageLabel: string): string {
  const t = pageLabel.trim()
  if (!t) return APP_DOCUMENT_TITLE_PREFIX
  return `${APP_DOCUMENT_TITLE_PREFIX} | ${t}`
}

export function setAppDocumentTitle(pageLabel: string): void {
  document.title = formatAppDocumentTitle(pageLabel)
}

function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/"))
    return pathname.slice(0, -1)
  return pathname
}

/** Page label for routes rendered inside `PageLayout` (no prefix). */
export function pageTitleForAppPathname(pathname: string): string {
  const p = normalizePathname(pathname)

  if (p === "/" || p === "") return "Dashboard"

  const exact: Record<string, string> = {
    "/company": "Company",
    "/billing": "Billing",
    "/members": "Members",
    "/deals": "My deals",
    "/deals/create": "Create deal",
    "/deals/investor-emails": "Investor emails",
    "/deals/reporting": "Reporting",
    "/investing/opportunities": "Opportunities",
    "/investing/investments": "Investments",
    "/investing/documents": "Documents",
    "/investing/profiles": "Profiles",
    "/investing/deals": "Deals",
    "/investing/settings": "Settings",
    "/investing/review": "Leave a review",
    "/account": "My account",
    "/refer-a-friend": "Refer a friend",
    "/support": "Support",
  }

  if (exact[p]) return exact[p]

  if (/^\/deals\/[^/]+$/.test(p)) return "Deal"

  return "Investor Portal"
}
