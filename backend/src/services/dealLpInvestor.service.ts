import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../database/db.js";
import {
  dealLpInvestor,
  type DealLpInvestorRow,
} from "../schema/deal.schema/deal-lp-investor.schema.js";
import {
  dealInvestment,
  type DealInvestmentRow,
} from "../schema/deal.schema/deal-investment.schema.js";
import {
  buildInvestorKpisFromRows,
  DEAL_INVESTMENT_AUTOSAVE_CONTACT_PLACEHOLDER,
  isLpInvestorRole,
  LP_INVESTOR_ROLE_STORED,
  listDealInvestmentsByDealId,
  mapRowToInvestorApi,
  resolveUserDisplayNamesByIds,
  resolveUsersByContactIds,
} from "./dealInvestment.service.js";

function normalizeContactKey(raw: string): string {
  return String(raw ?? "").trim().toLowerCase();
}

export function syntheticInvestmentFromDealLpInvestor(
  m: DealLpInvestorRow,
): DealInvestmentRow {
  return {
    id: m.id,
    dealId: m.dealId,
    offeringId: "",
    contactId: m.contactMemberId,
    contactDisplayName: "",
    profileId: "",
    investor_role: LP_INVESTOR_ROLE_STORED,
    status: "",
    investorClass: m.investorClass,
    docSignedDate: null,
    commitmentAmount: "",
    extraContributionAmounts: [],
    documentStoragePath: null,
    createdAt: m.createdAt,
  };
}

/** LP roster row id + labels; financials from latest investment for this deal/contact (any role). */
function syntheticLpRosterWithInvestmentFinancials(
  m: DealLpInvestorRow,
  inv: DealInvestmentRow,
): DealInvestmentRow {
  const syn = syntheticInvestmentFromDealLpInvestor(m);
  const extras = Array.isArray(inv.extraContributionAmounts)
    ? inv.extraContributionAmounts
    : [];
  return {
    ...syn,
    commitmentAmount: inv.commitmentAmount?.trim() ?? "",
    extraContributionAmounts: extras,
    investorClass: inv.investorClass?.trim()
      ? inv.investorClass
      : syn.investorClass,
    status: inv.status?.trim() ? inv.status : syn.status,
    docSignedDate: inv.docSignedDate ?? syn.docSignedDate,
    contactDisplayName: inv.contactDisplayName?.trim()
      ? inv.contactDisplayName
      : syn.contactDisplayName,
    profileId: inv.profileId?.trim() ? inv.profileId : syn.profileId,
    offeringId: inv.offeringId?.trim() ? inv.offeringId : syn.offeringId,
    documentStoragePath: inv.documentStoragePath ?? syn.documentStoragePath,
  };
}

/**
 * LP tab list: latest `deal_investment` per contact (LP role) plus `deal_lp_investor`
 * rows whose contact has no LP investment row (prefer investment for financials).
 * For roster-only contacts, `commitment_amount` / extras come from the latest
 * `deal_investment` for that deal + contact **any role** so the Committed column
 * matches stored deal investments.
 */
export async function listMergedLpInvestorsForDeal(
  dealId: string,
): Promise<DealInvestmentRow[]> {
  const allInvestments = await listDealInvestmentsByDealId(dealId, {
    lpInvestorsOnly: false,
  });
  const latestInvAnyRole = new Map<string, DealInvestmentRow>();
  const latestInv = new Map<string, DealInvestmentRow>();
  for (const inv of allInvestments) {
    const k = normalizeContactKey(inv.contactId ?? "");
    if (
      !k ||
      k === normalizeContactKey(DEAL_INVESTMENT_AUTOSAVE_CONTACT_PLACEHOLDER)
    )
      continue;
    const t = new Date(inv.createdAt).getTime();
    const prevAny = latestInvAnyRole.get(k);
    if (!prevAny || t > new Date(prevAny.createdAt).getTime())
      latestInvAnyRole.set(k, inv);
    if (!isLpInvestorRole(inv.investor_role)) continue;
    const prevLp = latestInv.get(k);
    if (!prevLp || t > new Date(prevLp.createdAt).getTime())
      latestInv.set(k, inv);
  }

  const roster = await db
    .select()
    .from(dealLpInvestor)
    .where(eq(dealLpInvestor.dealId, dealId))
    .orderBy(desc(dealLpInvestor.updatedAt));

  const invKeys = new Set(latestInv.keys());
  const rows: DealInvestmentRow[] = [];

  for (const inv of latestInv.values()) rows.push(inv);

  for (const m of roster) {
    const k = normalizeContactKey(m.contactMemberId);
    if (!k || invKeys.has(k)) continue;
    const fin = latestInvAnyRole.get(k);
    rows.push(
      fin
        ? syntheticLpRosterWithInvestmentFinancials(m, fin)
        : syntheticInvestmentFromDealLpInvestor(m),
    );
  }

  rows.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return rows;
}

export type LpInvestorApiRow = ReturnType<typeof mapRowToInvestorApi> & {
  investorKind?: "investment" | "lp_roster";
  addedByDisplayName?: string;
};

export async function mapMergedLpRowsToInvestorApi(
  rows: DealInvestmentRow[],
  lpRowIds: Set<string>,
): Promise<LpInvestorApiRow[]> {
  const resolved = await resolveUsersByContactIds(rows);
  const out: LpInvestorApiRow[] = [];
  for (const r of rows) {
    const base = mapRowToInvestorApi(r, resolved);
    const idKey = String(r.id ?? "").toLowerCase();
    const kind: "investment" | "lp_roster" = lpRowIds.has(idKey)
      ? "lp_roster"
      : "investment";
    out.push({ ...base, investorKind: kind });
  }
  return out;
}

/** Build lp roster id set by comparing merged rows to DB lp table (source of truth). */
export async function resolveLpRosterIdSet(
  dealId: string,
  mergedRows: DealInvestmentRow[],
): Promise<Set<string>> {
  const lpDb = await db
    .select({ id: dealLpInvestor.id })
    .from(dealLpInvestor)
    .where(eq(dealLpInvestor.dealId, dealId));
  const allowed = new Set(
    lpDb.map((r) => String(r.id).toLowerCase()),
  );
  const out = new Set<string>();
  for (const row of mergedRows) {
    const id = String(row.id ?? "").toLowerCase();
    if (allowed.has(id)) out.add(id);
  }
  return out;
}

export async function buildLpInvestorsFromMerged(
  dealId: string,
  merged: DealInvestmentRow[],
): Promise<{ investors: LpInvestorApiRow[]; kpis: ReturnType<typeof buildInvestorKpisFromRows> }> {
  const kpis = buildInvestorKpisFromRows(merged);
  const lpRosterIds = await resolveLpRosterIdSet(dealId, merged);
  const base = await mapMergedLpRowsToInvestorApi(merged, lpRosterIds);

  const roster = await db
    .select()
    .from(dealLpInvestor)
    .where(eq(dealLpInvestor.dealId, dealId));
  const addedByNames = await resolveUserDisplayNamesByIds(
    roster.map((m) => m.addedBy),
  );

  const addedByByLpId = new Map<string, string>();
  for (const m of roster) {
    const key = m.addedBy ? String(m.addedBy).toLowerCase() : "";
    const name =
      key && addedByNames.has(key) ? addedByNames.get(key)! : "—";
    addedByByLpId.set(String(m.id).toLowerCase(), name);
  }

  const investors = base.map((inv) => {
    const id = String(inv.id ?? "").toLowerCase();
    const extra =
      lpRosterIds.has(id) && addedByByLpId.has(id)
        ? { addedByDisplayName: addedByByLpId.get(id)! }
        : {};
    return { ...inv, ...extra };
  });

  return { investors, kpis };
}

/** Single round-trip for GET /deals/:dealId/investors?lp=1 */
export async function getLpInvestorsTabPayload(dealId: string): Promise<{
  kpis: ReturnType<typeof buildInvestorKpisFromRows>;
  investors: LpInvestorApiRow[];
}> {
  const merged = await listMergedLpInvestorsForDeal(dealId);
  return buildLpInvestorsFromMerged(dealId, merged);
}

export type UpsertDealLpInvestorInput = {
  contactMemberId: string;
  contactDisplayName: string;
  investorClass: string;
  sendInvitationMail: string;
  addedByUserId: string;
};

export async function upsertDealLpInvestor(
  dealId: string,
  input: UpsertDealLpInvestorInput,
): Promise<DealLpInvestorRow> {
  const cid = input.contactMemberId.trim();
  if (!cid) throw new Error("contact_member_id required");

  const send =
    String(input.sendInvitationMail ?? "").toLowerCase() === "yes"
      ? "yes"
      : "no";
  const now = new Date();

  const [row] = await db
    .insert(dealLpInvestor)
    .values({
      dealId,
      addedBy: input.addedByUserId,
      contactMemberId: cid,
      investorClass: input.investorClass?.trim() ?? "",
      sendInvitationMail: send,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [dealLpInvestor.dealId, dealLpInvestor.contactMemberId],
      set: {
        investorClass: input.investorClass?.trim() ?? "",
        sendInvitationMail: send,
        updatedAt: now,
      },
    })
    .returning();

  if (!row) throw new Error("UPSERT_DEAL_LP_INVESTOR_FAILED");
  return row;
}

export async function updateDealLpInvestorById(
  dealId: string,
  lpInvestorId: string,
  input: UpsertDealLpInvestorInput,
): Promise<DealLpInvestorRow | null> {
  const cid = input.contactMemberId.trim();
  if (!cid) return null;
  const send =
    String(input.sendInvitationMail ?? "").toLowerCase() === "yes"
      ? "yes"
      : "no";
  const now = new Date();

  const [row] = await db
    .update(dealLpInvestor)
    .set({
      contactMemberId: cid,
      investorClass: input.investorClass?.trim() ?? "",
      sendInvitationMail: send,
      updatedAt: now,
    })
    .where(
      and(eq(dealLpInvestor.dealId, dealId), eq(dealLpInvestor.id, lpInvestorId)),
    )
    .returning();
  return row ?? null;
}

export async function getDealLpInvestorById(
  dealId: string,
  id: string,
): Promise<DealLpInvestorRow | undefined> {
  const rows = await db
    .select()
    .from(dealLpInvestor)
    .where(and(eq(dealLpInvestor.dealId, dealId), eq(dealLpInvestor.id, id)))
    .limit(1);
  return rows[0];
}

export async function deleteDealLpInvestorById(
  dealId: string,
  id: string,
): Promise<boolean> {
  const deleted = await db
    .delete(dealLpInvestor)
    .where(and(eq(dealLpInvestor.dealId, dealId), eq(dealLpInvestor.id, id)))
    .returning({ id: dealLpInvestor.id });
  return deleted.length > 0;
}

const LP_ROLE_SQL = ["lp_investors", "LP Investors"] as const;

/** Extra LP roster rows not represented by an LP `deal_investment` (for deal list counts). */
export async function countExtraLpRosterOnlyByDealIds(
  dealIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const ids = [...new Set(dealIds.filter(Boolean))];
  for (const id of ids) map.set(id, 0);
  if (ids.length === 0) return map;

  for (const dealId of ids) {
    const invContacts = await db
      .select({ contactId: dealInvestment.contactId })
      .from(dealInvestment)
      .where(
        and(
          eq(dealInvestment.dealId, dealId),
          inArray(dealInvestment.investor_role, [...LP_ROLE_SQL]),
        ),
      );
    const invKeys = new Set(
      invContacts.map((r) => normalizeContactKey(r.contactId ?? "")),
    );
    const rFull = await db
      .select({ contactMemberId: dealLpInvestor.contactMemberId })
      .from(dealLpInvestor)
      .where(eq(dealLpInvestor.dealId, dealId));
    let n = 0;
    for (const r of rFull) {
      const k = normalizeContactKey(r.contactMemberId);
      if (k && !invKeys.has(k)) n += 1;
    }
    map.set(dealId, n);
  }
  return map;
}
