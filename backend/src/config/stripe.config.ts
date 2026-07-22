/**
 * Stripe SaaS billing — credentials from environment only.
 *
 * Env price IDs (already used in this project):
 *   STARTER_MONTH_PRICING / STARTER_YEARLY_PRICING
 *   RUNNING_MONTH_PRICING / RUNNING_YEARLY_PRICING
 *   GROWTH_MONTH_PRICING / GROWTH_YEARLY_PRICING
 *
 * Also:
 *   STRIPE_SECRET_KEY=sk_test_... | sk_live_...
 *   STRIPE_WEBHOOK_SECRET=whsec_...
 */

export type StripeBillingPlanId = "starter" | "running" | "growth";
export type StripeBillingCycle = "monthly" | "annual";

export const STRIPE_BILLING_PLAN_IDS: readonly StripeBillingPlanId[] = [
  "starter",
  "running",
  "growth",
] as const;

/** Maps plan + cycle → env var name used in backend/.env.local */
const PRICE_ENV: Record<
  StripeBillingPlanId,
  Record<StripeBillingCycle, string>
> = {
  starter: {
    monthly: "STARTER_MONTH_PRICING",
    annual: "STARTER_YEARLY_PRICING",
  },
  running: {
    monthly: "RUNNING_MONTH_PRICING",
    annual: "RUNNING_YEARLY_PRICING",
  },
  growth: {
    monthly: "GROWTH_MONTH_PRICING",
    annual: "GROWTH_YEARLY_PRICING",
  },
};

export type StripeConfig = {
  secretKey: string;
  webhookSecret: string | null;
  testMode: boolean;
  prices: Record<
    StripeBillingPlanId,
    Record<StripeBillingCycle, string | null>
  >;
};

function isStripeTestKey(secretKey: string): boolean {
  return secretKey.startsWith("sk_test_");
}

function envPrice(name: string): string | null {
  const v = process.env[name]?.trim() ?? "";
  return v.startsWith("price_") ? v : null;
}

function emptyPriceMap(): StripeConfig["prices"] {
  return {
    starter: {
      monthly: envPrice(PRICE_ENV.starter.monthly),
      annual: envPrice(PRICE_ENV.starter.annual),
    },
    running: {
      monthly: envPrice(PRICE_ENV.running.monthly),
      annual: envPrice(PRICE_ENV.running.annual),
    },
    growth: {
      monthly: envPrice(PRICE_ENV.growth.monthly),
      annual: envPrice(PRICE_ENV.growth.annual),
    },
  };
}

export function isStripeBillingPlanId(v: string): v is StripeBillingPlanId {
  return (STRIPE_BILLING_PLAN_IDS as readonly string[]).includes(v);
}

/** Accept starter_5 etc. from older UI and map to tier. */
export function normalizeBillingPlanId(
  raw: string | null | undefined,
): StripeBillingPlanId | null {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (isStripeBillingPlanId(s)) return s;
  if (s.startsWith("starter")) return "starter";
  if (s.startsWith("running")) return "running";
  if (s.startsWith("growth")) return "growth";
  return null;
}

export function getStripeConfig(): StripeConfig | null {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (!secretKey.startsWith("sk_")) return null;

  return {
    secretKey,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET?.trim() || null,
    testMode: isStripeTestKey(secretKey),
    prices: emptyPriceMap(),
  };
}

export function requireStripeConfig(): StripeConfig {
  const cfg = getStripeConfig();
  if (!cfg) {
    throw new Error(
      "Stripe is not configured. Set STRIPE_SECRET_KEY in backend/.env.",
    );
  }
  return cfg;
}

export function resolveStripePriceId(
  planId: string,
  cycle: string,
): string | null {
  const cfg = getStripeConfig();
  if (!cfg) return null;
  const plan = normalizeBillingPlanId(planId);
  if (!plan) return null;
  const c: StripeBillingCycle | null =
    cycle === "monthly"
      ? "monthly"
      : cycle === "annual" || cycle === "annually" || cycle === "yearly"
        ? "annual"
        : null;
  if (!c) return null;
  return cfg.prices[plan][c];
}

export function priceEnvNameFor(
  planId: StripeBillingPlanId,
  cycle: StripeBillingCycle,
): string {
  return PRICE_ENV[planId][cycle];
}

export function planAndCycleFromPriceId(
  priceId: string | null | undefined,
): { planId: StripeBillingPlanId | null; cycle: StripeBillingCycle | null } {
  const id = String(priceId ?? "").trim();
  if (!id) return { planId: null, cycle: null };
  const cfg = getStripeConfig();
  if (!cfg) return { planId: null, cycle: null };
  for (const planId of STRIPE_BILLING_PLAN_IDS) {
    for (const cycle of ["monthly", "annual"] as const) {
      if (cfg.prices[planId][cycle] === id) {
        return { planId, cycle };
      }
    }
  }
  return { planId: null, cycle: null };
}

/** Safe for API responses — never exposes the secret key. */
export function getStripePublicConfig(): {
  configured: boolean;
  testMode: boolean;
  webhookConfigured: boolean;
  plans: Array<{
    id: StripeBillingPlanId;
    monthlyPriceId: string | null;
    annualPriceId: string | null;
    monthlyEnv: string;
    annualEnv: string;
  }>;
} {
  const cfg = getStripeConfig();
  if (!cfg) {
    return {
      configured: false,
      testMode: false,
      webhookConfigured: false,
      plans: [],
    };
  }
  return {
    configured: true,
    testMode: cfg.testMode,
    webhookConfigured: Boolean(cfg.webhookSecret),
    plans: STRIPE_BILLING_PLAN_IDS.map((id) => ({
      id,
      monthlyPriceId: cfg.prices[id].monthly,
      annualPriceId: cfg.prices[id].annual,
      monthlyEnv: PRICE_ENV[id].monthly,
      annualEnv: PRICE_ENV[id].annual,
    })),
  };
}

export function resolveFrontendOrigin(): string {
  // This app uses BASE_URL as the SPA / portal origin for Stripe redirects.
  const raw =
    process.env.BASE_URL?.trim() ||
    process.env.FRONTEND_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    process.env.CLIENT_URL?.trim() ||
    process.env.PUBLIC_APP_URL?.trim() ||
    "";
  return raw.replace(/\/$/, "");
}
