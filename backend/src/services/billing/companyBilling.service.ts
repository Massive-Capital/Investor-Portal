import Stripe from "stripe";
import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { db } from "../../database/db.js";
import {
  companies,
  companyBillingEvents,
  companyBillingInvoices,
  companyBillingPaymentMethods,
  users,
} from "../../schema/schema.js";
import {
  getStripeConfig,
  normalizeBillingPlanId,
  planAndCycleFromPriceId,
  priceEnvNameFor,
  requireStripeConfig,
  resolveFrontendOrigin,
  resolveStripePriceId,
  STRIPE_BILLING_PLAN_IDS,
  type StripeBillingCycle,
  type StripeBillingPlanId,
} from "../../config/stripe.config.js";
import {
  isCompanyAdminRole,
  isPlatformAdminRole,
} from "../../constants/roles.js";
import { userHasAccessToOrganization } from "../org/orgResolution.service.js";

let stripeClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  const cfg = requireStripeConfig();
  if (!stripeClient) {
    stripeClient = new Stripe(cfg.secretKey, {
      apiVersion: "2026-06-24.dahlia",
    });
  }
  return stripeClient;
}

const COMPANY_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeCompanyId(raw: string): string | null {
  const s = String(raw ?? "").trim().toLowerCase();
  return COMPANY_UUID_RE.test(s) ? s : null;
}

export async function userCanManageCompanyBilling(
  userId: string,
  userRole: string | undefined,
  companyId: string,
): Promise<boolean> {
  const cid = normalizeCompanyId(companyId);
  if (!cid) return false;
  const [co] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.id, cid))
    .limit(1);
  if (!co) return false;
  if (isPlatformAdminRole(userRole)) return true;
  if (!isCompanyAdminRole(userRole)) return false;
  return userHasAccessToOrganization(userId, cid);
}

export type CompanyBillingStatus = {
  configured: boolean;
  testMode: boolean;
  webhookConfigured: boolean;
  companyId: string;
  planId: string | null;
  billingCycle: string | null;
  subscriptionStatus: string;
  priceId: string | null;
  currentPeriodEnd: string | null;
  hasCustomer: boolean;
  hasSubscription: boolean;
  lastPaymentError: string | null;
  lastPaymentFailedAt: string | null;
  paymentHealthy: boolean;
  plansConfigured: Array<{
    id: StripeBillingPlanId;
    monthlyReady: boolean;
    annualReady: boolean;
    monthlyEnv: string;
    annualEnv: string;
  }>;
};

export async function getCompanyBillingStatus(
  companyId: string,
): Promise<CompanyBillingStatus | null> {
  const cid = normalizeCompanyId(companyId);
  if (!cid) return null;
  const [row] = await db
    .select({
      id: companies.id,
      stripeCustomerId: companies.stripeCustomerId,
      stripeSubscriptionId: companies.stripeSubscriptionId,
      stripePlanId: companies.stripePlanId,
      stripeBillingCycle: companies.stripeBillingCycle,
      stripeSubscriptionStatus: companies.stripeSubscriptionStatus,
      stripePriceId: companies.stripePriceId,
      stripeCurrentPeriodEnd: companies.stripeCurrentPeriodEnd,
      stripeLastPaymentError: companies.stripeLastPaymentError,
      stripeLastPaymentFailedAt: companies.stripeLastPaymentFailedAt,
    })
    .from(companies)
    .where(eq(companies.id, cid))
    .limit(1);
  if (!row) return null;

  const cfg = getStripeConfig();
  const publicPlans = cfg
    ? STRIPE_BILLING_PLAN_IDS.map((id) => ({
        id,
        monthlyReady: Boolean(cfg.prices[id].monthly),
        annualReady: Boolean(cfg.prices[id].annual),
        monthlyEnv: priceEnvNameFor(id, "monthly"),
        annualEnv: priceEnvNameFor(id, "annual"),
      }))
    : [];

  const subscriptionStatus = row.stripeSubscriptionStatus || "none";
  const paymentHealthy =
    !row.stripeLastPaymentError &&
    subscriptionStatus !== "past_due" &&
    subscriptionStatus !== "unpaid" &&
    subscriptionStatus !== "incomplete";

  return {
    configured: Boolean(cfg),
    testMode: cfg?.testMode ?? false,
    webhookConfigured: Boolean(cfg?.webhookSecret),
    companyId: row.id,
    planId: row.stripePlanId,
    billingCycle: row.stripeBillingCycle,
    subscriptionStatus,
    priceId: row.stripePriceId,
    currentPeriodEnd: row.stripeCurrentPeriodEnd
      ? row.stripeCurrentPeriodEnd.toISOString()
      : null,
    hasCustomer: Boolean(row.stripeCustomerId),
    hasSubscription: Boolean(row.stripeSubscriptionId),
    lastPaymentError: row.stripeLastPaymentError,
    lastPaymentFailedAt: row.stripeLastPaymentFailedAt
      ? row.stripeLastPaymentFailedAt.toISOString()
      : null,
    paymentHealthy,
    plansConfigured: publicPlans,
  };
}

async function ensureStripeCustomer(params: {
  companyId: string;
  actorUserId: string;
}): Promise<string> {
  const cid = normalizeCompanyId(params.companyId);
  if (!cid) throw new Error("Invalid company id");

  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, cid))
    .limit(1);
  if (!company) throw new Error("Company not found");

  if (company.stripeCustomerId?.trim()) {
    return company.stripeCustomerId.trim();
  }

  const [actor] = await db
    .select({ email: users.email, name: users.username })
    .from(users)
    .where(eq(users.id, params.actorUserId))
    .limit(1);

  const stripe = getStripeClient();
  const customer = await stripe.customers.create(
    {
      name: company.name,
      email: actor?.email?.trim() || undefined,
      metadata: {
        companyId: cid,
        companyName: company.name,
      },
    },
    { idempotencyKey: `company_customer_${cid}` },
  );

  // Race-safe: only write if still empty; another request may have won.
  await db
    .update(companies)
    .set({
      stripeCustomerId: customer.id,
      updatedAt: new Date(),
    })
    .where(and(eq(companies.id, cid), isNull(companies.stripeCustomerId)));

  const [after] = await db
    .select({ stripeCustomerId: companies.stripeCustomerId })
    .from(companies)
    .where(eq(companies.id, cid))
    .limit(1);
  return after?.stripeCustomerId?.trim() || customer.id;
}

export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; status: number; message: string };

export async function createCompanyCheckoutSession(params: {
  companyId: string;
  actorUserId: string;
  /** starter | running | growth (seat suffixes like starter_5 are normalized) */
  planId: string;
  seatBand?: string;
  billingCycle: string;
}): Promise<CheckoutResult> {
  const cfg = getStripeConfig();
  if (!cfg) {
    return {
      ok: false,
      status: 503,
      message: "Stripe is not configured on the server.",
    };
  }

  const cycle: StripeBillingCycle =
    params.billingCycle === "annually" ||
    params.billingCycle === "annual" ||
    params.billingCycle === "yearly"
      ? "annual"
      : params.billingCycle === "monthly"
        ? "monthly"
        : ("" as StripeBillingCycle);

  if (cycle !== "monthly" && cycle !== "annual") {
    return {
      ok: false,
      status: 400,
      message: "billingCycle must be monthly or annual.",
    };
  }

  const rawPlan = String(params.planId ?? "").trim().toLowerCase();
  if (rawPlan === "custom") {
    return {
      ok: false,
      status: 400,
      message:
        "For deals over $50M or 25+ company users, contact sales for pricing.",
    };
  }

  const resolvedPlan = normalizeBillingPlanId(rawPlan);
  if (!resolvedPlan) {
    return {
      ok: false,
      status: 400,
      message: 'planId must be "starter", "running", or "growth".',
    };
  }

  // Only Starter is enabled for self-serve checkout for now.
  if (resolvedPlan !== "starter") {
    return {
      ok: false,
      status: 403,
      message:
        "Only the Starter plan is available for checkout right now. Running and Growth are coming soon.",
    };
  }

  const priceId = resolveStripePriceId(resolvedPlan, cycle);
  if (!priceId) {
    const envName = priceEnvNameFor(resolvedPlan, cycle);
    return {
      ok: false,
      status: 503,
      message: `Stripe Price is not configured for ${resolvedPlan} (${cycle}). Set ${envName}=price_... in backend/.env.local.`,
    };
  }

  const cid = normalizeCompanyId(params.companyId);
  if (!cid) {
    return { ok: false, status: 400, message: "Invalid company id" };
  }

  const frontend = resolveFrontendOrigin();
  if (!frontend) {
    return {
      ok: false,
      status: 503,
      message:
        "BASE_URL must be set so Stripe can redirect after checkout.",
    };
  }

  try {
    const [company] = await db
      .select({
        stripeSubscriptionId: companies.stripeSubscriptionId,
        stripeSubscriptionStatus: companies.stripeSubscriptionStatus,
      })
      .from(companies)
      .where(eq(companies.id, cid))
      .limit(1);
    if (!company) {
      return { ok: false, status: 404, message: "Company not found" };
    }

    const existingStatus = String(company.stripeSubscriptionStatus ?? "none");
    const blockingStatuses = new Set([
      "active",
      "trialing",
      "past_due",
      "unpaid",
      "incomplete",
    ]);
    if (
      company.stripeSubscriptionId?.trim() &&
      blockingStatuses.has(existingStatus)
    ) {
      return {
        ok: false,
        status: 409,
        message:
          "This company already has a subscription. Use Manage billing to update payment method or plan.",
      };
    }

    const customerId = await ensureStripeCustomer({
      companyId: cid,
      actorUserId: params.actorUserId,
    });
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${frontend}/settings?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontend}/settings?billing=cancel`,
      client_reference_id: cid,
      metadata: {
        companyId: cid,
        planId: resolvedPlan,
        billingCycle: cycle,
        ...(params.seatBand ? { seatBand: params.seatBand } : {}),
      },
      subscription_data: {
        metadata: {
          companyId: cid,
          planId: resolvedPlan,
          billingCycle: cycle,
          ...(params.seatBand ? { seatBand: params.seatBand } : {}),
        },
      },
      allow_promotion_codes: true,
    });

    if (!session.url) {
      return {
        ok: false,
        status: 502,
        message: "Stripe did not return a checkout URL.",
      };
    }
    return { ok: true, url: session.url };
  } catch (err) {
    console.error("createCompanyCheckoutSession:", err);
    const msg =
      err instanceof Error ? err.message : "Could not create checkout session";
    return { ok: false, status: 502, message: msg };
  }
}

export type PortalResult =
  | { ok: true; url: string }
  | { ok: false; status: number; message: string };

export async function createCompanyBillingPortalSession(params: {
  companyId: string;
  actorUserId: string;
}): Promise<PortalResult> {
  if (!getStripeConfig()) {
    return {
      ok: false,
      status: 503,
      message: "Stripe is not configured on the server.",
    };
  }

  const cid = normalizeCompanyId(params.companyId);
  if (!cid) {
    return { ok: false, status: 400, message: "Invalid company id" };
  }

  const frontend = resolveFrontendOrigin();
  if (!frontend) {
    return {
      ok: false,
      status: 503,
      message:
        "BASE_URL must be set so Stripe can redirect after the portal.",
    };
  }

  try {
    const customerId = await ensureStripeCustomer({
      companyId: cid,
      actorUserId: params.actorUserId,
    });
    const stripe = getStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${frontend}/settings?billing=portal_return`,
    });
    return { ok: true, url: session.url };
  } catch (err) {
    console.error("createCompanyBillingPortalSession:", err);
    const msg =
      err instanceof Error ? err.message : "Could not open billing portal";
    return { ok: false, status: 502, message: msg };
  }
}

export type BillingInvoiceRow = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  status: string;
  amount: string;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
  paymentFailureMessage: string | null;
  paymentFailedAt: string | null;
};

function formatMoneyCents(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency || "usd").toUpperCase(),
  }).format((cents || 0) / 100);
}

function isoDateOnly(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

async function recordBillingEvent(params: {
  companyId: string | null;
  stripeEventId?: string | null;
  eventType: string;
  stripeInvoiceId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeCustomerId?: string | null;
  message?: string | null;
  payload?: unknown;
}): Promise<{ inserted: boolean }> {
  const eventId = params.stripeEventId?.trim() || null;
  try {
    if (eventId) {
      const inserted = await db
        .insert(companyBillingEvents)
        .values({
          companyId: params.companyId,
          stripeEventId: eventId,
          eventType: params.eventType,
          stripeInvoiceId: params.stripeInvoiceId?.trim() || null,
          stripeSubscriptionId: params.stripeSubscriptionId?.trim() || null,
          stripeCustomerId: params.stripeCustomerId?.trim() || null,
          message: params.message?.trim() || null,
          payload: params.payload ?? null,
        })
        .onConflictDoNothing({
          target: companyBillingEvents.stripeEventId,
        })
        .returning({ id: companyBillingEvents.id });
      return { inserted: inserted.length > 0 };
    }

    await db.insert(companyBillingEvents).values({
      companyId: params.companyId,
      stripeEventId: null,
      eventType: params.eventType,
      stripeInvoiceId: params.stripeInvoiceId?.trim() || null,
      stripeSubscriptionId: params.stripeSubscriptionId?.trim() || null,
      stripeCustomerId: params.stripeCustomerId?.trim() || null,
      message: params.message?.trim() || null,
      payload: params.payload ?? null,
    });
    return { inserted: true };
  } catch (err) {
    console.warn("recordBillingEvent:", err);
    return { inserted: false };
  }
}

/** Returns true if this Stripe event id was newly claimed (not a retry). */
async function claimStripeEvent(params: {
  eventId: string;
  eventType: string;
  companyId?: string | null;
  message?: string | null;
  payload?: unknown;
}): Promise<boolean> {
  const { inserted } = await recordBillingEvent({
    companyId: params.companyId ?? null,
    stripeEventId: params.eventId,
    eventType: params.eventType,
    message: params.message ?? "claimed",
    payload: params.payload,
  });
  return inserted;
}

export async function upsertBillingInvoiceFromStripe(params: {
  companyId: string;
  invoice: Stripe.Invoice;
  paymentFailureMessage?: string | null;
  markFailed?: boolean;
  markPaid?: boolean;
}): Promise<void> {
  const cid = normalizeCompanyId(params.companyId);
  if (!cid) return;
  const inv = params.invoice;
  const invoiceId = String(inv.id ?? "").trim();
  if (!invoiceId) return;

  const customerId =
    typeof inv.customer === "string" ? inv.customer : inv.customer?.id ?? null;
  const subscriptionId = subscriptionIdFromInvoice(inv);

  const invoiceDate = inv.created
    ? new Date(inv.created * 1000)
    : null;
  const dueDate = inv.due_date ? new Date(inv.due_date * 1000) : invoiceDate;
  const paidAt =
    params.markPaid || inv.status === "paid"
      ? inv.status_transitions?.paid_at
        ? new Date(inv.status_transitions.paid_at * 1000)
        : new Date()
      : null;
  const failureMessage =
    params.paymentFailureMessage?.trim() ||
    (params.markFailed ? "Payment failed" : null);
  const paymentFailedAt = params.markFailed
    ? new Date()
    : failureMessage
      ? new Date()
      : null;

  const preserveFailures = !params.markPaid && !params.markFailed;
  const values = {
    companyId: cid,
    stripeInvoiceId: invoiceId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    invoiceNumber: inv.number || invoiceId,
    status: String(inv.status ?? "open"),
    currency: String(inv.currency ?? "usd"),
    amountDueCents: inv.amount_due ?? inv.total ?? 0,
    amountPaidCents: inv.amount_paid ?? 0,
    amountRemainingCents: inv.amount_remaining ?? 0,
    hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
    invoicePdf: inv.invoice_pdf ?? null,
    paymentFailureMessage: params.markPaid
      ? null
      : params.markFailed
        ? failureMessage
        : null,
    paymentFailedAt: params.markPaid
      ? null
      : params.markFailed
        ? paymentFailedAt
        : null,
    paidAt,
    invoiceDate,
    dueDate,
    updatedAt: new Date(),
  };

  await db
    .insert(companyBillingInvoices)
    .values(values)
    .onConflictDoUpdate({
      target: companyBillingInvoices.stripeInvoiceId,
      set: {
        stripeCustomerId: values.stripeCustomerId,
        stripeSubscriptionId: values.stripeSubscriptionId,
        invoiceNumber: values.invoiceNumber,
        status: values.status,
        currency: values.currency,
        amountDueCents: values.amountDueCents,
        amountPaidCents: values.amountPaidCents,
        amountRemainingCents: values.amountRemainingCents,
        hostedInvoiceUrl: values.hostedInvoiceUrl,
        invoicePdf: values.invoicePdf,
        // Refreshing from Stripe list must not wipe webhook failure details.
        ...(preserveFailures
          ? {}
          : {
              paymentFailureMessage: values.paymentFailureMessage,
              paymentFailedAt: values.paymentFailedAt,
            }),
        ...(params.markPaid || paidAt ? { paidAt: values.paidAt } : {}),
        invoiceDate: values.invoiceDate,
        dueDate: values.dueDate,
        updatedAt: values.updatedAt,
      },
    });
}

export async function listCompanyStripeInvoices(
  companyId: string,
): Promise<
  | { ok: true; invoices: BillingInvoiceRow[] }
  | { ok: false; status: number; message: string }
> {
  const cid = normalizeCompanyId(companyId);
  if (!cid) {
    return { ok: false, status: 400, message: "Invalid company id" };
  }

  const [company] = await db
    .select({
      id: companies.id,
      stripeCustomerId: companies.stripeCustomerId,
    })
    .from(companies)
    .where(eq(companies.id, cid))
    .limit(1);
  if (!company) {
    return { ok: false, status: 404, message: "Company not found" };
  }

  // Prefer refreshing from Stripe when configured, then serve from DB.
  if (getStripeConfig() && company.stripeCustomerId?.trim()) {
    try {
      const stripe = getStripeClient();
      const list = await stripe.invoices.list({
        customer: company.stripeCustomerId.trim(),
        limit: 50,
      });
      for (const inv of list.data) {
        await upsertBillingInvoiceFromStripe({
          companyId: cid,
          invoice: inv,
          markPaid: inv.status === "paid",
        });
      }
    } catch (err) {
      console.warn("listCompanyStripeInvoices Stripe refresh:", err);
    }
  }

  const rows = await db
    .select()
    .from(companyBillingInvoices)
    .where(eq(companyBillingInvoices.companyId, cid))
    .orderBy(desc(companyBillingInvoices.invoiceDate))
    .limit(50);

  const invoices: BillingInvoiceRow[] = rows.map((row) => ({
    id: row.stripeInvoiceId,
    invoiceNumber: row.invoiceNumber || row.stripeInvoiceId,
    invoiceDate: isoDateOnly(row.invoiceDate),
    dueDate: isoDateOnly(row.dueDate) || isoDateOnly(row.invoiceDate),
    status: row.status,
    amount: formatMoneyCents(
      row.status === "paid" ? row.amountPaidCents || row.amountDueCents : row.amountDueCents,
      row.currency,
    ),
    hostedInvoiceUrl: row.hostedInvoiceUrl,
    invoicePdf: row.invoicePdf,
    paymentFailureMessage: row.paymentFailureMessage,
    paymentFailedAt: row.paymentFailedAt
      ? row.paymentFailedAt.toISOString()
      : null,
  }));

  return { ok: true, invoices };
}

function periodEndFromSubscription(sub: Stripe.Subscription): Date | null {
  // Stripe API 2025-03+ / Basil+: period end is on subscription items.
  const end = sub.items?.data?.[0]?.current_period_end ?? null;
  if (end == null || !Number.isFinite(end)) return null;
  return new Date(end * 1000);
}

function priceIdFromSubscription(sub: Stripe.Subscription): string | null {
  const item = sub.items?.data?.[0];
  const price = item?.price;
  if (!price) return null;
  return typeof price === "string" ? price : price.id;
}

function subscriptionIdFromInvoice(inv: Stripe.Invoice): string | null {
  const nested = inv.parent?.subscription_details?.subscription;
  if (nested) {
    return typeof nested === "string" ? nested : nested.id ?? null;
  }
  // Legacy fallback for older API payloads / expansions.
  const legacy = (inv as { subscription?: string | { id?: string } | null })
    .subscription;
  if (!legacy) return null;
  return typeof legacy === "string" ? legacy : legacy.id ?? null;
}

export async function applySubscriptionToCompany(
  companyId: string,
  sub: Stripe.Subscription,
): Promise<void> {
  const cid = normalizeCompanyId(companyId);
  if (!cid) return;

  const priceId = priceIdFromSubscription(sub);
  const mapped = planAndCycleFromPriceId(priceId);
  const metaPlan = String(sub.metadata?.planId ?? "").trim();
  const metaCycle = String(sub.metadata?.billingCycle ?? "").trim();
  const planId =
    mapped.planId ?? normalizeBillingPlanId(metaPlan);
  const cycle =
    mapped.cycle ??
    (metaCycle === "monthly" || metaCycle === "annual" || metaCycle === "yearly"
      ? metaCycle === "yearly"
        ? "annual"
        : (metaCycle as "monthly" | "annual")
      : null);

  const status = String(sub.status ?? "none");
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;

  const clearFailure =
    status === "active" || status === "trialing" || status === "canceled";

  await db
    .update(companies)
    .set({
      stripeCustomerId: customerId,
      stripeSubscriptionId: sub.id,
      stripePlanId: planId,
      stripeBillingCycle: cycle,
      stripeSubscriptionStatus: status || "none",
      stripePriceId: priceId,
      stripeCurrentPeriodEnd: periodEndFromSubscription(sub),
      ...(clearFailure
        ? {
            stripeLastPaymentError: null,
            stripeLastPaymentFailedAt: null,
          }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(companies.id, cid));
}

export async function clearCompanySubscription(
  companyId: string,
  opts?: { keepCustomer?: boolean },
): Promise<void> {
  const cid = normalizeCompanyId(companyId);
  if (!cid) return;
  await db
    .update(companies)
    .set({
      stripeSubscriptionId: null,
      stripePlanId: null,
      stripeBillingCycle: null,
      stripeSubscriptionStatus: "canceled",
      stripePriceId: null,
      stripeCurrentPeriodEnd: null,
      ...(opts?.keepCustomer ? {} : {}),
      updatedAt: new Date(),
    })
    .where(eq(companies.id, cid));
}

async function persistInvoicesForSubscription(params: {
  companyId: string;
  subscriptionId: string;
  customerId?: string | null;
}): Promise<void> {
  const cid = normalizeCompanyId(params.companyId);
  if (!cid) return;
  const stripe = getStripeClient();

  const sub = await stripe.subscriptions.retrieve(params.subscriptionId, {
    expand: ["latest_invoice"],
  });

  const latest = sub.latest_invoice;
  if (latest && typeof latest !== "string") {
    await upsertBillingInvoiceFromStripe({
      companyId: cid,
      invoice: latest,
      markPaid: latest.status === "paid",
      markFailed: latest.status === "open" && (latest.attempt_count ?? 0) > 0,
    });
  } else if (typeof latest === "string" && latest.trim()) {
    const inv = await stripe.invoices.retrieve(latest.trim());
    await upsertBillingInvoiceFromStripe({
      companyId: cid,
      invoice: inv,
      markPaid: inv.status === "paid",
    });
  }

  const customerId =
    params.customerId?.trim() ||
    (typeof sub.customer === "string" ? sub.customer : sub.customer?.id) ||
    "";
  if (customerId) {
    const list = await stripe.invoices.list({
      customer: customerId,
      subscription: params.subscriptionId,
      limit: 10,
    });
    for (const inv of list.data) {
      await upsertBillingInvoiceFromStripe({
        companyId: cid,
        invoice: inv,
        markPaid: inv.status === "paid",
        markFailed: inv.status === "open" && (inv.attempt_count ?? 0) > 0,
      });
    }
  }
}

/**
 * Sync company billing from a Checkout Session id (success redirect).
 * Works locally and in production even if the webhook is delayed/missing briefly.
 */
export async function syncCompanyBillingFromCheckoutSession(params: {
  companyId: string;
  checkoutSessionId: string;
}): Promise<
  | { ok: true; status: CompanyBillingStatus }
  | { ok: false; status: number; message: string }
> {
  if (!getStripeConfig()) {
    return {
      ok: false,
      status: 503,
      message: "Stripe is not configured on the server.",
    };
  }

  const cid = normalizeCompanyId(params.companyId);
  const sessionId = String(params.checkoutSessionId ?? "").trim();
  if (!cid) {
    return { ok: false, status: 400, message: "Invalid company id" };
  }
  if (!sessionId.startsWith("cs_")) {
    return { ok: false, status: 400, message: "Invalid checkout session id" };
  }

  try {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "subscription.latest_invoice", "invoice"],
    });
    if (session.mode !== "subscription") {
      return {
        ok: false,
        status: 400,
        message: "Checkout session is not a subscription.",
      };
    }

    const metaCompany = String(session.metadata?.companyId ?? "").trim();
    const refCompany = String(session.client_reference_id ?? "").trim();
    const sessionCompany = normalizeCompanyId(metaCompany || refCompany);
    if (!sessionCompany || sessionCompany !== cid) {
      return {
        ok: false,
        status: 403,
        message: "Checkout session does not belong to this company.",
      };
    }
    if (session.status !== "complete") {
      return {
        ok: false,
        status: 409,
        message: "Checkout is not complete yet.",
      };
    }

    const subRef = session.subscription;
    const subId = typeof subRef === "string" ? subRef : subRef?.id;
    if (!subId) {
      return {
        ok: false,
        status: 409,
        message: "Subscription is not ready yet. Try again in a moment.",
      };
    }

    const sub =
      typeof subRef === "string"
        ? await stripe.subscriptions.retrieve(subId)
        : (subRef as Stripe.Subscription);
    await applySubscriptionToCompany(cid, sub);

    const customerId =
      typeof session.customer === "string"
        ? session.customer
        : session.customer?.id ?? null;

    // Stripe generates the subscription invoice automatically — persist it in our DB.
    try {
      const sessionInvoice = (
        session as { invoice?: string | Stripe.Invoice | null }
      ).invoice;
      if (sessionInvoice && typeof sessionInvoice !== "string") {
        await upsertBillingInvoiceFromStripe({
          companyId: cid,
          invoice: sessionInvoice,
          markPaid: sessionInvoice.status === "paid",
        });
      } else if (typeof sessionInvoice === "string" && sessionInvoice.trim()) {
        const inv = await stripe.invoices.retrieve(sessionInvoice.trim());
        await upsertBillingInvoiceFromStripe({
          companyId: cid,
          invoice: inv,
          markPaid: inv.status === "paid",
        });
      }
      await persistInvoicesForSubscription({
        companyId: cid,
        subscriptionId: subId,
        customerId,
      });
    } catch (invErr) {
      console.warn("sync checkout invoice snapshot:", invErr);
    }

    await recordBillingEvent({
      companyId: cid,
      eventType: "checkout.session.synced",
      stripeSubscriptionId: subId,
      stripeCustomerId: customerId,
      message: "Checkout session synced from success redirect",
      payload: { sessionId },
    });

    if (customerId) {
      try {
        await syncCompanyPaymentMethodsFromStripe(cid);
      } catch (pmErr) {
        console.warn("sync checkout payment methods:", pmErr);
      }
    }

    const status = await getCompanyBillingStatus(cid);
    if (!status) {
      return { ok: false, status: 404, message: "Company not found" };
    }
    return { ok: true, status };
  } catch (err) {
    console.error("syncCompanyBillingFromCheckoutSession:", err);
    const msg =
      err instanceof Error ? err.message : "Could not sync checkout session";
    return { ok: false, status: 502, message: msg };
  }
}

async function findCompanyIdForStripeCustomer(
  customerId: string,
): Promise<string | null> {
  const id = String(customerId ?? "").trim();
  if (!id) return null;
  const [row] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.stripeCustomerId, id))
    .limit(1);
  return row?.id ?? null;
}

async function findCompanyIdForSubscription(
  subscriptionId: string,
): Promise<string | null> {
  const id = String(subscriptionId ?? "").trim();
  if (!id) return null;
  const [row] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.stripeSubscriptionId, id))
    .limit(1);
  return row?.id ?? null;
}

export type CompanyBillingPaymentMethodDto = {
  id: string;
  stripePaymentMethodId: string;
  stripeCustomerId: string | null;
  type: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  funding: string | null;
  country: string | null;
  fingerprint: string | null;
  billingName: string | null;
  billingEmail: string | null;
  billingPhone: string | null;
  billingAddress: unknown;
  isDefault: boolean;
  livemode: boolean;
  stripeCreatedAt: string | null;
  /** Full Stripe PaymentMethod object snapshot. */
  stripePayload: unknown;
  detachedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function stripeIdRef(
  value: string | { id?: string | null } | null | undefined,
): string | null {
  if (typeof value === "string") {
    const s = value.trim();
    return s || null;
  }
  if (value && typeof value === "object" && typeof value.id === "string") {
    const s = value.id.trim();
    return s || null;
  }
  return null;
}

function paymentMethodRowFields(
  pm: Stripe.PaymentMethod,
  opts?: { isDefault?: boolean },
) {
  const card = pm.card ?? null;
  const bank = pm.us_bank_account ?? null;
  const billing = pm.billing_details ?? null;
  const brand =
    card?.brand?.trim() ||
    bank?.bank_name?.trim() ||
    (pm.type === "link" ? "link" : null);
  const last4 = card?.last4?.trim() || bank?.last4?.trim() || null;
  const fingerprint =
    card?.fingerprint?.trim() || bank?.fingerprint?.trim() || null;
  const country = card?.country?.trim() || null;
  const funding = card?.funding?.trim() || null;

  return {
    stripePaymentMethodId: pm.id,
    stripeCustomerId: stripeIdRef(pm.customer),
    type: (pm.type || "card").trim() || "card",
    brand,
    last4,
    expMonth: card?.exp_month ?? null,
    expYear: card?.exp_year ?? null,
    funding,
    country,
    fingerprint,
    billingName: billing?.name?.trim() || null,
    billingEmail: billing?.email?.trim() || null,
    billingPhone: billing?.phone?.trim() || null,
    billingAddress: billing?.address ?? null,
    isDefault: Boolean(opts?.isDefault),
    livemode: Boolean(pm.livemode),
    stripeCreatedAt:
      typeof pm.created === "number" ? new Date(pm.created * 1000) : null,
    stripePayload: pm as unknown as Record<string, unknown>,
    detachedAt: null as Date | null,
    updatedAt: new Date(),
  };
}

export async function upsertPaymentMethodFromStripe(params: {
  companyId: string;
  paymentMethod: Stripe.PaymentMethod;
  isDefault?: boolean;
}): Promise<void> {
  const cid = normalizeCompanyId(params.companyId);
  if (!cid || !params.paymentMethod?.id) return;
  const fields = paymentMethodRowFields(params.paymentMethod, {
    isDefault: params.isDefault,
  });

  await db
    .insert(companyBillingPaymentMethods)
    .values({
      companyId: cid,
      ...fields,
    })
    .onConflictDoUpdate({
      target: companyBillingPaymentMethods.stripePaymentMethodId,
      set: {
        companyId: cid,
        ...fields,
      },
    });

  if (params.isDefault) {
    await db
      .update(companyBillingPaymentMethods)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(
        and(
          eq(companyBillingPaymentMethods.companyId, cid),
          ne(
            companyBillingPaymentMethods.stripePaymentMethodId,
            params.paymentMethod.id,
          ),
          eq(companyBillingPaymentMethods.isDefault, true),
        ),
      );
  }
}

async function markPaymentMethodDetached(
  stripePaymentMethodId: string,
): Promise<void> {
  const pmId = String(stripePaymentMethodId ?? "").trim();
  if (!pmId) return;
  await db
    .update(companyBillingPaymentMethods)
    .set({
      isDefault: false,
      detachedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(companyBillingPaymentMethods.stripePaymentMethodId, pmId));
}

async function resolveDefaultPaymentMethodId(
  customerId: string,
): Promise<string | null> {
  const stripe = getStripeClient();
  const customer = await stripe.customers.retrieve(customerId);
  if (!customer || ("deleted" in customer && customer.deleted)) return null;
  return stripeIdRef(customer.invoice_settings?.default_payment_method);
}

async function syncDefaultPaymentMethodFlags(params: {
  companyId: string;
  customerId: string;
}): Promise<void> {
  const defaultPmId = await resolveDefaultPaymentMethodId(params.customerId);
  await db
    .update(companyBillingPaymentMethods)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(eq(companyBillingPaymentMethods.companyId, params.companyId));
  if (!defaultPmId) return;
  await db
    .update(companyBillingPaymentMethods)
    .set({ isDefault: true, updatedAt: new Date() })
    .where(
      and(
        eq(companyBillingPaymentMethods.companyId, params.companyId),
        eq(companyBillingPaymentMethods.stripePaymentMethodId, defaultPmId),
        isNull(companyBillingPaymentMethods.detachedAt),
      ),
    );
}

export async function listCompanyPaymentMethods(
  companyId: string,
  opts?: { includeDetached?: boolean },
): Promise<CompanyBillingPaymentMethodDto[]> {
  const cid = normalizeCompanyId(companyId);
  if (!cid) return [];

  const rows = await db
    .select()
    .from(companyBillingPaymentMethods)
    .where(
      opts?.includeDetached
        ? eq(companyBillingPaymentMethods.companyId, cid)
        : and(
            eq(companyBillingPaymentMethods.companyId, cid),
            isNull(companyBillingPaymentMethods.detachedAt),
          ),
    )
    .orderBy(
      desc(companyBillingPaymentMethods.isDefault),
      desc(companyBillingPaymentMethods.createdAt),
    );

  return rows.map((row) => ({
    id: row.id,
    stripePaymentMethodId: row.stripePaymentMethodId,
    stripeCustomerId: row.stripeCustomerId,
    type: row.type,
    brand: row.brand,
    last4: row.last4,
    expMonth: row.expMonth,
    expYear: row.expYear,
    funding: row.funding,
    country: row.country,
    fingerprint: row.fingerprint,
    billingName: row.billingName,
    billingEmail: row.billingEmail,
    billingPhone: row.billingPhone,
    billingAddress: row.billingAddress,
    isDefault: row.isDefault,
    livemode: row.livemode,
    stripeCreatedAt: row.stripeCreatedAt
      ? row.stripeCreatedAt.toISOString()
      : null,
    stripePayload: row.stripePayload,
    detachedAt: row.detachedAt ? row.detachedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

/**
 * Pull all PaymentMethods for the company Stripe customer into the local DB.
 * Safe to call after portal return / checkout when webhooks may be delayed.
 */
export async function syncCompanyPaymentMethodsFromStripe(
  companyId: string,
): Promise<
  | { ok: true; paymentMethods: CompanyBillingPaymentMethodDto[] }
  | { ok: false; status: number; message: string }
> {
  if (!getStripeConfig()) {
    return {
      ok: false,
      status: 503,
      message: "Stripe is not configured on the server.",
    };
  }

  const cid = normalizeCompanyId(companyId);
  if (!cid) {
    return { ok: false, status: 400, message: "Invalid company id" };
  }

  const [co] = await db
    .select({
      id: companies.id,
      stripeCustomerId: companies.stripeCustomerId,
    })
    .from(companies)
    .where(eq(companies.id, cid))
    .limit(1);
  if (!co) {
    return { ok: false, status: 404, message: "Company not found" };
  }
  const customerId = co.stripeCustomerId?.trim() ?? "";
  if (!customerId) {
    return { ok: true, paymentMethods: [] };
  }

  try {
    const stripe = getStripeClient();
    const defaultPmId = await resolveDefaultPaymentMethodId(customerId);
    const listed = await stripe.customers.listPaymentMethods(customerId, {
      limit: 100,
    });
    const activeIds = new Set<string>();

    for (const pm of listed.data) {
      activeIds.add(pm.id);
      await upsertPaymentMethodFromStripe({
        companyId: cid,
        paymentMethod: pm,
        isDefault: defaultPmId ? pm.id === defaultPmId : false,
      });
    }

    const existing = await db
      .select({
        stripePaymentMethodId:
          companyBillingPaymentMethods.stripePaymentMethodId,
        detachedAt: companyBillingPaymentMethods.detachedAt,
      })
      .from(companyBillingPaymentMethods)
      .where(eq(companyBillingPaymentMethods.companyId, cid));

    for (const row of existing) {
      if (!activeIds.has(row.stripePaymentMethodId) && !row.detachedAt) {
        await markPaymentMethodDetached(row.stripePaymentMethodId);
      }
    }

    if (defaultPmId) {
      await db
        .update(companyBillingPaymentMethods)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(
          and(
            eq(companyBillingPaymentMethods.companyId, cid),
            isNull(companyBillingPaymentMethods.detachedAt),
            ne(companyBillingPaymentMethods.stripePaymentMethodId, defaultPmId),
          ),
        );
      await db
        .update(companyBillingPaymentMethods)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(
          and(
            eq(companyBillingPaymentMethods.companyId, cid),
            eq(
              companyBillingPaymentMethods.stripePaymentMethodId,
              defaultPmId,
            ),
          ),
        );
    }

    await recordBillingEvent({
      companyId: cid,
      eventType: "payment_method.synced",
      stripeCustomerId: customerId,
      message: `Synced ${listed.data.length} payment method(s) from Stripe`,
      payload: {
        count: listed.data.length,
        defaultPaymentMethodId: defaultPmId,
      },
    });

    const paymentMethods = await listCompanyPaymentMethods(cid, {
      includeDetached: false,
    });
    return { ok: true, paymentMethods };
  } catch (err) {
    console.error("syncCompanyPaymentMethodsFromStripe:", err);
    const msg =
      err instanceof Error
        ? err.message
        : "Could not sync payment methods from Stripe";
    return { ok: false, status: 502, message: msg };
  }
}

export async function handleStripeWebhookEvent(
  event: Stripe.Event,
): Promise<void> {
  // Idempotency: claim event id first so concurrent Stripe retries are no-ops.
  // If processing throws, release the claim so Stripe can retry successfully.
  const claimed = await claimStripeEvent({
    eventId: event.id,
    eventType: event.type,
    message: "webhook received",
    payload: { livemode: event.livemode },
  });
  if (!claimed) {
    return;
  }

  try {
    await processStripeWebhookEvent(event);
  } catch (err) {
    try {
      await db
        .delete(companyBillingEvents)
        .where(eq(companyBillingEvents.stripeEventId, event.id));
    } catch (releaseErr) {
      console.error(
        "[stripe webhook] failed to release event claim after error:",
        releaseErr,
      );
    }
    throw err;
  }
}

async function processStripeWebhookEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription") return;
      const companyIdRaw =
        String(session.metadata?.companyId ?? "").trim() ||
        String(session.client_reference_id ?? "").trim();
      const companyId = normalizeCompanyId(companyIdRaw);
      const subRef = session.subscription;
      const subId = typeof subRef === "string" ? subRef : subRef?.id;
      if (!companyId || !subId) {
        console.warn(
          `[stripe webhook] ${event.type}: missing companyId/subId`,
          { companyIdRaw, subId },
        );
        return;
      }
      const stripe = getStripeClient();
      const sub = await stripe.subscriptions.retrieve(subId);
      await applySubscriptionToCompany(companyId, sub);
      const customerId =
        typeof session.customer === "string"
          ? session.customer
          : session.customer?.id ?? null;
      try {
        await persistInvoicesForSubscription({
          companyId,
          subscriptionId: subId,
          customerId,
        });
      } catch (invErr) {
        console.warn("[stripe webhook] persist invoice after checkout:", invErr);
      }
      if (customerId) {
        try {
          await syncCompanyPaymentMethodsFromStripe(companyId);
        } catch (pmErr) {
          console.warn(
            "[stripe webhook] sync payment methods after checkout:",
            pmErr,
          );
        }
      }
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const fromMeta = String(sub.metadata?.companyId ?? "").trim();
      const customerId =
        typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
      const companyId =
        normalizeCompanyId(fromMeta) ||
        (await findCompanyIdForSubscription(sub.id)) ||
        (customerId ? await findCompanyIdForStripeCustomer(customerId) : null);
      if (!companyId) {
        console.warn(
          `[stripe webhook] ${event.type}: no company for subscription ${sub.id}`,
        );
        return;
      }
      await applySubscriptionToCompany(companyId, sub);
      return;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const fromMeta = String(sub.metadata?.companyId ?? "").trim();
      const customerId =
        typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
      const companyId =
        normalizeCompanyId(fromMeta) ||
        (await findCompanyIdForSubscription(sub.id)) ||
        (customerId ? await findCompanyIdForStripeCustomer(customerId) : null);
      if (!companyId) return;
      await clearCompanySubscription(companyId, { keepCustomer: true });
      return;
    }
    case "invoice.paid": {
      const inv = event.data.object as Stripe.Invoice;
      const customerId =
        typeof inv.customer === "string" ? inv.customer : inv.customer?.id;
      const subId = subscriptionIdFromInvoice(inv);
      let companyId = customerId
        ? await findCompanyIdForStripeCustomer(customerId)
        : null;
      if (!companyId && subId) {
        companyId = await findCompanyIdForSubscription(subId);
      }
      if (!companyId && subId) {
        try {
          const stripe = getStripeClient();
          const sub = await stripe.subscriptions.retrieve(subId);
          companyId = normalizeCompanyId(sub.metadata?.companyId ?? null);
        } catch {
          /* ignore */
        }
      }
      if (!companyId) {
        console.warn(
          `[stripe webhook] ${event.type}: no company for invoice ${inv.id}`,
        );
        return;
      }
      await upsertBillingInvoiceFromStripe({
        companyId,
        invoice: inv,
        markPaid: true,
      });

      if (subId) {
        try {
          const stripe = getStripeClient();
          const sub = await stripe.subscriptions.retrieve(subId);
          await applySubscriptionToCompany(companyId, sub);
        } catch (err) {
          console.warn("[stripe webhook] invoice.paid sub refresh:", err);
          await db
            .update(companies)
            .set({
              stripeLastPaymentError: null,
              stripeLastPaymentFailedAt: null,
              updatedAt: new Date(),
            })
            .where(eq(companies.id, companyId));
        }
      } else {
        await db
          .update(companies)
          .set({
            stripeLastPaymentError: null,
            stripeLastPaymentFailedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(companies.id, companyId));
      }
      return;
    }
    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice;
      const customerId =
        typeof inv.customer === "string" ? inv.customer : inv.customer?.id;
      const subId = subscriptionIdFromInvoice(inv);
      let companyId = customerId
        ? await findCompanyIdForStripeCustomer(customerId)
        : null;
      if (!companyId && subId) {
        companyId = await findCompanyIdForSubscription(subId);
      }
      if (!companyId) {
        console.warn(
          `[stripe webhook] ${event.type}: no company for invoice ${inv.id}`,
        );
        return;
      }

      const failMsg =
        inv.last_finalization_error?.message?.trim() ||
        "Invoice payment failed. Update your payment method in Manage billing.";

      await upsertBillingInvoiceFromStripe({
        companyId,
        invoice: inv,
        markFailed: true,
        paymentFailureMessage: failMsg,
      });

      const [row] = await db
        .select({ status: companies.stripeSubscriptionStatus })
        .from(companies)
        .where(eq(companies.id, companyId))
        .limit(1);
      const current = String(row?.status ?? "none");
      const canMarkPastDue = new Set([
        "active",
        "trialing",
        "past_due",
        "unpaid",
        "incomplete",
        "none",
      ]).has(current);

      await db
        .update(companies)
        .set({
          ...(canMarkPastDue ? { stripeSubscriptionStatus: "past_due" } : {}),
          stripeLastPaymentError: failMsg,
          stripeLastPaymentFailedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(companies.id, companyId));
      return;
    }
    case "payment_method.attached":
    case "payment_method.updated":
    case "payment_method.automatically_updated": {
      const pm = event.data.object as Stripe.PaymentMethod;
      const customerId = stripeIdRef(pm.customer);
      const companyId = customerId
        ? await findCompanyIdForStripeCustomer(customerId)
        : null;
      if (!companyId || !customerId) {
        console.warn(
          `[stripe webhook] ${event.type}: no company for payment method ${pm.id}`,
        );
        return;
      }
      let isDefault = false;
      try {
        const defaultPmId = await resolveDefaultPaymentMethodId(customerId);
        isDefault = Boolean(defaultPmId && defaultPmId === pm.id);
      } catch (err) {
        console.warn(
          `[stripe webhook] ${event.type}: could not resolve default PM:`,
          err,
        );
      }
      await upsertPaymentMethodFromStripe({
        companyId,
        paymentMethod: pm,
        isDefault,
      });
      return;
    }
    case "payment_method.detached": {
      const pm = event.data.object as Stripe.PaymentMethod;
      await markPaymentMethodDetached(pm.id);
      return;
    }
    case "customer.updated": {
      const customer = event.data.object as Stripe.Customer;
      const companyId = await findCompanyIdForStripeCustomer(customer.id);
      if (!companyId) return;
      try {
        await syncDefaultPaymentMethodFlags({
          companyId,
          customerId: customer.id,
        });
      } catch (err) {
        console.warn("[stripe webhook] customer.updated default PM sync:", err);
      }
      return;
    }
    default:
      return;
  }
}
