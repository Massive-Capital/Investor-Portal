/** Distribution Setup — waterfall configuration (no production payment runs). */

export const DISTRIBUTION_WF_KINDS = [
  "LP_PREF",
  "PREF_CURRENT",
  "PREF_ACCRUED",
  "ROC",
  "CATCHUP",
] as const;

export type DistributionWfKind = (typeof DISTRIBUTION_WF_KINDS)[number];

export const DISTRIBUTION_WF_SOURCES = ["operating", "capital"] as const;
export type DistributionWfSource = (typeof DISTRIBUTION_WF_SOURCES)[number];

export const DISTRIBUTION_AMOUNT_MODES = ["calc", "input"] as const;
export type DistributionAmountMode = (typeof DISTRIBUTION_AMOUNT_MODES)[number];

export interface DistributionPaymentRow {
  id: string;
  kind: DistributionWfKind;
  name: string;
  payTo: string[];
  amountMode: DistributionAmountMode;
  inputAmount: string;
  catchupPct?: string;
}

export interface DistributionWaterfalls {
  operating: DistributionPaymentRow[];
  capital: DistributionPaymentRow[];
}

export interface DistributionSetupBundle {
  dealId: string;
  dealName: string;
  targetRaise: string;
  waterfalls: DistributionWaterfalls;
  /** Snapshot from Class Setup for builder + simulator. */
  classes: Array<{
    id: string;
    name: string;
    classType: string;
    actuallyFunded: string;
    equityPct: string;
    preferredReturn: {
      enabled: boolean;
      rate: string;
    };
    prefEquity: {
      totalRate: string;
      currentRate: string;
      accrualRate: string;
    };
    mezz: { rate: string; pay: string };
  }>;
  promote: {
    hurdles: Array<{
      id: string;
      rate: string;
      basis: string;
      measuredOn: string;
    }>;
    shares: Record<string, string[]>;
  };
}

export interface DistributionSetupSaveInput {
  waterfalls: DistributionWaterfalls;
}

export const KIND_LABELS: Record<DistributionWfKind, string> = {
  LP_PREF: "LP preferred return",
  PREF_CURRENT: "Preferred equity current coupon",
  PREF_ACCRUED: "Preferred equity accrued balance",
  ROC: "Return of capital",
  CATCHUP: "GP catch-up",
};

export function emptyWaterfalls(): DistributionWaterfalls {
  return {
    operating: [
      {
        id: "t1",
        kind: "PREF_CURRENT",
        name: "Preferred equity — current pay",
        payTo: [],
        amountMode: "calc",
        inputAmount: "0",
      },
      {
        id: "t2",
        kind: "LP_PREF",
        name: "LP preferred return (+ arrears)",
        payTo: [],
        amountMode: "calc",
        inputAmount: "0",
      },
    ],
    capital: [
      {
        id: "c1",
        kind: "PREF_ACCRUED",
        name: "Preferred equity — accrued balance",
        payTo: [],
        amountMode: "calc",
        inputAmount: "0",
      },
      {
        id: "c2",
        kind: "ROC",
        name: "Preferred equity — redeem principal",
        payTo: [],
        amountMode: "calc",
        inputAmount: "0",
      },
      {
        id: "c3",
        kind: "ROC",
        name: "Return of LP capital",
        payTo: [],
        amountMode: "calc",
        inputAmount: "0",
      },
    ],
  };
}
