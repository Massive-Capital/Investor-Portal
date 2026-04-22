import { DealsListPage } from "@/modules/Syndication/InvestorPortal/Deals/DealsListPage"

/**
 * Investing shell route (`/investing/deals`): deal roster with participant-inclusive API,
 * read-only row actions, and investing-specific columns. Implementation is shared with
 * {@link DealsListPage} via `dealsListContext="investing"`.
 */
export function InvestingDealsListPage() {
  return <DealsListPage dealsListContext="investing" />
}
