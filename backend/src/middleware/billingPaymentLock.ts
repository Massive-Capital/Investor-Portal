/**
 * In-process lock so a deal can start only one SaaS payment at a time.
 * Does not charge or talk to Stripe — it only gates overlapping starts.
 */

const IN_FLIGHT_MS = 60_000;
/** After Checkout opens, block a second start briefly so two Stripe tabs are not created. */
const PENDING_CHECKOUT_MS = 90_000;

type HoldKind = "inflight" | "pending";

type Hold = {
  kind: HoldKind;
  until: number;
};

const holds = new Map<string, Hold>();

function now(): number {
  return Date.now();
}

function sweep(): void {
  const t = now();
  for (const [key, hold] of holds) {
    if (hold.until <= t) holds.delete(key);
  }
}

export function billingPaymentLockKey(
  companyId: string,
  dealId: string,
): string {
  return `${companyId.trim().toLowerCase()}:${dealId.trim().toLowerCase()}`;
}

export function hasBillingPaymentHold(key: string): boolean {
  sweep();
  const hold = holds.get(key);
  return Boolean(hold && hold.until > now());
}

/** Take the in-flight lock. Returns false if another payment is already running. */
export function acquireBillingPaymentHold(key: string): boolean {
  if (hasBillingPaymentHold(key)) return false;
  holds.set(key, { kind: "inflight", until: now() + IN_FLIGHT_MS });
  return true;
}

/**
 * After the request ends:
 * - success on Checkout / Payment Element → keep a short pending hold
 * - anything else → release so they can retry
 */
export function finishBillingPaymentHold(
  key: string,
  statusCode: number,
  keepPending: boolean,
): void {
  if (statusCode >= 200 && statusCode < 300 && keepPending) {
    holds.set(key, { kind: "pending", until: now() + PENDING_CHECKOUT_MS });
    return;
  }
  holds.delete(key);
}

export function releaseBillingPaymentHold(
  companyId: string,
  dealId: string,
): void {
  const cid = String(companyId ?? "").trim();
  const did = String(dealId ?? "").trim();
  if (!cid || !did) return;
  holds.delete(billingPaymentLockKey(cid, did));
}
