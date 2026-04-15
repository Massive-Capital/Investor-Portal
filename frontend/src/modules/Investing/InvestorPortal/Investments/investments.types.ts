export type InvestmentListRow = {
  id: string
  investmentName: string
  offeringName: string
  investmentProfile: string
  investedAmount: number
  distributedAmount: number
  currentValuation: string
  dealCloseDate: string
  status: string
  actionRequired: string
  /** When true, row appears under Archives tab (same pattern as deals list). */
  archived?: boolean
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
  investedAs: string
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
