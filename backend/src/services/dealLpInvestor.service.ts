import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, pool } from "../database/db.js";
import { contact, dealMember, users } from "../schema/schema.js";
import {
  dealLpInvestor,
  type DealLpInvestorRow,
} from "../schema/deal.schema/deal-lp-investor.schema.js";
import {
  dealInvestment,
  type DealInvestmentRow,
} from "../schema/deal.schema/deal-investment.schema.js";
import {
  applyTotalCommittedToDealInvestmentRow,
  buildInvestorKpisFromRows,
  committedNumericFromDealInvestmentRow,
  DEAL_INVESTMENT_AUTOSAVE_CONTACT_PLACEHOLDER,
  enrichInvestorApiRowsWithAddedBy,
  enrichInvestorRolesForDealRows,
  insertDealInvestment,
  isLpInvestorRole,
  LP_INVESTOR_ROLE_STORED,
  listDealInvestmentsByDealId,
  loadInvitationMailSentFlags,
  mapRowToInvestorApi,
  resolveFirstInvestorClassForDeal,
  resolveInvestorClassForDealInvestment,
  resolveUsersByContactIds,
  totalCommittedByContactKeyFromRows,
} from "./dealInvestment.service.js";
import type { DealViewerScope } from "./dealForm.service.js";

function normalizeContactKey(raw: string): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase();
}

/** True when the viewer’s roster row on this deal is Co-sponsor (contact or user id match). */
export async function isViewerCoSponsorOnDeal(
  dealId: string,
  userId: string,
): Promise<boolean> {
  const res = await pool.query<{ ok: number }>(
    `SELECT 1 AS ok
     FROM deal_member dm
     INNER JOIN users u ON u.id = $1::uuid
     WHERE dm.deal_id = $2::uuid
       AND (
         trim(dm.contact_member_id) = u.id::text
         OR EXISTS (
           SELECT 1 FROM contact c
           WHERE c.id::text = trim(both from dm.contact_member_id)
             AND lower(trim(c.email)) = lower(trim(u.email))
         )
       )
       AND lower(trim(dm.deal_member_role)) IN ('co-sponsor', 'co sponsor')
     LIMIT 1`,
    [userId, dealId],
  );
  return res.rows.length > 0;
}

/**
 * Co-sponsors only see investors they added (`deal_lp_investor.added_by` and/or
 * `deal_member.added_by` for that contact). Applies to merged LP rows and raw
 * `deal_investment` rows (same contact + id rules).
 */
export async function filterMergedLpInvestorsForCoSponsorViewer(
  dealId: string,
  viewerUserId: string,
  merged: DealInvestmentRow[],
): Promise<DealInvestmentRow[]> {
  const viewer = String(viewerUserId).trim().toLowerCase();
  const lpRows = await db
    .select({
      id: dealLpInvestor.id,
      addedBy: dealLpInvestor.addedBy,
      contactMemberId: dealLpInvestor.contactMemberId,
    })
    .from(dealLpInvestor)
    .where(eq(dealLpInvestor.dealId, dealId));

  console.log("LP ROWS DATA =>", lpRows);

  const lpAddedBy = new Map<string, string>();
  /** `deal_lp_investor.added_by` keyed by normalized contact (LP-only rows without `deal_member`). */
  const lpContactAddedBy = new Map<string, string>();
  for (const r of lpRows) {
    const adder = r.addedBy ? String(r.addedBy).toLowerCase() : "";
    lpAddedBy.set(String(r.id).toLowerCase(), adder);
    const ck = normalizeContactKey(r.contactMemberId);
    if (ck && adder) lpContactAddedBy.set(ck, adder);
  }

  const memberRows = await db
    .select({
      contactMemberId: dealMember.contactMemberId,
      addedBy: dealMember.addedBy,
    })
    .from(dealMember)
    .where(eq(dealMember.dealId, dealId));

  console.log("MEMBERS ROWS DATA =>", lpRows);

  const contactAddedBy = new Map<string, string>();
  for (const r of memberRows) {
    const k = normalizeContactKey(r.contactMemberId);
    if (!k) continue;
    const adder = r.addedBy ? String(r.addedBy).toLowerCase() : "";
    contactAddedBy.set(k, adder);
  }

  const placeholderKey = normalizeContactKey(
    DEAL_INVESTMENT_AUTOSAVE_CONTACT_PLACEHOLDER,
  );

  function contactAddedByViewer(ck: string): boolean {
    const dm = contactAddedBy.get(ck);
    const lp = lpContactAddedBy.get(ck);
    return dm === viewer || lp === viewer;
  }

  return merged.filter((row) => {
    const idKey = String(row.id ?? "").toLowerCase();
    if (lpAddedBy.has(idKey)) return lpAddedBy.get(idKey) === viewer;
    const ck = normalizeContactKey(row.contactId ?? "");
    if (!ck || ck === placeholderKey) return false;
    return contactAddedByViewer(ck);
  });
}

const LP_INVESTOR_TABLE_ROLE = "LP Investor";

/** `investor_role` on synthetic merged rows: prefer column on `deal_lp_investor`, else canonical LP value. */
function investorRoleFromDealLpInvestorRow(m: DealLpInvestorRow): string {
  const r = String(m.role ?? "").trim();
  if (r) return r;
  return LP_INVESTOR_ROLE_STORED;
}

async function resolveEmailForContactMemberId(rawCid: string): Promise<string> {
  const cid = String(rawCid ?? "").trim();
  if (!cid) return "";
  const [uRow] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, cid))
    .limit(1);
  const fromUser = String(uRow?.email ?? "")
    .trim()
    .toLowerCase();
  if (fromUser) return fromUser;
  const [cRow] = await db
    .select({ email: contact.email })
    .from(contact)
    .where(sql`${contact.id}::text = ${cid}`)
    .limit(1);
  return String(cRow?.email ?? "")
    .trim()
    .toLowerCase();
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
    profileId: m.profileId?.trim() ?? "",
    userInvestorProfileId: m.userInvestorProfileId ?? null,
    investor_role: investorRoleFromDealLpInvestorRow(m),
    fundApproved: false,
    fundApprovedCommitmentSnapshot: "",
    status: "",
    investorClass: m.investorClass,
    docSignedDate: null,
    commitmentAmount: m.committed_amount,
    extraContributionAmounts: [],
    documentStoragePath: null,
    createdAt: m.createdAt,
  };
}

/**
 * `GET /deals/:dealId/investors` (full roster) is built from `deal_investment` only.
 * Contacts that exist only on `deal_lp_investor` (e.g. sponsor added LP, $0, no
 * `deal_investment` row yet) would be missing — add them so investing `/deals`
 * and the Investors tab can match the user by email.
 */
export async function mergeDealLpRosterIntoFullInvestorRows(
  dealId: string,
  investments: DealInvestmentRow[],
): Promise<DealInvestmentRow[]> {
  const withInvestmentContact = new Set<string>();
  for (const inv of investments) {
    const k = normalizeContactKey(inv.contactId ?? "");
    if (k) withInvestmentContact.add(k);
  }
  const roster = await db
    .select()
    .from(dealLpInvestor)
    .where(eq(dealLpInvestor.dealId, dealId));
  const extra: DealInvestmentRow[] = [];
  for (const m of roster) {
    const k = normalizeContactKey(m.contactMemberId);
    if (!k || withInvestmentContact.has(k)) continue;
    extra.push(syntheticInvestmentFromDealLpInvestor(m));
  }
  if (extra.length === 0) return investments;
  return [...investments, ...extra].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

/** LP investor row id + labels; financials from latest investment for this deal/contact (any role). */
function syntheticLpRosterWithInvestmentFinancials(
  m: DealLpInvestorRow,
  inv: DealInvestmentRow,
): DealInvestmentRow {
  const syn = syntheticInvestmentFromDealLpInvestor(m);
  const extras = Array.isArray(inv.extraContributionAmounts)
    ? inv.extraContributionAmounts
    : [];
  const invC = inv.commitmentAmount?.trim() ?? "";
  return {
    ...syn,
    commitmentAmount: invC,
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
    fundApproved: inv.fundApproved ?? false,
    /** LP investor row drives role; investment row may differ. */
    investor_role: syn.investor_role,
  };
}

/**
 * LP tab list: latest `deal_investment` per contact (LP role) plus `deal_lp_investor`
 * rows whose contact has no LP investment row (prefer investment for financials).
 * For LP-investor-only contacts, financials use the latest `deal_investment` row for
 * non-amount fields; **committed** is the sum of all `deal_investment` rows for that
 * contact on this deal (cumulative / multiple rows).
 */
export async function listMergedLpInvestorsForDeal(
  dealId: string,
): Promise<DealInvestmentRow[]> {
  const allInvestments = await listDealInvestmentsByDealId(dealId, {
    lpInvestorsOnly: false,
  });
  const totalByContact = totalCommittedByContactKeyFromRows(allInvestments);
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

  const withTotals = rows.map((r) =>
    applyTotalCommittedToDealInvestmentRow(r, totalByContact),
  );
  withTotals.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return withTotals;
}

export type LpInvestorApiRow = ReturnType<typeof mapRowToInvestorApi> & {
  investorKind?: "investment" | "lp_investor";
  addedByDisplayName?: string;
};

export async function mapMergedLpRowsToInvestorApi(
  dealId: string,
  rows: DealInvestmentRow[],
  lpRowIds: Set<string>,
): Promise<LpInvestorApiRow[]> {
  const enriched =
    rows.length > 0 ? await enrichInvestorRolesForDealRows(dealId, rows) : rows;
  const resolved = await resolveUsersByContactIds(enriched);
  const flags =
    enriched.length > 0
      ? await loadInvitationMailSentFlags(dealId, enriched, lpRowIds)
      : [];
  const out: LpInvestorApiRow[] = [];
  enriched.forEach((r, i) => {
    const base = mapRowToInvestorApi(r, resolved, {
      invitationMailSent: flags[i] === true,
    });
    const idKey = String(r.id ?? "").toLowerCase();
    const kind: "investment" | "lp_investor" = lpRowIds.has(idKey)
      ? "lp_investor"
      : "investment";
    out.push({ ...base, investorKind: kind });
  });
  return out;
}

/** Build LP investor id set by comparing merged rows to DB lp table (source of truth). */
export async function resolveLpRosterIdSet(
  dealId: string,
  mergedRows: DealInvestmentRow[],
): Promise<Set<string>> {
  const lpDb = await db
    .select({ id: dealLpInvestor.id })
    .from(dealLpInvestor)
    .where(eq(dealLpInvestor.dealId, dealId));
  const allowed = new Set(lpDb.map((r) => String(r.id).toLowerCase()));
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
): Promise<{
  investors: LpInvestorApiRow[];
  kpis: ReturnType<typeof buildInvestorKpisFromRows>;
}> {
  const kpis = buildInvestorKpisFromRows(merged);
  const lpRosterIds = await resolveLpRosterIdSet(dealId, merged);
  const base = await mapMergedLpRowsToInvestorApi(dealId, merged, lpRosterIds);

  const roster = await db
    .select()
    .from(dealLpInvestor)
    .where(eq(dealLpInvestor.dealId, dealId));

  const rosterEmailByLpId = new Map<string, string>();
  for (const m of roster) {
    const em = String(m.email ?? "").trim();
    if (em) rosterEmailByLpId.set(String(m.id).toLowerCase(), em);
  }

  const investorsMerged = base.map((inv) => {
    const id = String(inv.id ?? "").toLowerCase();
    const storedEmail = lpRosterIds.has(id)
      ? rosterEmailByLpId.get(id)
      : undefined;
    const emailPatch = storedEmail?.trim()
      ? { userEmail: storedEmail.trim() }
      : {};
    return { ...inv, ...emailPatch };
  });

  const investors = await enrichInvestorApiRowsWithAddedBy(
    dealId,
    investorsMerged,
  );

  return { investors, kpis };
}

/**
 * GET /deals/:dealId/investors?lp=1 — when `viewerUserId` is a Co-sponsor on the deal,
 * investors/KPIs are restricted to rows they added.
 */
export async function getLpInvestorsTabPayload(
  dealId: string,
  viewerUserId?: string | null,
): Promise<{
  kpis: ReturnType<typeof buildInvestorKpisFromRows>;
  investors: LpInvestorApiRow[];
}> {
  let merged = await listMergedLpInvestorsForDeal(dealId);
  const uid = viewerUserId?.trim();
  if (uid && (await isViewerCoSponsorOnDeal(dealId, uid))) {
    merged = await filterMergedLpInvestorsForCoSponsorViewer(
      dealId,
      uid,
      merged,
    );
  }
  return buildLpInvestorsFromMerged(dealId, merged);
}

export type UpsertDealLpInvestorInput = {
  contactMemberId: string;
  contactDisplayName: string;
  profileId: string;
  userInvestorProfileId?: string | null;
  investorClass: string;
  sendInvitationMail: string;
  addedByUserId: string;
  /** From client when known (UI already has email); else resolved from contact/users by id. */
  emailFromClient?: string | null;
  /** From client (e.g. `lp_investors`); else {@link LP_INVESTOR_TABLE_ROLE}. */
  roleFromClient?: string | null;
};

export async function upsertDealLpInvestor(
  dealId: string,
  input: UpsertDealLpInvestorInput,
): Promise<DealLpInvestorRow> {
  const cid = input.contactMemberId.trim();

  console.log("contactmember id", cid);

  if (!cid) throw new Error("contact_member_id required");

  const send =
    String(input.sendInvitationMail ?? "").toLowerCase() === "yes"
      ? "yes"
      : "no";
  const profileId = String(input.profileId ?? "").trim();
  const uip = String(input.userInvestorProfileId ?? "").trim() || null;
  const now = new Date();
  const fromClientEmail = String(input.emailFromClient ?? "").trim();
  const fromClientRole = String(input.roleFromClient ?? "").trim();
  const resolvedEmail =
    fromClientEmail || (await resolveEmailForContactMemberId(cid));
  const roleToStore = fromClientRole || LP_INVESTOR_TABLE_ROLE;

  const [row] = await db
    .insert(dealLpInvestor)
    .values({
      dealId,
      addedBy: input.addedByUserId,
      contactMemberId: cid,
      email: resolvedEmail || null,
      role: roleToStore,
      profileId,
      userInvestorProfileId: uip,
      investorClass: input.investorClass?.trim() ?? "",
      sendInvitationMail: send,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [dealLpInvestor.dealId, dealLpInvestor.contactMemberId],
      set: {
        email: resolvedEmail || null,
        role: roleToStore,
        profileId,
        userInvestorProfileId: uip,
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
  console.log("contact member id 2", cid)
  if (!cid) return null;
  const send =
    String(input.sendInvitationMail ?? "").toLowerCase() === "yes"
      ? "yes"
      : "no";
  const profileId = String(input.profileId ?? "").trim();
  const now = new Date();
  const fromClientEmail = String(input.emailFromClient ?? "").trim();
  const fromClientRole = String(input.roleFromClient ?? "").trim();
  const resolvedEmail =
    fromClientEmail || (await resolveEmailForContactMemberId(cid));
  const roleToStore = fromClientRole || LP_INVESTOR_TABLE_ROLE;

  const [row] = await db
    .update(dealLpInvestor)
    .set({
      contactMemberId: cid,
      email: resolvedEmail || null,
      role: roleToStore,
      profileId,
      investorClass: input.investorClass?.trim() ?? "",
      sendInvitationMail: send,
      updatedAt: now,
    })
    .where(
      and(
        eq(dealLpInvestor.dealId, dealId),
        eq(dealLpInvestor.id, lpInvestorId),
      ),
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

/** Extra LP investor rows not represented by an LP `deal_investment` (for deal list counts). */
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

const DEAL_ID_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Distinct LP roster rows in `deal_lp_investor` per deal (one row per contact), scoped by viewer:
 * - Platform admin, unauthenticated-style callers (`scope` null), and LP-email–scoped investors:
 *   total rows per deal.
 * - Company users (sponsors, company admin, etc.): rows where `added_by` references a user whose
 *   `organization_id` matches the viewer’s organization.
 */
export async function countDealLpInvestorsByDealIdsForViewer(
  dealIds: string[],
  scope: DealViewerScope | null,
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  for (const id of dealIds) map.set(String(id), 0);

  const uuidIds = [
    ...new Set(
      dealIds
        .map((id) => String(id ?? "").trim())
        .filter((id) => DEAL_ID_UUID_RE.test(id.toLowerCase())),
    ),
  ];
  if (uuidIds.length === 0) return map;

  const useTotalRosterCount =
    scope == null ||
    scope.isPlatformAdmin === true ||
    scope.seesAllDeals === true ||
    Boolean(scope.lpInvestorEmailScopedDealIds?.length);

  if (useTotalRosterCount) {
    const res = await pool.query<{ deal_id: string; cnt: string }>(
      `SELECT deal_id::text, COUNT(*)::int AS cnt
       FROM deal_lp_investor
       WHERE deal_id = ANY($1::uuid[])
       GROUP BY deal_id`,
      [uuidIds],
    );
    for (const row of res.rows) {
      map.set(row.deal_id, Number(row.cnt));
    }
    return map;
  }

  const orgId = scope.organizationId?.trim() ?? "";
  if (!orgId || !DEAL_ID_UUID_RE.test(orgId.toLowerCase())) {
    return map;
  }

  const res = await pool.query<{ deal_id: string; cnt: string }>(
    `SELECT lp.deal_id::text, COUNT(*)::int AS cnt
     FROM deal_lp_investor lp
     INNER JOIN users adder ON adder.id = lp.added_by
     WHERE lp.deal_id = ANY($1::uuid[])
       AND adder.organization_id = $2::uuid
     GROUP BY lp.deal_id`,
    [uuidIds, orgId],
  );
  for (const row of res.rows) {
    map.set(row.deal_id, Number(row.cnt));
  }
  return map;
}

function normalizeCommittedAmountStored(raw: string): string {
  const t = String(raw ?? "")
    .trim()
    .replace(/[$,\s]/g, "");
  if (!t) return "";
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return "";
  return String(n);
}

/** Matches portal investor profile keys (`deal_investment.profile_id`). */
const LP_COMMITMENT_PROFILE_IDS = new Set([
  "individual",
  "custodian_ira_401k",
  "joint_tenancy",
  "llc_corp_trust_etc",
]);

function normalizeLpCommitmentProfileId(
  raw: string | undefined,
): string | null {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  return LP_COMMITMENT_PROFILE_IDS.has(t) ? t : null;
}

/** Persist cumulative commitment as a plain numeric string (avoids float noise). */
function formatCumulativeCommitmentStored(total: number): string {
  if (!Number.isFinite(total) || total < 0) return "0";
  const rounded = Math.round(total * 100) / 100;
  return String(rounded);
}

async function sumLpDealInvestmentCommittedForContact(
  dealId: string,
  contactMemberId: string,
): Promise<string> {
  const rows = await db
    .select()
    .from(dealInvestment)
    .where(
      and(
        eq(dealInvestment.dealId, dealId),
        eq(dealInvestment.contactId, contactMemberId),
      ),
    );
  let t = 0;
  for (const r of rows) {
    if (isLpInvestorRole(r.investor_role)) {
      t += committedNumericFromDealInvestmentRow(r);
    }
  }
  return formatCumulativeCommitmentStored(t);
}

/**
 * LP self-service: **adds** the submitted amount to the existing committed total on the latest
 * LP `deal_investment` for this deal + contact (locked row, single transaction). Creates a row
 * when missing (requires `profile_id` on first commit). If the request sends a **different**
 * commitment `profile_id` (individual / joint / …) than the locked row, a **new** `deal_investment`
 * is inserted for this tranche. Syncs `deal_lp_investor.committed_amount` to the sum of LP rows.
 */
export async function updateMyCommittedAmountForLpDeal(params: {
  dealId: string;
  viewerEmailNorm: string;
  /** JWT `sub` of the current viewer (used to link/create LP roster row from deal membership). */
  viewerUserId?: string;
  committedAmount: string;
  /** When set and valid, updates `deal_investment` + `deal_lp_investor`; required when no investment row exists yet. */
  profileId?: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const e = String(params.viewerEmailNorm ?? "")
    .trim()
    .toLowerCase();
  if (!e.includes("@")) return { ok: false, message: "Invalid viewer email" };

  console.log("committed amount", params.committedAmount);

  const incrementStr = normalizeCommittedAmountStored(params.committedAmount);
  if (!incrementStr) {
    return {
      ok: false,
      message: "Additional commitment amount must be a number greater than 0",
    };
  }
  const increment = Number(incrementStr);
  if (!Number.isFinite(increment) || increment <= 0) {
    return {
      ok: false,
      message: "Additional commitment amount must be a number greater than 0",
    };
  }

  const rawProfile = String(params.profileId ?? "").trim();
  const profileOpt = normalizeLpCommitmentProfileId(
    rawProfile ? rawProfile : undefined,
  );
  if (rawProfile && !profileOpt) {
    return { ok: false, message: "Invalid investor profile." };
  }

  const viewerUserId = String(params.viewerUserId ?? "").trim();
  const matchRows = await db
    .select()
    .from(dealLpInvestor)
    .where(eq(dealLpInvestor.dealId, params.dealId));

  console.table(matchRows);
  console.log("view userid", viewerUserId);

  let target: DealLpInvestorRow | undefined;
  console.log("TARGET", target);
  for (const row of matchRows) {
    const em = await resolveEmailForContactMemberId(row.contactMemberId);
    if (em === e) {
      target = row;
      break;
    }
  }

  let fallbackContactMemberId = "";
  if (!target && viewerUserId) {
    const memberRows = await db
      .select({ contactMemberId: dealMember.contactMemberId })
      .from(dealMember)
      .where(eq(dealMember.dealId, params.dealId));

    let contactMemberId = "";
    const preferred = new Set<string>([viewerUserId]);
    const byEmail = await db
      .select({ id: contact.id })
      .from(contact)
      .where(sql`lower(trim(${contact.email})) = ${e}`);
    for (const row of byEmail) {
      const cid = String(row.id ?? "").trim();
      if (cid) preferred.add(cid);
    }

    for (const row of memberRows) {
      const cid = String(row.contactMemberId ?? "").trim();
      if (!cid) continue;
      if (preferred.has(cid)) {
        contactMemberId = cid;
        break;
      }
    }
    if (!contactMemberId) {
      for (const row of memberRows) {
        const cid = String(row.contactMemberId ?? "").trim();
        if (!cid) continue;
        const em = await resolveEmailForContactMemberId(cid);
        if (em === e) {
          contactMemberId = cid;
          break;
        }
      }
    }
    if (contactMemberId) fallbackContactMemberId = contactMemberId;
  }

  const targetContactMemberId =
    target?.contactMemberId || fallbackContactMemberId;
  if (!targetContactMemberId) {
    return {
      ok: false,
      message:
        "No LP investor record for your account on this deal. Ask your sponsor to add you.",
    };
  }

  const invCandidates = await db
    .select()
    .from(dealInvestment)
    .where(
      and(
        eq(dealInvestment.dealId, params.dealId),
        eq(dealInvestment.contactId, targetContactMemberId),
      ),
    )
    .orderBy(desc(dealInvestment.createdAt));

  let inv: DealInvestmentRow | undefined;
  for (const row of invCandidates) {
    if (isLpInvestorRole(row.investor_role)) {
      inv = row;
      break;
    }
  }
  const now = new Date();

  if (!inv) {
    if (!profileOpt) {
      return {
        ok: false,
        message:
          "Investor profile is required to record your first commitment on this deal.",
      };
    }
    const icRaw = target?.investorClass?.trim() ?? "";

    console.log("icRaw =>", icRaw);

    const classRes = icRaw
      ? await resolveInvestorClassForDealInvestment(params.dealId, icRaw)
      : await resolveFirstInvestorClassForDeal(params.dealId);
    if (!classRes.ok) return { ok: false, message: classRes.message };

    await insertDealInvestment({
      dealId: params.dealId,
      input: {
        offeringId: "",
        contactId: targetContactMemberId,
        contactDisplayName: "",
        profileId: profileOpt,
        investor_role: LP_INVESTOR_ROLE_STORED,
        fundApproved: false,
        status: "",
        investorClass: classRes.storedInvestorClass,
        docSignedDate: null,
        commitmentAmount: incrementStr,
        extraContributionAmounts: [],
        documentStoragePath: null,
      },
    });

    if (!target) {
      if (!viewerUserId) {
        return {
          ok: false,
          message:
            "Could not determine your account id for LP Investor linking.",
        };
      }
      target = await upsertDealLpInvestor(params.dealId, {
        contactMemberId: targetContactMemberId,
        contactDisplayName: "",
        profileId: profileOpt,
        investorClass: classRes.storedInvestorClass,
        sendInvitationMail: "no",
        addedByUserId: viewerUserId,
        emailFromClient: e,
        roleFromClient: LP_INVESTOR_TABLE_ROLE,
      });
      console.log("inside target", incrementStr);
    }
    await db
      .update(dealLpInvestor)
      .set({
        profileId: profileOpt,
        committed_amount: incrementStr,
        updatedAt: now,
      })
      .where(eq(dealLpInvestor.id, target.id));

    return { ok: true };
  }

  const oldKind = normalizeLpCommitmentProfileId(
    String(inv.profileId ?? ""),
  );
  const switchingCommitmentKind = Boolean(
    profileOpt && oldKind && profileOpt !== oldKind,
  );
  if (switchingCommitmentKind && profileOpt) {
    const rowProfileId = profileOpt;
    let roster: DealLpInvestorRow | undefined = target;
    if (!roster) {
      if (!viewerUserId) {
        return {
          ok: false,
          message:
            "Could not determine your account id for LP Investor linking.",
        };
      }
      const icRaw = inv.investorClass?.trim() ?? "";
      const classRes = icRaw
        ? await resolveInvestorClassForDealInvestment(
            params.dealId,
            icRaw,
          )
        : await resolveFirstInvestorClassForDeal(params.dealId);
      if (!classRes.ok) return { ok: false, message: classRes.message };
      roster = await upsertDealLpInvestor(params.dealId, {
        contactMemberId: targetContactMemberId,
        contactDisplayName: String(inv.contactDisplayName ?? "").trim() || "",
        profileId: rowProfileId,
        investorClass: classRes.storedInvestorClass,
        sendInvitationMail: "no",
        addedByUserId: viewerUserId,
        emailFromClient: e,
        roleFromClient: LP_INVESTOR_TABLE_ROLE,
      });
    }
    await insertDealInvestment({
      dealId: params.dealId,
      input: {
        offeringId: String(inv.offeringId ?? "").trim(),
        contactId: targetContactMemberId,
        contactDisplayName: String(inv.contactDisplayName ?? "").trim() || "",
        profileId: rowProfileId,
        userInvestorProfileId: null,
        investor_role: LP_INVESTOR_ROLE_STORED,
        fundApproved: false,
        status: "",
        investorClass: String(inv.investorClass ?? "").trim() || "",
        docSignedDate: null,
        commitmentAmount: incrementStr,
        extraContributionAmounts: [],
        documentStoragePath: null,
      },
    });
    const syncedSum = await sumLpDealInvestmentCommittedForContact(
      params.dealId,
      targetContactMemberId,
    );
    await db
      .update(dealLpInvestor)
      .set({
        committed_amount: syncedSum,
        updatedAt: now,
        profileId: rowProfileId,
      })
      .where(eq(dealLpInvestor.id, roster.id));
    return { ok: true };
  }

  try {
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT 1 FROM deal_investment WHERE id = ${inv.id}::uuid FOR UPDATE`,
      );
      const [fresh] = await tx
        .select()
        .from(dealInvestment)
        .where(eq(dealInvestment.id, inv.id))
        .limit(1);
      if (!fresh) {
        throw new Error("LP_COMMITMENT_ROW_MISSING");
      }
      const previous = committedNumericFromDealInvestmentRow(fresh);
      const newTotal = previous + increment;
      const wasFundApproved = Boolean(fresh.fundApproved);
      await tx
        .update(dealInvestment)
        .set({
          commitmentAmount: formatCumulativeCommitmentStored(newTotal),
          extraContributionAmounts: [],
          ...(profileOpt ? { profileId: profileOpt } : {}),
          ...(wasFundApproved
            ? { fundApproved: false, status: "" }
            : {}),
        })
        .where(eq(dealInvestment.id, inv.id));
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "LP_COMMITMENT_ROW_MISSING") {
      return {
        ok: false,
        message: "Could not update commitment (investment row missing).",
      };
    }
    throw e;
  }

  const [invAfterCommit] = await db
    .select({ commitmentAmount: dealInvestment.commitmentAmount })
    .from(dealInvestment)
    .where(eq(dealInvestment.id, inv.id))
    .limit(1);
  const syncedCommittedFromInvestment = String(
    invAfterCommit?.commitmentAmount ?? "",
  ).trim();

  if (!target) {
    if (!viewerUserId) {
      return {
        ok: false,
        message: "Could not determine your account id for LP roster linking.",
      };
    }
    const icRaw = inv.investorClass?.trim() ?? "";
    const classRes = icRaw
      ? await resolveInvestorClassForDealInvestment(params.dealId, icRaw)
      : await resolveFirstInvestorClassForDeal(params.dealId);
    if (!classRes.ok) return { ok: false, message: classRes.message };
    target = await upsertDealLpInvestor(params.dealId, {
      contactMemberId: targetContactMemberId,
      contactDisplayName: "",
      profileId: profileOpt ?? "",
      investorClass: classRes.storedInvestorClass,
      sendInvitationMail: "no",
      addedByUserId: viewerUserId,
      emailFromClient: e,
      roleFromClient: LP_INVESTOR_TABLE_ROLE,
    });
  }

  await db
    .update(dealLpInvestor)
    .set({
      committed_amount: syncedCommittedFromInvestment,
      updatedAt: now,
      ...(profileOpt ? { profileId: profileOpt } : {}),
    })
    .where(eq(dealLpInvestor.id, target.id));

  return { ok: true };
}
