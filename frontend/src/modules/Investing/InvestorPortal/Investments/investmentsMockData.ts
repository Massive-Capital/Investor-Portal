import type { InvestmentDetailRecord, InvestmentListRow } from "./investments.types"
import {
  readRuntimeInvestmentRowById,
  readRuntimeInvestmentRows,
} from "./investmentsRuntimeStore"

const LIST: InvestmentListRow[] = [
  {
    id: "inv-main-street",
    investmentName: "Main Street Apartments",
    offeringName: "SPV 2024-A",
    investmentProfile: "Individual · Accredited",
    investedAmount: 11000,
    distributedAmount: 0,
    currentValuation: "$2,450,000",
    dealCloseDate: "Mar 15, 2024",
    status: "Active",
    actionRequired: "None",
    archived: false,
  },
  {
    id: "inv-riverfront",
    investmentName: "Riverfront Industrial",
    offeringName: "Fund VII — Sidecar",
    investmentProfile: "Entity · LLC",
    investedAmount: 50000,
    distributedAmount: 2500,
    currentValuation: "$1,820,000",
    dealCloseDate: "Jun 1, 2023",
    status: "Active",
    actionRequired: "Update wire instructions",
    archived: false,
  },
]

const DETAILS: Record<string, InvestmentDetailRecord> = {
  "inv-main-street": {
    id: "inv-main-street",
    list: LIST[0],
    propertyName: "Main Street Apartments",
    propertyType: "Multifamily",
    propertyStatus: "Stabilized",
    city: "Austin",
    state: "TX",
    numberOfUnits: "48",
    occupancyPct: "94",
    ownedSince: "2019-06-01",
    yearBuilt: "1987",
    investedAs: "Limited partner",
    ownershipPct: "2.5",
    generalComments: "Quarterly distributions; sponsor sends K-1s by March 15.",
    overallAssetValue: "2450000",
    netOperatingIncome: "185000",
    outstandingLoans: "1200000",
    debtService: "78000",
    loanType: "Senior mortgage",
    ioOrAmortizing: "Amortizing",
    maturityDate: "2034-06-01",
    lender: "Regional Bank NA",
    interestRatePct: "5.25",
  },
  "inv-riverfront": {
    id: "inv-riverfront",
    list: LIST[1],
    propertyName: "Riverfront Industrial",
    propertyType: "Industrial",
    propertyStatus: "Leased",
    city: "Dallas",
    state: "TX",
    numberOfUnits: "1",
    occupancyPct: "100",
    ownedSince: "2021-01-15",
    yearBuilt: "2005",
    investedAs: "Co-investor",
    ownershipPct: "1.0",
    generalComments: "",
    overallAssetValue: "1820000",
    netOperatingIncome: "142000",
    outstandingLoans: "890000",
    debtService: "52000",
    loanType: "CMBS",
    ioOrAmortizing: "Interest-only",
    maturityDate: "2028-01-15",
    lender: "CMBS Trust 2019-R1",
    interestRatePct: "4.875",
  },
}

export function getInvestmentListRows(): InvestmentListRow[] {
  const byId = new Map<string, InvestmentListRow>()
  for (const row of LIST) byId.set(row.id, row)
  for (const row of readRuntimeInvestmentRows()) byId.set(row.id, row)
  return [...byId.values()]
}

export function getInvestmentDetail(
  id: string,
): InvestmentDetailRecord | undefined {
  const key = id.trim()
  if (DETAILS[key]) return DETAILS[key]
  const row = readRuntimeInvestmentRowById(key)
  if (!row) return undefined
  return {
    id: row.id,
    list: row,
    propertyName: row.investmentName || "—",
    propertyType: "Other",
    propertyStatus: "Other",
    city: "—",
    state: "—",
    numberOfUnits: "—",
    occupancyPct: "—",
    ownedSince: "—",
    yearBuilt: "—",
    investedAs: "Limited partner",
    ownershipPct: "—",
    generalComments: "",
    overallAssetValue: "0",
    netOperatingIncome: "0",
    outstandingLoans: "0",
    debtService: "0",
    loanType: "Other",
    ioOrAmortizing: "Amortizing",
    maturityDate: "—",
    lender: "—",
    interestRatePct: "—",
  }
}
