import { and, eq, sql } from "drizzle-orm";
import {
  appendEsignSendToBundle,
  esignBundleHasPending,
  esignBundleIsAllCompleted,
  parseEsignStatusBundle,
  parseEsignStatusJson,
  serializeEsignStatusBundle,
  type DealInvestorEsignDocumentRef,
  type StoredDealInvestorEsignSend,
} from "../../constants/deal-investor-esign-status.js";
import {
  DOC_SIGNED_ESIGN_COMPLETED,
  DOC_SIGNED_ESIGN_PENDING,
} from "../../constants/deal-doc-signed.js";
import { db } from "../../database/db.js";
import { users } from "../../schema/auth.schema/signin.js";
import { dealInvestment } from "../../schema/deal.schema/deal-investment.schema.js";
import { dealLpInvestor } from "../../schema/deal.schema/deal-lp-investor.schema.js";

type InvestorEsignRowTarget = {
  table: "investment" | "lp";
  id: string;
};

async function resolveInvestorEsignTarget(
  dealId: string,
  opts: { rosterId?: string; toEmail?: string },
): Promise<InvestorEsignRowTarget | null> {
  const id = opts.rosterId?.trim();
  if (id) {
    const [inv] = await db
      .select({ id: dealInvestment.id })
      .from(dealInvestment)
      .where(
        and(eq(dealInvestment.id, id), eq(dealInvestment.dealId, dealId)),
      )
      .limit(1);
    if (inv) return { table: "investment", id: inv.id };

    const [lp] = await db
      .select({ id: dealLpInvestor.id })
      .from(dealLpInvestor)
      .where(and(eq(dealLpInvestor.id, id), eq(dealLpInvestor.dealId, dealId)))
      .limit(1);
    if (lp) return { table: "lp", id: lp.id };
  }

  const email = opts.toEmail?.trim().toLowerCase();
  if (!email || !email.includes("@")) return null;

  const [lpByEmail] = await db
    .select({ id: dealLpInvestor.id })
    .from(dealLpInvestor)
    .where(
      and(
        eq(dealLpInvestor.dealId, dealId),
        sql`lower(trim(${dealLpInvestor.email})) = ${email}`,
      ),
    )
    .limit(1);
  if (lpByEmail) return { table: "lp", id: lpByEmail.id };

  const [portalUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(trim(${users.email})) = ${email}`)
    .limit(1);
  if (portalUser?.id) {
    const uid = String(portalUser.id).trim().toLowerCase();
    const investments = await db
      .select({ id: dealInvestment.id, contactId: dealInvestment.contactId })
      .from(dealInvestment)
      .where(eq(dealInvestment.dealId, dealId));
    for (const inv of investments) {
      if (String(inv.contactId ?? "").trim().toLowerCase() === uid) {
        return { table: "investment", id: inv.id };
      }
    }
  }

  return null;
}

async function applyInvestorEsignPatch(
  target: InvestorEsignRowTarget,
  patch: {
    docSignedDate: string;
    esignStatusJson: string;
  },
): Promise<void> {
  if (target.table === "investment") {
    await db
      .update(dealInvestment)
      .set(patch)
      .where(eq(dealInvestment.id, target.id));
    return;
  }
  await db
    .update(dealLpInvestor)
    .set(patch)
    .where(eq(dealLpInvestor.id, target.id));
}

export async function readInvestorEsignStatusJson(
  dealId: string,
  target: InvestorEsignRowTarget,
): Promise<string | null> {
  if (target.table === "investment") {
    const [row] = await db
      .select({ esignStatusJson: dealInvestment.esignStatusJson })
      .from(dealInvestment)
      .where(
        and(
          eq(dealInvestment.id, target.id),
          eq(dealInvestment.dealId, dealId),
        ),
      )
      .limit(1);
    return row?.esignStatusJson ?? null;
  }
  const [row] = await db
    .select({ esignStatusJson: dealLpInvestor.esignStatusJson })
    .from(dealLpInvestor)
    .where(
      and(eq(dealLpInvestor.id, target.id), eq(dealLpInvestor.dealId, dealId)),
    )
    .limit(1);
  return row?.esignStatusJson ?? null;
}

/**
 * After send-esign, mark Signed as pending and store workflow timestamps (sent → …).
 */
export async function markDealInvestorEsignPending(
  dealId: string,
  opts: {
    rosterId?: string;
    toEmail?: string;
    documents?: DealInvestorEsignDocumentRef[];
    signatureRequestId?: string;
    signatureId?: string;
  },
): Promise<void> {
  const target = await resolveInvestorEsignTarget(dealId, opts);
  if (!target) return;

  const raw = await readInvestorEsignStatusJson(dealId, target);
  const existing = parseEsignStatusBundle(raw) ?? { version: 2 as const, sends: [] };
  const bundle = appendEsignSendToBundle(existing, {
    documents: opts.documents ?? [],
    signatureRequestId: opts.signatureRequestId,
    signatureId: opts.signatureId,
  });

  const docSignedDate = esignBundleIsAllCompleted(bundle)
    ? DOC_SIGNED_ESIGN_COMPLETED
    : DOC_SIGNED_ESIGN_PENDING;

  await applyInvestorEsignPatch(target, {
    docSignedDate,
    esignStatusJson: serializeEsignStatusBundle(bundle),
  });
}

export async function updateDealInvestorEsignSend(
  dealId: string,
  target: InvestorEsignRowTarget,
  signatureRequestId: string,
  updater: (current: StoredDealInvestorEsignSend) => StoredDealInvestorEsignSend,
): Promise<void> {
  const raw = await readInvestorEsignStatusJson(dealId, target);
  const bundle = parseEsignStatusBundle(raw);
  if (!bundle?.sends.length) return;

  const sigId = signatureRequestId.trim();
  const idx = bundle.sends.findIndex(
    (s) => s.signatureRequestId?.trim() === sigId,
  );
  if (idx < 0) return;

  bundle.sends[idx] = updater(bundle.sends[idx]!);

  const docSignedDate = esignBundleIsAllCompleted(bundle)
    ? DOC_SIGNED_ESIGN_COMPLETED
    : esignBundleHasPending(bundle)
      ? DOC_SIGNED_ESIGN_PENDING
      : DOC_SIGNED_ESIGN_COMPLETED;

  await applyInvestorEsignPatch(target, {
    docSignedDate,
    esignStatusJson: serializeEsignStatusBundle(bundle),
  });
}

/** @deprecated Prefer updateDealInvestorEsignSend — updates the only / first matching send. */
export async function updateDealInvestorEsignStatus(
  dealId: string,
  target: InvestorEsignRowTarget,
  updater: (current: StoredDealInvestorEsignSend) => StoredDealInvestorEsignSend,
): Promise<void> {
  const raw = await readInvestorEsignStatusJson(dealId, target);
  const bundle = parseEsignStatusBundle(raw);
  if (!bundle?.sends.length) return;

  const sigId =
    bundle.sends.find((s) => !s.completedAt?.trim())?.signatureRequestId?.trim() ??
    bundle.sends[bundle.sends.length - 1]?.signatureRequestId?.trim();
  if (!sigId) return;

  await updateDealInvestorEsignSend(dealId, target, sigId, updater);
}

export async function findInvestorEsignTargetBySignatureRequestId(
  dealId: string,
  signatureRequestId: string,
): Promise<InvestorEsignRowTarget | null> {
  const sigId = signatureRequestId.trim();
  if (!sigId) return null;

  const investments = await db
    .select({
      id: dealInvestment.id,
      esignStatusJson: dealInvestment.esignStatusJson,
    })
    .from(dealInvestment)
    .where(eq(dealInvestment.dealId, dealId));

  for (const row of investments) {
    const bundle = parseEsignStatusBundle(row.esignStatusJson);
    if (bundle?.sends.some((s) => s.signatureRequestId?.trim() === sigId)) {
      return { table: "investment", id: row.id };
    }
  }

  const lps = await db
    .select({
      id: dealLpInvestor.id,
      esignStatusJson: dealLpInvestor.esignStatusJson,
    })
    .from(dealLpInvestor)
    .where(eq(dealLpInvestor.dealId, dealId));

  for (const row of lps) {
    const bundle = parseEsignStatusBundle(row.esignStatusJson);
    if (bundle?.sends.some((s) => s.signatureRequestId?.trim() === sigId)) {
      return { table: "lp", id: row.id };
    }
  }

  return null;
}

export async function findInvestorEsignTargetByMetadata(
  dealId: string,
  rosterId: string,
): Promise<InvestorEsignRowTarget | null> {
  return resolveInvestorEsignTarget(dealId, { rosterId });
}

/** First LP or investment row for this investor email on the deal (for portal document access). */
export async function findInvestorEsignTargetForEmail(
  dealId: string,
  email: string,
): Promise<InvestorEsignRowTarget | null> {
  return resolveInvestorEsignTarget(dealId, { toEmail: email });
}

/**
 * Active eSign row for the signed-in portal user — only rows with `sentAt`,
 * preferring the most recently sent request (avoids wrong LP match without eSign).
 */
export async function findInvestorEsignTargetForPortalUser(
  dealId: string,
  opts: { email: string; userId: string },
): Promise<InvestorEsignRowTarget | null> {
  const email = normEmail(opts.email);
  const uid = opts.userId.trim().toLowerCase();
  const candidates: Array<{
    target: InvestorEsignRowTarget;
    sentAt: string;
  }> = [];

  const investments = await db
    .select({
      id: dealInvestment.id,
      esignStatusJson: dealInvestment.esignStatusJson,
      contactId: dealInvestment.contactId,
    })
    .from(dealInvestment)
    .where(eq(dealInvestment.dealId, dealId));

  const pushInvestment = (inv: { id: string; esignStatusJson: string | null }) => {
    const bundle = parseEsignStatusBundle(inv.esignStatusJson);
    if (!bundle?.sends.some((s) => s.sentAt?.trim())) return;
    const latestSentAt = bundle.sends.reduce((max, s) => {
      const t = new Date(s.sentAt).getTime();
      return t > max ? t : max;
    }, 0);
    if (!latestSentAt) return;
    if (candidates.some((c) => c.target.table === "investment" && c.target.id === inv.id)) {
      return;
    }
    candidates.push({
      target: { table: "investment", id: inv.id },
      sentAt: new Date(latestSentAt).toISOString(),
    });
  };

  if (uid) {
    for (const inv of investments) {
      if (String(inv.contactId ?? "").trim().toLowerCase() !== uid) continue;
      pushInvestment(inv);
    }
  }

  if (email) {
    const [portalUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(trim(${users.email})) = ${email}`)
      .limit(1);
    const portalUid = portalUser?.id
      ? String(portalUser.id).trim().toLowerCase()
      : "";
    if (portalUid) {
      for (const inv of investments) {
        if (String(inv.contactId ?? "").trim().toLowerCase() !== portalUid) {
          continue;
        }
        pushInvestment(inv);
      }
    }
  }

  const lps = await db
    .select({
      id: dealLpInvestor.id,
      esignStatusJson: dealLpInvestor.esignStatusJson,
      email: dealLpInvestor.email,
    })
    .from(dealLpInvestor)
    .where(eq(dealLpInvestor.dealId, dealId));

  for (const lp of lps) {
    const bundle = parseEsignStatusBundle(lp.esignStatusJson);
    if (!bundle?.sends.some((s) => s.sentAt?.trim())) continue;
    const st = bundle.sends.reduce((latest, s) =>
      !latest || new Date(s.sentAt).getTime() > new Date(latest.sentAt).getTime()
        ? s
        : latest,
    );
    if (!email || normEmail(String(lp.email ?? "")) !== email) continue;
    candidates.push({
      target: { table: "lp", id: lp.id },
      sentAt: st.sentAt,
    });
  }

  if (candidates.length === 0) return null;

  candidates.sort(
    (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
  );
  return candidates[0]!.target;
}

function normEmail(s: string): string {
  return s.trim().toLowerCase();
}

export type { InvestorEsignRowTarget };
