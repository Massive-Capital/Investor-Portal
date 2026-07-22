import type {
  DistributionAmountMode,
  DistributionPaymentRow,
  DistributionWaterfalls,
  DistributionWfKind,
} from "./distributionSetup.types.js";
import {
  DISTRIBUTION_AMOUNT_MODES,
  DISTRIBUTION_WF_KINDS,
  emptyWaterfalls,
} from "./distributionSetup.types.js";

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v != null ? String(v).trim() : "";
}

function numStr(v: unknown, fallback = "0"): string {
  const t = str(v).replace(/[$,%\s,]/g, "");
  if (!t) return fallback;
  const n = Number(t);
  return Number.isFinite(n) ? String(n) : fallback;
}

function asRecord(v: unknown): Record<string, unknown> {
  if (v != null && typeof v === "object" && !Array.isArray(v))
    return v as Record<string, unknown>;
  return {};
}

function parseJsonObject(raw: string): Record<string, unknown> {
  try {
    const o = JSON.parse(raw || "{}") as unknown;
    if (o != null && typeof o === "object" && !Array.isArray(o))
      return o as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  return {};
}

function parseRow(raw: unknown, index: number): DistributionPaymentRow | null {
  const o = asRecord(raw);
  const kindRaw = str(o.kind);
  if (!(DISTRIBUTION_WF_KINDS as readonly string[]).includes(kindRaw))
    return null;
  const modeRaw = str(o.amountMode ?? o.amount_mode) || "calc";
  const amountMode = (DISTRIBUTION_AMOUNT_MODES as readonly string[]).includes(
    modeRaw,
  )
    ? (modeRaw as DistributionAmountMode)
    : "calc";
  const payToRaw = Array.isArray(o.payTo)
    ? o.payTo
    : Array.isArray(o.pay_to)
      ? o.pay_to
      : [];
  const catchup = asRecord(o.catchup);
  return {
    id: str(o.id) || `row_${index + 1}`,
    kind: kindRaw as DistributionWfKind,
    name: str(o.name) || kindRaw,
    payTo: payToRaw.map((id) => str(id)).filter(Boolean),
    amountMode,
    inputAmount: numStr(o.inputAmount ?? o.input_amount, "0"),
    catchupPct: numStr(catchup.pct ?? o.catchupPct ?? o.catchup_pct, "20"),
  };
}

function parseRows(raw: unknown): DistributionPaymentRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r, i) => parseRow(r, i))
    .filter((r): r is DistributionPaymentRow => r != null);
}

export function parseDistributionSetupJson(raw: string): DistributionWaterfalls {
  const o = parseJsonObject(raw);
  const wf = asRecord(o.waterfalls ?? o);
  const defaults = emptyWaterfalls();
  const operating = parseRows(wf.operating);
  const capital = parseRows(wf.capital ?? wf.capital_event);
  return {
    operating: operating.length > 0 ? operating : defaults.operating,
    capital: capital.length > 0 ? capital : defaults.capital,
  };
}

export function serializeDistributionSetupJson(
  waterfalls: DistributionWaterfalls,
): string {
  const mapRow = (r: DistributionPaymentRow) => ({
    id: r.id,
    kind: r.kind,
    name: r.name,
    payTo: r.payTo ?? [],
    amountMode: r.amountMode,
    inputAmount: numStr(r.inputAmount, "0"),
    catchup: { pct: numStr(r.catchupPct, "20") },
  });
  return JSON.stringify({
    waterfalls: {
      operating: (waterfalls.operating ?? []).map(mapRow),
      capital: (waterfalls.capital ?? []).map(mapRow),
    },
    updatedAt: new Date().toISOString(),
  });
}

export function normalizePayToAgainstClasses(
  waterfalls: DistributionWaterfalls,
  classIds: Set<string>,
): DistributionWaterfalls {
  const scrub = (rows: DistributionPaymentRow[]) =>
    rows.map((r) => ({
      ...r,
      payTo: (r.payTo ?? []).filter((id) => classIds.has(id)),
    }));
  return {
    operating: scrub(waterfalls.operating),
    capital: scrub(waterfalls.capital),
  };
}

/** Seed payTo from class types when rows have empty payTo (first open). */
export function seedDefaultPayTo(
  waterfalls: DistributionWaterfalls,
  classes: Array<{ id: string; classType: string }>,
): DistributionWaterfalls {
  const lpIds = classes.filter((c) => c.classType === "lp").map((c) => c.id);
  const prefIds = classes
    .filter((c) => c.classType === "preferred_equity")
    .map((c) => c.id);
  const gpIds = classes.filter((c) => c.classType === "gp").map((c) => c.id);

  function fill(row: DistributionPaymentRow): DistributionPaymentRow {
    if ((row.payTo ?? []).length > 0) return row;
    if (row.kind === "LP_PREF" || row.kind === "ROC")
      return { ...row, payTo: [...lpIds] };
    if (row.kind === "PREF_CURRENT" || row.kind === "PREF_ACCRUED")
      return { ...row, payTo: [...prefIds] };
    if (row.kind === "CATCHUP") return { ...row, payTo: [...gpIds] };
    return row;
  }

  return {
    operating: waterfalls.operating.map(fill),
    capital: waterfalls.capital.map(fill),
  };
}
