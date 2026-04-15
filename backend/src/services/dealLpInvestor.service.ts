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
  buildInvestorKpisFromRows,
  DEAL_INVESTMENT_AUTOSAVE_CONTACT_PLACEHOLDER,
  insertDealInvestment,
  isLpInvestorRole,
  LP_INVESTOR_ROLE_STORED,
  listDealInvestmentsByDealId,
  mapRowToInvestorApi,
  resolveFirstInvestorClassForDeal,
  resolveInvestorClassForDealInvestment,
  resolveUserDisplayNamesByIds,
  resolveUsersByContactIds,
} from "./dealInvestment.service.js";

function normalizeContactKey(raw: string): string {
  return String(raw ?? "").trim().toLowerCase();
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
 * Co-sponsors only see LP investors they added (`deal_lp_investor.added_by` or
 * `deal_member.added_by` for that contact).
 */
async function filterMergedLpInvestorsForCoSponsorViewer(
  dealId: string,
  viewerUserId: string,
  merged: DealInvestmentRow[],
): Promise<DealInvestmentRow[]> {
  const viewer = String(viewerUserId).trim().toLowerCase();
  const lpRows = await db
    .select({ id: dealLpInvestor.id, addedBy: dealLpInvestor.addedBy })
    .from(dealLpInvestor)
    .where(eq(dealLpInvestor.dealId, dealId));
  const lpAddedBy = new Map<string, string>();
  for (const r of lpRows) {
    const adder = r.addedBy ? String(r.addedBy).toLowerCase() : "";
    lpAddedBy.set(String(r.id).toLowerCase(), adder);
  }

  const memberRows = await db
    .select({
      contactMemberId: dealMember.contactMemberId,
      addedBy: dealMember.addedBy,
    })
    .from(dealMember)
    .where(eq(dealMember.dealId, dealId));
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

  return merged.filter((row) => {
    const idKey = String(row.id ?? "").toLowerCase();
    if (lpAddedBy.has(idKey)) return lpAddedBy.get(idKey) === viewer;
    const ck = normalizeContactKey(row.contactId ?? "");
    if (!ck || ck === placeholderKey) return false;
    const adder = contactAddedBy.get(ck);
    return adder === viewer;
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
  const fromUser = String(uRow?.email ?? "").trim().toLowerCase();
  if (fromUser) return fromUser;
  const [cRow] = await db
    .select({ email: contact.email })
    .from(contact)
    .where(sql`${contact.id}::text = ${cid}`)
    .limit(1);
  return String(cRow?.email ?? "").trim().toLowerCase();
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
    investor_role: investorRoleFromDealLpInvestorRow(m),
    status: "",
    investorClass: m.investorClass,
    docSignedDate: null,
    commitmentAmount: "",
    extraContributionAmounts: [],
    documentStoragePath: null,
    createdAt: m.createdAt,
  };
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
    /** LP investor row drives role; investment row may differ. */
    investor_role: syn.investor_role,
  };
}

/**
 * LP tab list: latest `deal_investment` per contact (LP role) plus `deal_lp_investor`
 * rows whose contact has no LP investment row (prefer investment for financials).
 * For LP-investor-only contacts, `commitment_amount` / extras come from the latest
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
  investorKind?: "investment" | "lp_investor";
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
    const kind: "investment" | "lp_investor" = lpRowIds.has(idKey)
      ? "lp_investor"
      : "investment";
    out.push({ ...base, investorKind: kind });
  }
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
  const rosterEmailByLpId = new Map<string, string>();
  for (const m of roster) {
    const key = m.addedBy ? String(m.addedBy).toLowerCase() : "";
    const name =
      key && addedByNames.has(key) ? addedByNames.get(key)! : "—";
    addedByByLpId.set(String(m.id).toLowerCase(), name);
    const em = String(m.email ?? "").trim();
    if (em) rosterEmailByLpId.set(String(m.id).toLowerCase(), em);
  }

  const investors = base.map((inv) => {
    const id = String(inv.id ?? "").toLowerCase();
    const extra =
      lpRosterIds.has(id) && addedByByLpId.has(id)
        ? { addedByDisplayName: addedByByLpId.get(id)! }
        : {};
    const storedEmail = lpRosterIds.has(id)
      ? rosterEmailByLpId.get(id)
      : undefined;
    const emailPatch =
      storedEmail?.trim() ? { userEmail: storedEmail.trim() } : {};
    return { ...inv, ...extra, ...emailPatch };
  });

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
  if (!cid) throw new Error("contact_member_id required");

  const send =
    String(input.sendInvitationMail ?? "").toLowerCase() === "yes"
      ? "yes"
      : "no";
  const profileId = String(input.profileId ?? "").trim();
  const now = new Date();
  const fromClientEmail = String(input.emailFromClient ?? "").trim();
  const fromClientRole = String(input.roleFromClient ?? "").trim();
  const resolvedEmail = fromClientEmail || (await resolveEmailForContactMemberId(cid));
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
  const profileId = String(input.profileId ?? "").trim();
  const now = new Date();
  const fromClientEmail = String(input.emailFromClient ?? "").trim();
  const fromClientRole = String(input.roleFromClient ?? "").trim();
  const resolvedEmail = fromClientEmail || (await resolveEmailForContactMemberId(cid));
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

function normalizeCommittedAmountStored(raw: string): string {
  const t = String(raw ?? "").trim().replace(/[$,\s]/g, "");
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

function normalizeLpCommitmentProfileId(raw: string | undefined): string | null {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  return LP_COMMITMENT_PROFILE_IDS.has(t) ? t : null;
}

/**
 * LP self-service: writes `commitment_amount` (+ optional `profile_id`) on the latest
 * `deal_investment` for this deal + contact, or creates that row when missing (requires
 * a valid `profile_id`). Keeps `deal_lp_investor.profile_id` in sync when profile is sent.
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
  const e = String(params.viewerEmailNorm ?? "").trim().toLowerCase();
  if (!e.includes("@"))
    return { ok: false, message: "Invalid viewer email" };

  const stored = normalizeCommittedAmountStored(params.committedAmount);
  if (!stored) {
    return {
      ok: false,
      message: "Committed amount must be a number greater than 0",
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

  let target: DealLpInvestorRow | undefined;
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
        status: "",
        investorClass: classRes.storedInvestorClass,
        docSignedDate: null,
        commitmentAmount: stored,
        extraContributionAmounts: [],
        documentStoragePath: null,
      },
    });

    if (!target) {
      if (!viewerUserId) {
        return {
          ok: false,
          message: "Could not determine your account id for LP roster linking.",
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
    }

    await db
      .update(dealLpInvestor)
      .set({ profileId: profileOpt, updatedAt: now })
      .where(eq(dealLpInvestor.id, target.id));

    return { ok: true };
  }

  const invPatch: { commitmentAmount: string; profileId?: string } = {
    commitmentAmount: stored,
  };
  if (profileOpt) invPatch.profileId = profileOpt;

  await db
    .update(dealInvestment)
    .set(invPatch)
    .where(eq(dealInvestment.id, inv.id));

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

  if (profileOpt) {
    await db
      .update(dealLpInvestor)
      .set({ profileId: profileOpt, updatedAt: now })
      .where(eq(dealLpInvestor.id, target.id));
  }

  return { ok: true };
}
