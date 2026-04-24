export const APP_DOCUMENT_TITLE_PREFIX = "Investor Portal LLC"

export function formatAppDocumentTitle(pageLabel: string): string {
  const t = pageLabel.trim()
  if (!t) return APP_DOCUMENT_TITLE_PREFIX
  return `${APP_DOCUMENT_TITLE_PREFIX} | ${t}`
}

export type SetAppDocumentTitleOptions = {
  /**
   * When true, sets `document.title` to `pageLabel` only (no
   * `Investor Portal LLC |` prefix). Use for public offering preview / share
   * surfaces where the title should read as a single phrase.
   */
  plain?: boolean
}

export function setAppDocumentTitle(
  pageLabel: string,
  options?: SetAppDocumentTitleOptions,
): void {
  const t = pageLabel.trim()
  if (options?.plain) {
    document.title = t || APP_DOCUMENT_TITLE_PREFIX
    return
  }
  document.title = formatAppDocumentTitle(t)
}

function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/"))
    return pathname.slice(0, -1)
  return pathname
}

/** Page label for routes rendered inside `PageLayout` (no prefix). */
export function pageTitleForAppPathname(
  pathname: string,
  search = "",
): string {
  const p = normalizePathname(pathname)

  if (p === "/" || p === "") return "Dashboard"

  if (p === "/deals/create") {
    const qs = search.startsWith("?")
      ? search
      : search
        ? `?${search}`
        : ""
    const editId = new URLSearchParams(qs).get("edit")?.trim()
    return editId ? "Edit deal" : "Create deal"
  }

  const exact: Record<string, string> = {
    "/company": "Company",
    "/customers": "Customers",
    "/billing": "Billing",
    "/members": "Members",
    "/contacts": "All contacts",
    "/leads": "Leads",
    "/deals": "My deals",
    "/deals/investor-emails": "Investor emails",
    "/deals/reporting": "Reporting",
    "/investing/opportunities": "Opportunities",
    "/investing/investments": "Investments",
    "/investing/documents": "Documents",
    "/investing/profiles": "Profiles",
    "/investing/profiles/add": "Add profile",
    "/investing/deals": "Deals",
    "/investing/company": "Company overview",
    "/investing/cashflows": "Cashflows",
    "/investing/settings": "Settings",
    "/investing/review": "Leave a review",
    "/account": "My account",
    "/refer-a-friend": "Refer a friend",
    "/support": "Support",
  }

  if (exact[p]) return exact[p]

  if (/^\/customers\/[^/]+\/members$/.test(p)) return "Company members"

  if (/^\/customers\/[^/]+\/deals$/.test(p)) return "Company deals"

  if (/^\/deals\/[^/]+$/.test(p)) return "Deal"

  if (/^\/investing\/investments\/[^/]+$/.test(p)) return "Investment"

  if (/^\/investing\/profiles\/[^/]+\/edit$/.test(p)) return "Edit profile"

  return "Investor Portal"
}
