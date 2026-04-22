/**
 * Row for Investing → Profiles "My profiles"; persisted per user in `user_investor_profiles`.
 */
export type InvestorProfileListRow = {
  id: string
  profileName: string
  profileType: string
  addedBy: string
  /** Count of linked investments (demo: 0 until API exists). */
  investmentsCount: number
  dateCreated: string
  /** When true, show under Archived; omitted/false = Active. */
  archived?: boolean
}

export type NewInvestorProfilePayload = {
  profileName: string
  profileType: string
}
