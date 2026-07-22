import { portalAuthHeaders } from "../../../common/auth/portalAuthHeaders"
import { getApiV1Base } from "../../../common/utils/apiBaseUrl"

export type StripeBillingPlanId = "starter" | "running" | "growth"

export type CompanyBillingStatus = {
  configured: boolean
  testMode: boolean
  webhookConfigured?: boolean
  companyId: string
  planId: string | null
  billingCycle: string | null
  subscriptionStatus: string
  priceId: string | null
  currentPeriodEnd: string | null
  hasCustomer: boolean
  hasSubscription: boolean
  lastPaymentError?: string | null
  lastPaymentFailedAt?: string | null
  paymentHealthy?: boolean
  plansConfigured: Array<{
    id: StripeBillingPlanId | string
    monthlyReady: boolean
    annualReady: boolean
    monthlyEnv?: string
    annualEnv?: string
  }>
}

export type CompanyBillingInvoice = {
  id: string
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
  status: string
  amount: string
  hostedInvoiceUrl: string | null
  invoicePdf: string | null
  paymentFailureMessage?: string | null
  paymentFailedAt?: string | null
}

export type CompanyBillingPaymentMethod = {
  id: string
  stripePaymentMethodId: string
  stripeCustomerId: string | null
  type: string
  brand: string | null
  last4: string | null
  expMonth: number | null
  expYear: number | null
  funding: string | null
  country: string | null
  fingerprint: string | null
  billingName: string | null
  billingEmail: string | null
  billingPhone: string | null
  billingAddress: unknown
  isDefault: boolean
  livemode: boolean
  stripeCreatedAt: string | null
  stripePayload: unknown
  detachedAt: string | null
  createdAt: string
  updatedAt: string
}

function authHeaders(): Record<string, string> {
  return portalAuthHeaders() as Record<string, string>
}

function messageFromBody(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const m = (data as { message?: unknown }).message
    if (typeof m === "string" && m.trim()) return m.trim()
  }
  return fallback
}

export async function fetchCompanyBillingStatus(
  companyId: string,
): Promise<
  | { ok: true; status: CompanyBillingStatus }
  | { ok: false; message: string; statusCode: number }
> {
  const base = getApiV1Base()
  if (!base) {
    return {
      ok: false,
      message: "API is not configured (VITE_BASE_URL).",
      statusCode: 0,
    }
  }
  try {
    const res = await fetch(
      `${base}/companies/${encodeURIComponent(companyId)}/billing`,
      { headers: authHeaders(), credentials: "include" },
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return {
        ok: false,
        message: messageFromBody(data, `Could not load billing (${res.status}).`),
        statusCode: res.status,
      }
    }
    return { ok: true, status: data as CompanyBillingStatus }
  } catch {
    return {
      ok: false,
      message: "Network error loading billing status.",
      statusCode: 0,
    }
  }
}

export async function startCompanyBillingCheckout(
  companyId: string,
  planId: string,
  billingCycle: "monthly" | "annually",
): Promise<
  | { ok: true; url: string }
  | { ok: false; message: string; statusCode: number }
> {
  const base = getApiV1Base()
  if (!base) {
    return {
      ok: false,
      message: "API is not configured (VITE_BASE_URL).",
      statusCode: 0,
    }
  }
  try {
    const res = await fetch(
      `${base}/companies/${encodeURIComponent(companyId)}/billing/checkout`,
      {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          planId,
          billingCycle: billingCycle === "annually" ? "yearly" : "monthly",
        }),
      },
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return {
        ok: false,
        message: messageFromBody(data, `Checkout failed (${res.status}).`),
        statusCode: res.status,
      }
    }
    const url =
      data && typeof data === "object"
        ? String((data as { url?: unknown }).url ?? "").trim()
        : ""
    if (!url) {
      return {
        ok: false,
        message: "Checkout did not return a Stripe URL.",
        statusCode: res.status,
      }
    }
    return { ok: true, url }
  } catch {
    return {
      ok: false,
      message: "Network error starting checkout.",
      statusCode: 0,
    }
  }
}

export async function openCompanyBillingPortal(
  companyId: string,
): Promise<
  | { ok: true; url: string }
  | { ok: false; message: string; statusCode: number }
> {
  const base = getApiV1Base()
  if (!base) {
    return {
      ok: false,
      message: "API is not configured (VITE_BASE_URL).",
      statusCode: 0,
    }
  }
  try {
    const res = await fetch(
      `${base}/companies/${encodeURIComponent(companyId)}/billing/portal`,
      {
        method: "POST",
        headers: authHeaders(),
        credentials: "include",
      },
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return {
        ok: false,
        message: messageFromBody(data, `Billing portal failed (${res.status}).`),
        statusCode: res.status,
      }
    }
    const url =
      data && typeof data === "object"
        ? String((data as { url?: unknown }).url ?? "").trim()
        : ""
    if (!url) {
      return {
        ok: false,
        message: "Portal did not return a Stripe URL.",
        statusCode: res.status,
      }
    }
    return { ok: true, url }
  } catch {
    return {
      ok: false,
      message: "Network error opening billing portal.",
      statusCode: 0,
    }
  }
}

export async function syncCompanyBillingCheckout(
  companyId: string,
  sessionId: string,
): Promise<
  | { ok: true; status: CompanyBillingStatus }
  | { ok: false; message: string; statusCode: number }
> {
  const base = getApiV1Base()
  if (!base) {
    return {
      ok: false,
      message: "API is not configured (VITE_BASE_URL).",
      statusCode: 0,
    }
  }
  try {
    const res = await fetch(
      `${base}/companies/${encodeURIComponent(companyId)}/billing/sync-checkout`,
      {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ sessionId }),
      },
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return {
        ok: false,
        message: messageFromBody(data, `Could not sync checkout (${res.status}).`),
        statusCode: res.status,
      }
    }
    return { ok: true, status: data as CompanyBillingStatus }
  } catch {
    return {
      ok: false,
      message: "Network error syncing checkout.",
      statusCode: 0,
    }
  }
}

export async function fetchCompanyBillingInvoices(
  companyId: string,
): Promise<
  | { ok: true; invoices: CompanyBillingInvoice[] }
  | { ok: false; message: string; statusCode: number }
> {
  const base = getApiV1Base()
  if (!base) {
    return {
      ok: false,
      message: "API is not configured (VITE_BASE_URL).",
      statusCode: 0,
    }
  }
  try {
    const res = await fetch(
      `${base}/companies/${encodeURIComponent(companyId)}/billing/invoices`,
      { headers: authHeaders(), credentials: "include" },
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return {
        ok: false,
        message: messageFromBody(data, `Could not load invoices (${res.status}).`),
        statusCode: res.status,
      }
    }
    const list =
      data &&
      typeof data === "object" &&
      Array.isArray((data as { invoices?: unknown }).invoices)
        ? (data as { invoices: CompanyBillingInvoice[] }).invoices
        : []
    return { ok: true, invoices: list }
  } catch {
    return {
      ok: false,
      message: "Network error loading invoices.",
      statusCode: 0,
    }
  }
}

export async function fetchCompanyBillingPaymentMethods(
  companyId: string,
): Promise<
  | { ok: true; paymentMethods: CompanyBillingPaymentMethod[] }
  | { ok: false; message: string; statusCode: number }
> {
  const base = getApiV1Base()
  if (!base) {
    return {
      ok: false,
      message: "API is not configured (VITE_BASE_URL).",
      statusCode: 0,
    }
  }
  try {
    const res = await fetch(
      `${base}/companies/${encodeURIComponent(companyId)}/billing/payment-methods`,
      { headers: authHeaders(), credentials: "include" },
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return {
        ok: false,
        message: messageFromBody(
          data,
          `Could not load payment methods (${res.status}).`,
        ),
        statusCode: res.status,
      }
    }
    const list =
      data &&
      typeof data === "object" &&
      Array.isArray((data as { paymentMethods?: unknown }).paymentMethods)
        ? (data as { paymentMethods: CompanyBillingPaymentMethod[] }).paymentMethods
        : []
    return { ok: true, paymentMethods: list }
  } catch {
    return {
      ok: false,
      message: "Network error loading payment methods.",
      statusCode: 0,
    }
  }
}

export async function syncCompanyBillingPaymentMethods(
  companyId: string,
): Promise<
  | { ok: true; paymentMethods: CompanyBillingPaymentMethod[] }
  | { ok: false; message: string; statusCode: number }
> {
  const base = getApiV1Base()
  if (!base) {
    return {
      ok: false,
      message: "API is not configured (VITE_BASE_URL).",
      statusCode: 0,
    }
  }
  try {
    const res = await fetch(
      `${base}/companies/${encodeURIComponent(companyId)}/billing/sync-payment-methods`,
      {
        method: "POST",
        headers: authHeaders(),
        credentials: "include",
      },
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return {
        ok: false,
        message: messageFromBody(
          data,
          `Could not sync payment methods (${res.status}).`,
        ),
        statusCode: res.status,
      }
    }
    const list =
      data &&
      typeof data === "object" &&
      Array.isArray((data as { paymentMethods?: unknown }).paymentMethods)
        ? (data as { paymentMethods: CompanyBillingPaymentMethod[] }).paymentMethods
        : []
    return { ok: true, paymentMethods: list }
  } catch {
    return {
      ok: false,
      message: "Network error syncing payment methods.",
      statusCode: 0,
    }
  }
}
