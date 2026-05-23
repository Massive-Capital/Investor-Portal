import { getLpInvestorDealIdsFromSession } from "@/common/auth/roleUtils"
import { getSessionUserEmail } from "@/common/auth/sessionUserEmail"
import { fetchDealInvestorClasses, fetchDealInvestors } from "@/modules/Syndication/Deals/api/dealsApi"
import type { DealInvestorRow } from "@/modules/Syndication/Deals/types/deal-investors.types"
import type { InvestmentDocumentAudienceContext } from "./investmentDocumentAudience"

function normEmail(s: string): string {
  return s.trim().toLowerCase()
}

/** All deal investor rows for this login (any commitment amount). */
function viewerRowsForEmail(
  investors: DealInvestorRow[],
  viewerEmailNorm: string,
): DealInvestorRow[] {
  return investors.filter(
    (inv) => normEmail(String(inv.userEmail ?? "")) === viewerEmailNorm,
  )
}

function collectViewerInvestorIds(
  investors: DealInvestorRow[],
  viewerEmailNorm: string,
): Set<string> {
  const ids = new Set<string>()
  for (const inv of investors) {
    if (normEmail(String(inv.userEmail ?? "")) !== viewerEmailNorm) continue
    const id = inv.id?.trim()
    if (id) ids.add(id)
    const contactId = inv.contactId?.trim()
    if (contactId) ids.add(contactId)
  }
  return ids
}

function mergeInvestorLists(
  a: DealInvestorRow[],
  b: DealInvestorRow[],
): DealInvestorRow[] {
  const byId = new Map<string, DealInvestorRow>()
  for (const row of [...a, ...b]) {
    const id = row.id?.trim()
    if (id) byId.set(id, row)
  }
  return [...byId.values()]
}

function sessionIncludesDeal(dealId: string): boolean {
  const key = dealId.trim().toLowerCase()
  if (!key) return false
  return getLpInvestorDealIdsFromSession().some(
    (id) => id.trim().toLowerCase() === key,
  )
}

/**
 * Viewer context for Shared With on the deal Documents tab:
 * investors, classes, and sponsor-added LPs this user represents on the deal.
 */
export async function buildInvestmentDocumentAudience(
  dealId: string,
): Promise<InvestmentDocumentAudienceContext | null> {
  const id = dealId.trim()
  if (!id) return null
  const em = getSessionUserEmail()
  if (!em?.trim()) return null
  const emn = normEmail(em)
  const [fullPayload, lpPayload, dealClasses] = await Promise.all([
    fetchDealInvestors(id, { lpInvestorsOnly: false }),
    fetchDealInvestors(id, { lpInvestorsOnly: true }),
    fetchDealInvestorClasses(id),
  ])
  const allInvestors = mergeInvestorLists(
    fullPayload.investors,
    lpPayload.investors,
  )
  let viewerRows = viewerRowsForEmail(allInvestors, emn)
  if (viewerRows.length === 0) {
    viewerRows = viewerRowsForEmail(lpPayload.investors, emn)
  }
  const viewerInvestorIds = collectViewerInvestorIds(allInvestors, emn)

  if (viewerRows.length > 0 || viewerInvestorIds.size > 0) {
    return { viewerRows, dealClasses, viewerInvestorIds }
  }

  if (sessionIncludesDeal(id)) {
    return { viewerRows: [], dealClasses, viewerInvestorIds }
  }

  return null
}
