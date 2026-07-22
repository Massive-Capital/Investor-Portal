/** Distribution Setup frontend types — mirrors backend distributionSetup.types */

export type DistributionWfKind =
  | "LP_PREF"
  | "PREF_CURRENT"
  | "PREF_ACCRUED"
  | "ROC"
  | "CATCHUP"

export type DistributionWfSource = "operating" | "capital"
export type DistributionAmountMode = "calc" | "input"

export interface DistributionPaymentRow {
  id: string
  kind: DistributionWfKind
  name: string
  payTo: string[]
  amountMode: DistributionAmountMode
  inputAmount: string
  catchupPct: string
}

export interface DistributionWaterfalls {
  operating: DistributionPaymentRow[]
  capital: DistributionPaymentRow[]
}

export interface DistributionSetupClass {
  id: string
  name: string
  classType: string
  actuallyFunded: string
  equityPct: string
  preferredReturn: { enabled: boolean; rate: string }
  prefEquity: {
    totalRate: string
    currentRate: string
    accrualRate: string
  }
  mezz: { rate: string; pay: string }
}

export interface DistributionSetupPromote {
  hurdles: Array<{
    id: string
    rate: string
    basis: string
    measuredOn: string
  }>
  shares: Record<string, string[]>
}

export interface DistributionSetupBundle {
  dealId: string
  dealName: string
  targetRaise: string
  waterfalls: DistributionWaterfalls
  classes: DistributionSetupClass[]
  promote: DistributionSetupPromote
}

export const KIND_META: Record<
  DistributionWfKind,
  { label: string; defaultName: string }
> = {
  LP_PREF: {
    label: "LP preferred return",
    defaultName: "LP preferred return (+ arrears)",
  },
  PREF_CURRENT: {
    label: "Preferred equity current coupon",
    defaultName: "Preferred equity — current pay",
  },
  PREF_ACCRUED: {
    label: "Preferred equity accrued balance",
    defaultName: "Preferred equity — accrued balance",
  },
  ROC: {
    label: "Return of capital",
    defaultName: "Return of capital",
  },
  CATCHUP: {
    label: "GP catch-up",
    defaultName: "GP catch-up",
  },
}

export const CLASS_TYPE_TONE: Record<string, string> = {
  lp: "lp",
  gp: "gp",
  preferred_equity: "pref",
  mezzanine: "mezz",
}
