import { getSessionUserEmail } from "@/common/auth/sessionUserEmail"
import { isLpInvestorSessionUser, isPlatformAdmin } from "@/common/auth/roleUtils"
import { fetchPlatformSignupNotifications } from "./fetchPlatformSignupNotifications"
import { getMergedInvestmentListRows } from "@/modules/Investing/pages/investments/investmentsRuntimeData"
import {
  fetchDealInvestors,
  fetchDealMyEsignDocuments,
  fetchDealsList,
} from "@/modules/Syndication/Deals/api/dealsApi"
import { esignCategoryLabel } from "@/modules/Syndication/Deals/utils/esignTemplateCategories"
import { investorRowIsFundApproved } from "@/modules/Syndication/Deals/utils/dealInvestorTableDisplay"
import {
  investorRowCommittedNumeric,
  investorRowMatchesViewerEmail,
} from "@/modules/Syndication/Deals/utils/investorEsignStatus"
import { parseMoneyDigits } from "@/modules/Syndication/Deals/utils/offeringMoneyFormat"
import type { PortalNotification } from "../types/notification.types"
import { mapWithConcurrency } from "../utils/mapWithConcurrency"

function capitalizeFirst(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return trimmed
  return trimmed.charAt(0).toLocaleUpperCase() + trimmed.slice(1)
}

function isoOrNow(iso: string | null | undefined): string {
  const t = iso?.trim()
  if (!t) return new Date().toISOString()
  const d = new Date(t)
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

type NotificationDraft = Omit<PortalNotification, "read">

async function collectLpInvestorNotifications(
  out: NotificationDraft[],
): Promise<void> {
  const viewerEmail = getSessionUserEmail().trim().toLowerCase()
  if (!viewerEmail) return

  const investments = await getMergedInvestmentListRows()
  const active = investments.filter((r) => !r.archived)
  const dealMeta = new Map<string, { name: string }>()
  for (const row of active) {
    const dealId = (row.dealId ?? row.id ?? "").trim()
    if (!dealId) continue
    dealMeta.set(dealId, {
      name: row.investmentName?.trim() || row.offeringName?.trim() || "Investment",
    })
  }

  const dealIds = [...dealMeta.keys()].slice(0, 24)
  if (dealIds.length === 0) return

  await mapWithConcurrency(dealIds, 4, async (dealId) => {
    const dealName = dealMeta.get(dealId)?.name ?? "Investment"
    const [esign, investorsPayload] = await Promise.all([
      fetchDealMyEsignDocuments(dealId),
      fetchDealInvestors(dealId),
    ])

    const pendingDocs = esign.documents.filter((d) => d.status !== "signed")
    for (const doc of pendingDocs) {
      const docLabel = capitalizeFirst(doc.name || "Document")
      const categoryLabel = doc.categoryId
        ? esignCategoryLabel(doc.categoryId)
        : ""
      out.push({
        id: `esign-pending:${dealId}:${doc.fileId}`,
        title: "Signature required",
        message: categoryLabel
          ? `${docLabel} (${categoryLabel}) on ${dealName}.`
          : `${docLabel} on ${dealName} is waiting for your signature.`,
        category: "document",
        createdAt: isoOrNow(esign.sentAt),
        href: `/investing/investments/${encodeURIComponent(dealId)}?tab=documents`,
      })
    }

    if (pendingDocs.length === 0 && esign.esignPending) {
      out.push({
        id: `esign-pending:${dealId}:workflow`,
        title: "E-signatures in progress",
        message: `Complete your e-sign packet on ${dealName}.`,
        category: "document",
        createdAt: isoOrNow(esign.sentAt),
        href: `/investing/investments/${encodeURIComponent(dealId)}?tab=documents`,
      })
    }

    for (const inv of investorsPayload.investors) {
      if (!investorRowMatchesViewerEmail(inv, viewerEmail)) continue
      const committed = investorRowCommittedNumeric(inv)
      if (committed <= 0) continue
      if (investorRowIsFundApproved(inv)) continue
      const amount = parseMoneyDigits(String(inv.committed ?? ""))
      const amountLabel = Number.isFinite(amount) && amount > 0
        ? new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0,
          }).format(amount)
        : null
      out.push({
        id: `fund-approval-lp:${dealId}:${inv.id}`,
        title: "Investment pending approval",
        message: amountLabel
          ? `Your ${amountLabel} commitment on ${dealName} is awaiting sponsor fund approval.`
          : `Your commitment on ${dealName} is awaiting sponsor fund approval.`,
        category: "investment",
        createdAt: isoOrNow(inv.fundApprovedAtIso ?? inv.signedDate),
        href: `/investing/investments/${encodeURIComponent(dealId)}`,
      })
    }
  })
}

async function collectSponsorNotifications(
  out: NotificationDraft[],
): Promise<void> {
  const deals = (await fetchDealsList({ includeParticipantDeals: true }))
    .filter((d) => !d.archived)
    .slice(0, 20)

  if (deals.length === 0) return

  await mapWithConcurrency(deals, 4, async (deal) => {
    const dealId = deal.id.trim()
    if (!dealId) return
    const dealName = deal.dealName?.trim() || "Deal"
    const payload = await fetchDealInvestors(dealId)
    const pending = payload.investors.filter((inv) => {
      const committed = investorRowCommittedNumeric(inv)
      return committed > 0 && !investorRowIsFundApproved(inv)
    })
    if (pending.length === 0) return

    const names = pending
      .map((inv) => inv.displayName?.trim())
      .filter((n) => n && n !== "—")
      .slice(0, 2)
    const extra = pending.length - names.length
    const who =
      names.length === 0
        ? `${pending.length} investor${pending.length === 1 ? "" : "s"}`
        : extra > 0
          ? `${names.join(", ")} and ${extra} more`
          : names.join(" and ")

    out.push({
      id: `fund-approval-sponsor:${dealId}`,
      title: "Fund approval needed",
      message: `${who} on ${dealName} ${pending.length === 1 ? "needs" : "need"} fund approval.`,
      category: "deal",
      createdAt: isoOrNow(
        pending[0]?.fundApprovedAtIso ?? pending[0]?.signedDate,
      ),
      href: `/deals/${encodeURIComponent(dealId)}?tab=investors`,
    })
  })
}

/**
 * Builds in-app notifications from live deal / investor / e-sign APIs for the signed-in user.
 */
async function collectPlatformAdminSignupNotifications(
  out: NotificationDraft[],
): Promise<void> {
  if (!isPlatformAdmin()) return
  const signupNotes = await fetchPlatformSignupNotifications()
  out.push(...signupNotes)
}

export async function fetchPortalNotifications(): Promise<NotificationDraft[]> {
  const out: NotificationDraft[] = []
  const isLpOnly = isLpInvestorSessionUser()

  if (isLpOnly) {
    await Promise.all([
      collectLpInvestorNotifications(out),
      collectPlatformAdminSignupNotifications(out),
    ])
  } else {
    await Promise.all([
      collectSponsorNotifications(out),
      collectLpInvestorNotifications(out),
      collectPlatformAdminSignupNotifications(out),
    ])
  }

  const byId = new Map<string, NotificationDraft>()
  for (const n of out) {
    if (!byId.has(n.id)) byId.set(n.id, n)
  }

  return [...byId.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}
