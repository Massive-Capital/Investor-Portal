/**
 * Distribution Setup — load/save waterfall payment rows.
 * Prior distributions are backend-sourced (not edited in the simulator).
 * Classes + promote come from Class Setup; this module stores waterfalls + prior history.
 */

import { and, eq } from "drizzle-orm";
import { db } from "../../database/db.js";
import { addDealForm } from "../../schema/deal.schema/add-deal-form.schema.js";
import { dealLpInvestor } from "../../schema/deal.schema/deal-lp-investor.schema.js";
import { getClassSetupBundle } from "../classSetup/classSetup.service.js";
import {
  fundedNumericForInvestorKpiRow,
  listDealInvestmentsByDealId,
  mapDealInvestmentsToInvestorApi,
} from "../deal/dealInvestment.service.js";
import {
  assertDealIdReadableOrAssignedParticipant,
  type DealViewerScope,
} from "../deal/dealAccess.service.js";
import {
  normalizePayToAgainstClasses,
  parseDistributionSetupDocument,
  seedDefaultPayTo,
  serializeDistributionSetupJson,
} from "./distributionSetup.mapper.js";
import type {
  DistributionSetupBundle,
  DistributionSetupSaveInput,
  DistributionWaterfalls,
  DistributionWfSource,
  PriorDistributionRecord,
} from "./distributionSetup.types.js";
import { emptyWaterfalls } from "./distributionSetup.types.js";
import {
  allocateByCapitalFallback,
  filterPaymentsForViewer,
  listViewerInvestmentMatchKeys,
  serializeInvestorPaymentLines,
  type InvestorPaymentLine,
  type InvestorPaymentLineInput,
} from "./investorDistributionAllocation.js";

function newDistributionId(): string {
  return `dist_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function formatUsdPlain(n: number): string {
  const v = Number.isFinite(n) ? Math.max(0, n) : 0;
  return String(Math.round(v * 100) / 100);
}

export async function getDistributionSetupBundle(
  dealId: string,
): Promise<DistributionSetupBundle | null> {
  const classBundle = await getClassSetupBundle(dealId);
  if (!classBundle) return null;

  const [deal] = await db
    .select({
      distributionSetupJson: addDealForm.distributionSetupJson,
    })
    .from(addDealForm)
    .where(eq(addDealForm.id, dealId))
    .limit(1);

  const parsed = parseDistributionSetupDocument(
    deal?.distributionSetupJson ?? "{}",
  );
  let waterfalls = parsed.waterfalls;

  const classIds = new Set(
    classBundle.classes.map((c) => c.id).filter((id): id is string => Boolean(id)),
  );
  const classRefs = classBundle.classes
    .filter((c) => c.id)
    .map((c) => ({ id: c.id as string, classType: c.classType }));

  waterfalls = seedDefaultPayTo(waterfalls, classRefs);
  waterfalls = normalizePayToAgainstClasses(waterfalls, classIds);

  return {
    dealId: classBundle.dealId,
    dealName: classBundle.dealName,
    targetRaise: classBundle.meta.targetRaise,
    waterfalls,
    priorDistributions: parsed.priorDistributions,
    classes: classBundle.classes
      .filter((c) => c.id)
      .map((c) => ({
        id: c.id as string,
        name: c.name,
        classType: c.classType,
        actuallyFunded: c.actuallyFunded,
        equityPct: c.equityPct,
        preferredReturn: {
          enabled: c.preferredReturn.enabled,
          rate: c.preferredReturn.rate,
        },
        prefEquity: { ...c.prefEquity },
        mezz: { ...c.mezz },
      })),
    promote: {
      hurdles: classBundle.meta.promote.hurdles.map((h) => ({
        id: h.id,
        rate: h.rate,
        basis: h.basis,
        measuredOn: h.measuredOn,
      })),
      shares: classBundle.meta.promote.shares,
    },
  };
}

export async function saveDistributionSetupBundle(params: {
  dealId: string;
  input: DistributionSetupSaveInput;
}): Promise<{ bundle: DistributionSetupBundle; error?: string }> {
  const existing = await getDistributionSetupBundle(params.dealId);
  if (!existing) {
    return {
      bundle: {
        dealId: params.dealId,
        dealName: "",
        targetRaise: "0",
        waterfalls: emptyWaterfalls(),
        priorDistributions: [],
        classes: [],
        promote: { hurdles: [], shares: {} },
      },
      error: "Deal not found",
    };
  }

  const classIds = new Set(existing.classes.map((c) => c.id));
  const waterfalls: DistributionWaterfalls = normalizePayToAgainstClasses(
    {
      operating: params.input.waterfalls?.operating ?? [],
      capital: params.input.waterfalls?.capital ?? [],
    },
    classIds,
  );

  if (waterfalls.operating.length === 0 && waterfalls.capital.length === 0) {
    return { bundle: existing, error: "At least one payment row is required" };
  }

  // Preserve backend prior distributions — waterfall save must not wipe history.
  await db
    .update(addDealForm)
    .set({
      distributionSetupJson: serializeDistributionSetupJson(
        waterfalls,
        existing.priorDistributions,
      ),
    })
    .where(eq(addDealForm.id, params.dealId));

  const bundle = await getDistributionSetupBundle(params.dealId);
  return { bundle: bundle ?? { ...existing, waterfalls } };
}

export type CompleteDistributionInput = {
  source: DistributionWfSource;
  amount: number;
  date?: string;
  name?: string;
  notes?: string;
  period?: "monthly" | "quarterly" | "annual";
  /** Waterfall-accurate investor lines from the simulator (optional). */
  investorPayments?: InvestorPaymentLineInput[];
};

/**
 * Record a completed distribution run (appends to priorDistributions).
 * Does not change waterfall configuration.
 */
export async function completeDistributionRun(params: {
  dealId: string;
  input: CompleteDistributionInput;
}): Promise<{ bundle: DistributionSetupBundle; error?: string; record?: PriorDistributionRecord }> {
  const amount = Number(params.input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    const existing = await getDistributionSetupBundle(params.dealId);
    return {
      bundle:
        existing ??
        ({
          dealId: params.dealId,
          dealName: "",
          targetRaise: "0",
          waterfalls: emptyWaterfalls(),
          priorDistributions: [],
          classes: [],
          promote: { hurdles: [], shares: {} },
        } satisfies DistributionSetupBundle),
      error: "Cash amount must be greater than zero",
    };
  }

  const [deal] = await db
    .select({
      distributionSetupJson: addDealForm.distributionSetupJson,
    })
    .from(addDealForm)
    .where(eq(addDealForm.id, params.dealId))
    .limit(1);

  if (!deal) {
    return {
      bundle: {
        dealId: params.dealId,
        dealName: "",
        targetRaise: "0",
        waterfalls: emptyWaterfalls(),
        priorDistributions: [],
        classes: [],
        promote: { hurdles: [], shares: {} },
      },
      error: "Deal not found",
    };
  }

  const parsed = parseDistributionSetupDocument(
    deal.distributionSetupJson ?? "{}",
  );
  const source: DistributionWfSource =
    params.input.source === "capital" ? "capital" : "operating";
  const date =
    params.input.date && /^\d{4}-\d{2}-\d{2}/.test(params.input.date.trim())
      ? params.input.date.trim().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
  const name =
    params.input.name?.trim() ||
    (source === "capital"
      ? `Capital event · ${date}`
      : `Operating · ${date}`);
  const notes = params.input.notes?.trim() || "";
  const periodRaw = params.input.period;
  const period =
    periodRaw === "monthly" ||
    periodRaw === "quarterly" ||
    periodRaw === "annual"
      ? periodRaw
      : undefined;

  let investorPayments = serializeInvestorPaymentLines(
    params.input.investorPayments,
  );
  if (investorPayments.length === 0) {
    investorPayments = await buildFallbackInvestorPayments(
      params.dealId,
      amount,
    );
  }

  const record: PriorDistributionRecord = {
    id: newDistributionId(),
    amount: formatUsdPlain(amount),
    date,
    source,
    name,
    ...(notes ? { notes } : {}),
    ...(period ? { period } : {}),
    ...(investorPayments.length ? { investorPayments } : {}),
  };

  const nextPriors = [...parsed.priorDistributions, record].sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  await db
    .update(addDealForm)
    .set({
      distributionSetupJson: serializeDistributionSetupJson(
        parsed.waterfalls,
        nextPriors,
      ),
    })
    .where(eq(addDealForm.id, params.dealId));

  const bundle = await getDistributionSetupBundle(params.dealId);
  if (!bundle) {
    return {
      bundle: {
        dealId: params.dealId,
        dealName: "",
        targetRaise: "0",
        waterfalls: parsed.waterfalls,
        priorDistributions: nextPriors,
        classes: [],
        promote: { hurdles: [], shares: {} },
      },
      error: "DISTRIBUTION_COMPLETE_RELOAD_FAILED",
    };
  }
  return { bundle, record };
}

async function buildFallbackInvestorPayments(
  dealId: string,
  amount: number,
): Promise<InvestorPaymentLine[]> {
  const classBundle = await getClassSetupBundle(dealId);
  const rows = await listDealInvestmentsByDealId(dealId);
  const apiRows = await mapDealInvestmentsToInvestorApi(rows);
  const roster = await db
    .select()
    .from(dealLpInvestor)
    .where(eq(dealLpInvestor.dealId, dealId));
  const pctByContact = new Map<string, string>();
  for (const m of roster) {
    const contactKey = String(m.contactMemberId ?? "")
      .trim()
      .toLowerCase();
    if (!contactKey) continue;
    pctByContact.set(
      contactKey,
      String(m.percentOfClassDistributions ?? "").trim(),
    );
  }
  const investors = apiRows.map((r, i) => {
    const dbRow = rows[i];
    const capital = dbRow
      ? fundedNumericForInvestorKpiRow(dbRow)
      : Number(String(r.committed ?? "").replace(/[^0-9.-]/g, "")) || 0;
    const contactKey = String(r.contactId ?? "")
      .trim()
      .toLowerCase();
    return {
      id: String(r.id ?? ""),
      contactId: String(r.contactId ?? ""),
      userEmail: String(r.userEmail ?? ""),
      displayName: String(r.displayName ?? ""),
      investorClass: String(r.investorClass ?? ""),
      capital: Number.isFinite(capital) ? capital : 0,
      percentOfClassDistributions: contactKey
        ? pctByContact.get(contactKey) ?? ""
        : "",
    };
  });
  return allocateByCapitalFallback({
    amount,
    investors,
    classes: (classBundle?.classes ?? [])
      .filter((c) => c.id)
      .map((c) => ({ id: c.id as string, name: c.name })),
  });
}

/**
 * Edit an investor's % of class and/or payment on a completed distribution.
 * % and payment are co-dependent: editing one derives the other from class waterfall.
 * Syncs % onto `deal_lp_investor.percent_of_class_distributions` when a roster row matches.
 */
export async function updatePriorDistributionInvestorPercent(params: {
  dealId: string;
  distributionId: string;
  investorId: string;
  percentOfClass?: number;
  payment?: number;
}): Promise<{ bundle: DistributionSetupBundle; error?: string }> {
  const existing = await getDistributionSetupBundle(params.dealId);
  if (!existing) {
    return {
      bundle: {
        dealId: params.dealId,
        dealName: "",
        targetRaise: "0",
        waterfalls: emptyWaterfalls(),
        priorDistributions: [],
        classes: [],
        promote: { hurdles: [], shares: {} },
      },
      error: "Deal not found",
    };
  }

  const distId = String(params.distributionId ?? "").trim();
  const investorId = String(params.investorId ?? "").trim();
  const hasPct = Number.isFinite(params.percentOfClass);
  const hasPay = Number.isFinite(params.payment);
  if (!distId || !investorId) {
    return { bundle: existing, error: "Missing distribution or investor id" };
  }
  if (!hasPct && !hasPay) {
    return {
      bundle: existing,
      error: "Provide percentOfClass and/or payment",
    };
  }

  const priorIndex = existing.priorDistributions.findIndex(
    (p) => String(p.id).trim() === distId,
  );
  if (priorIndex < 0) {
    return { bundle: existing, error: "Distribution not found" };
  }

  const prior = existing.priorDistributions[priorIndex]!;
  let lines = await ensureInvestorPaymentsOnPrior(params.dealId, prior);
  if (lines.length === 0) {
    return { bundle: existing, error: "No investor payments on this distribution" };
  }

  const target = lines.find(
    (l) => String(l.investorId).toLowerCase() === investorId.toLowerCase(),
  );
  if (!target) {
    return { bundle: existing, error: "Investor not found on this distribution" };
  }

  const classId = target.classId;
  const oldPct = Math.max(0, Number(target.percentOfClass) || 0);
  const oldPay = Math.max(0, Number(target.payment) || 0);
  const peers = lines.filter((l) => l.classId === classId);
  let classPay =
    oldPct > 0
      ? oldPay / (oldPct / 100)
      : peers.reduce((s, l) => {
          const p = Math.max(0, Number(l.percentOfClass) || 0);
          const pay = Math.max(0, Number(l.payment) || 0);
          if (p > 0) return Math.max(s, pay / (p / 100));
          return s;
        }, 0);
  if (!(classPay > 0)) {
    classPay = peers.reduce((s, l) => s + Math.max(0, Number(l.payment) || 0), 0);
  }

  let nextPct: number;
  let nextPayment: number;
  if (hasPay && !hasPct) {
    nextPayment = Math.max(0, Number(params.payment));
    nextPct =
      classPay > 0
        ? Math.max(0, Math.min(100, (nextPayment / classPay) * 100))
        : 0;
    if (classPay > 0) {
      nextPayment = Math.round(classPay * (nextPct / 100) * 100) / 100;
    } else {
      nextPayment = Math.round(nextPayment * 100) / 100;
    }
  } else {
    nextPct = Math.max(
      0,
      Math.min(100, Number(params.percentOfClass)),
    );
    nextPayment = Math.round(classPay * (nextPct / 100) * 100) / 100;
  }

  lines = lines.map((l) => {
    if (String(l.investorId).toLowerCase() !== investorId.toLowerCase()) {
      return l;
    }
    return {
      ...l,
      percentOfClass: String(Math.round(nextPct * 1000) / 1000),
      payment: String(nextPayment),
    };
  });

  const nextPriors = existing.priorDistributions.map((p, i) =>
    i === priorIndex
      ? {
          ...p,
          investorPayments: serializeInvestorPaymentLines(lines),
        }
      : p,
  );

  await db
    .update(addDealForm)
    .set({
      distributionSetupJson: serializeDistributionSetupJson(
        existing.waterfalls,
        nextPriors,
      ),
    })
    .where(eq(addDealForm.id, params.dealId));

  const contactId = String(target.contactId ?? "").trim();
  const pctLabel = `${(Math.round(nextPct * 100) / 100).toFixed(2)}%`;
  if (contactId) {
    await db
      .update(dealLpInvestor)
      .set({
        percentOfClassDistributions: pctLabel,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(dealLpInvestor.dealId, params.dealId),
          eq(dealLpInvestor.contactMemberId, contactId),
        ),
      );
  } else {
    await db
      .update(dealLpInvestor)
      .set({
        percentOfClassDistributions: pctLabel,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(dealLpInvestor.dealId, params.dealId),
          eq(dealLpInvestor.id, investorId),
        ),
      );
  }

  const bundle = await getDistributionSetupBundle(params.dealId);
  return { bundle: bundle ?? { ...existing, priorDistributions: nextPriors } };
}

export type MyDistributionPaymentRow = {
  distributionId: string;
  dealId: string;
  dealName: string;
  date: string;
  source?: string;
  name?: string;
  period?: string;
  dealAmount: string;
  payment: string;
  capital: string;
  percentOfClass: string;
  classId: string;
  className: string;
  investorName: string;
};

async function ensureInvestorPaymentsOnPrior(
  dealId: string,
  prior: PriorDistributionRecord,
): Promise<InvestorPaymentLine[]> {
  if (prior.investorPayments?.length) {
    return serializeInvestorPaymentLines(prior.investorPayments);
  }
  const amount = Number(String(prior.amount).replace(/[^0-9.-]/g, ""));
  if (!(amount > 0)) return [];
  return buildFallbackInvestorPayments(dealId, amount);
}

async function viewerPaymentsForPrior(
  dealId: string,
  prior: PriorDistributionRecord,
  matchKeys: Awaited<ReturnType<typeof listViewerInvestmentMatchKeys>>,
): Promise<InvestorPaymentLine[]> {
  const stored = filterPaymentsForViewer(
    await ensureInvestorPaymentsOnPrior(dealId, prior),
    matchKeys,
  );
  if (stored.length > 0) return stored;
  // Snapshot missing identity (email/contact) — rebuild from current investments.
  const amount = Number(String(prior.amount).replace(/[^0-9.-]/g, ""));
  if (!(amount > 0)) return [];
  return filterPaymentsForViewer(
    await buildFallbackInvestorPayments(dealId, amount),
    matchKeys,
  );
}

/**
 * Deal-scoped distributions for the signed-in investor (their payment lines only).
 */
export async function getMyDistributionsForDeal(params: {
  dealId: string;
  scope: DealViewerScope;
  emailNorm: string;
}): Promise<{
  dealId: string;
  dealName: string;
  distributions: MyDistributionPaymentRow[];
  totalPayment: string;
} | null> {
  if (
    !(await assertDealIdReadableOrAssignedParticipant(
      params.dealId,
      params.scope,
    ))
  ) {
    return null;
  }
  const bundle = await getDistributionSetupBundle(params.dealId);
  if (!bundle) return null;

  const matchKeys = await listViewerInvestmentMatchKeys(params.dealId, {
    userId: params.scope.userId,
    emailNorm: params.emailNorm,
  });

  const out: MyDistributionPaymentRow[] = [];
  for (const prior of bundle.priorDistributions) {
    const lines = await viewerPaymentsForPrior(
      params.dealId,
      prior,
      matchKeys,
    );
    for (const line of lines) {
      out.push({
        distributionId: prior.id,
        dealId: bundle.dealId,
        dealName: bundle.dealName,
        date: prior.date,
        source: prior.source,
        name: prior.name,
        period: prior.period,
        dealAmount: prior.amount,
        payment: line.payment,
        capital: line.capital,
        percentOfClass: line.percentOfClass,
        classId: line.classId,
        className: line.className,
        investorName: line.investorName,
      });
    }
  }
  out.sort((a, b) => b.date.localeCompare(a.date));
  const total = out.reduce((s, r) => {
    const n = Number(r.payment);
    return s + (Number.isFinite(n) ? n : 0);
  }, 0);
  return {
    dealId: bundle.dealId,
    dealName: bundle.dealName,
    distributions: out,
    totalPayment: formatUsdPlain(total),
  };
}

/**
 * One completed distribution, scoped to the signed-in investor's payment lines.
 */
export async function getMyDistributionDetailForDeal(params: {
  dealId: string;
  distributionId: string;
  scope: DealViewerScope;
  emailNorm: string;
}): Promise<{
  dealId: string;
  dealName: string;
  distribution: {
    id: string;
    date: string;
    source?: string;
    name?: string;
    notes?: string;
    period?: string;
    dealAmount: string;
  };
  payments: Array<{
    payment: string;
    capital: string;
    percentOfClass: string;
    classId: string;
    className: string;
    investorName: string;
  }>;
  totalPayment: string;
} | null> {
  if (
    !(await assertDealIdReadableOrAssignedParticipant(
      params.dealId,
      params.scope,
    ))
  ) {
    return null;
  }
  const bundle = await getDistributionSetupBundle(params.dealId);
  if (!bundle) return null;
  const prior =
    bundle.priorDistributions.find((p) => p.id === params.distributionId) ??
    null;
  if (!prior) return null;

  const matchKeys = await listViewerInvestmentMatchKeys(params.dealId, {
    userId: params.scope.userId,
    emailNorm: params.emailNorm,
  });
  const lines = await viewerPaymentsForPrior(
    params.dealId,
    prior,
    matchKeys,
  );
  const total = lines.reduce((s, r) => {
    const n = Number(r.payment);
    return s + (Number.isFinite(n) ? n : 0);
  }, 0);
  return {
    dealId: bundle.dealId,
    dealName: bundle.dealName,
    distribution: {
      id: prior.id,
      date: prior.date,
      source: prior.source,
      name: prior.name,
      notes: prior.notes,
      period: prior.period,
      dealAmount: prior.amount,
    },
    payments: lines.map((l) => ({
      payment: l.payment,
      capital: l.capital,
      percentOfClass: l.percentOfClass,
      classId: l.classId,
      className: l.className,
      investorName: l.investorName,
    })),
    totalPayment: formatUsdPlain(total),
  };
}

/**
 * Investor-scoped: payments across all deals the viewer can read.
 */
export async function listMyDistributionsForViewer(params: {
  scope: DealViewerScope;
  emailNorm: string;
  dealIds: string[];
}): Promise<{
  distributions: MyDistributionPaymentRow[];
  totalPayment: string;
}> {
  const all: MyDistributionPaymentRow[] = [];
  for (const dealId of params.dealIds) {
    const pack = await getMyDistributionsForDeal({
      dealId,
      scope: params.scope,
      emailNorm: params.emailNorm,
    });
    if (pack?.distributions.length) all.push(...pack.distributions);
  }
  all.sort((a, b) => b.date.localeCompare(a.date) || a.dealName.localeCompare(b.dealName));
  const total = all.reduce((s, r) => {
    const n = Number(r.payment);
    return s + (Number.isFinite(n) ? n : 0);
  }, 0);
  return { distributions: all, totalPayment: formatUsdPlain(total) };
}
