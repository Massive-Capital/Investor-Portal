export type InvestmentListRow = {
  id: string
  /** Underlying deal id (same as `id` for API rows; set for localStorage rows). */
  dealId?: string
  investmentName: string
  /** Deal / offering title (not investor class, e.g. “Class A”). */
  offeringName: string
  /**
   * Shown in list/export as "Invested as" — `My profile` name + type when a book profile is
   * linked, otherwise the commitment type (e.g. Individual) from the deal row.
   */
  investmentProfile: string
  /** `profileId` on the deal commitment (investor type enum). */
  commitmentProfileId?: string
  /** `user_investor_profiles.id` when this commitment is tied to a saved book profile. */
  userInvestorProfileId?: string
  /**
   * Name stored on the deal investment when the API provides it; preferred over
   * resolving the id via My Profiles in `enrichInvestmentListRow`.
   */
  userInvestorProfileName?: string
  investedAmount: number
  distributedAmount: number
  currentValuation: string
  dealCloseDate: string
  status: string
  actionRequired: string
  /** When true, row appears under Archives tab (same pattern as deals list). */
  archived?: boolean
}

/** One line on the investment detail: a My Profile (or an unbooked commitment), type(s), and amount. */
export type InvestmentBreakdownLine = {
  /**
   * Book profile name when available; else a non-duplicate `entitySubtitle` or id hint
   * so the same investor type (e.g. Individual) on multiple rows can still be distinguished.
   */
  profileName: string
  /** Commitment / investor type (e.g. Individual, LLC) from the deal row(s). */
  investorType: string
  /** For this line: this commitment’s `committed` amount in USD in the table. */
  investedAmount: number
}

/** Full property / investment / debt snapshot for the investment detail form. */
export type InvestmentDetailRecord = {
  id: string
  list: InvestmentListRow
  propertyName: string
  propertyType: string
  propertyStatus: string
  city: string
  state: string
  numberOfUnits: string
  occupancyPct: string
  ownedSince: string
  yearBuilt: string
  /**
   * How this commitment is held: **My profile** name + commitment type, same as the
   * investments list / “Invested as” column; derived from the deal and profile book, not
   * free-typed.
   */
  investedAs: string
  /** One row per deal commitment: profile name, investor type, and amount. */
  investedAsBreakdown?: InvestmentBreakdownLine[]
  ownershipPct: string
  generalComments: string
  overallAssetValue: string
  netOperatingIncome: string
  outstandingLoans: string
  debtService: string
  loanType: string
  ioOrAmortizing: string
  maturityDate: string
  lender: string
  interestRatePct: string
}
