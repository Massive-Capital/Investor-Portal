import { fetchContacts } from "../../../contacts/api/contactsApi"
import {
  fetchDealInvestorClasses,
  fetchDealInvestors,
  fetchDealsList,
} from "../Deals/api/dealsApi"
import {
  acceptedAmountForPayload,
  formatUsdDashboardAmount,
  targetAmountNumberForDeal,
} from "../Deals/dealsDashboardMoney"
import type { DealListRow } from "../Deals/types/deals.types"

export interface SyndicationDashboardSummary {
  dealCount: number
  /** Sum of investor rows across all deals (investment line items). */
  totalInvestorRows: number
  totalTargetDisplay: string
  totalDistributionsDisplay: string
  totalCommittedDisplay: string
  contactsCount: number
}

/**
 * Loads aggregate metrics for the syndicating dashboard cards.
 * - Total target amount = sum of offering sizes (investor classes per deal), else deal raise target.
 * - Total distributions (and committed) = sum of accepted investment amounts across all deals.
 */
export async function loadSyndicationDashboardSummary(): Promise<SyndicationDashboardSummary> {
  const [list, contacts] = await Promise.all([
    fetchDealsList(),
    fetchContacts(),
  ])

  const contactsCount = contacts.length

  if (list.length === 0) {
    return {
      dealCount: 0,
      totalInvestorRows: 0,
      totalTargetDisplay: formatUsdDashboardAmount(0),
      totalDistributionsDisplay: formatUsdDashboardAmount(0),
      totalCommittedDisplay: formatUsdDashboardAmount(0),
      contactsCount,
    }
  }

  const perDeal = await Promise.all(
    list.map(async (row: DealListRow) => {
      const [payload, classes] = await Promise.all([
        fetchDealInvestors(row.id),
        fetchDealInvestorClasses(row.id),
      ])
      return { row, payload, classes }
    }),
  )

  let totalInvestorRows = 0
  let sumTarget = 0
  let sumAccepted = 0

  for (const { row, payload, classes } of perDeal) {
    totalInvestorRows += payload.investors.length
    sumTarget += targetAmountNumberForDeal(row, classes)
    sumAccepted += acceptedAmountForPayload(payload)
  }

  const money = formatUsdDashboardAmount(sumAccepted)

  return {
    dealCount: list.length,
    totalInvestorRows,
    totalTargetDisplay: formatUsdDashboardAmount(sumTarget),
    totalDistributionsDisplay: money,
    totalCommittedDisplay: money,
    contactsCount,
  }
}
