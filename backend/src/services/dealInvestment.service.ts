import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getUploadsPhysicalRoot } from "../config/uploadPaths.js";
import { db, pool } from "../database/db.js";
import { users } from "../schema/auth.schema/signin.js";
import { contact } from "../schema/contact.schema.js";
import { addDealForm } from "../schema/deal.schema/add-deal-form.schema.js";
import {
  dealInvestment,
  type DealInvestmentInsert,
  type DealInvestmentRow,
} from "../schema/deal.schema/deal-investment.schema.js";
import { dealLpInvestor } from "../schema/deal.schema/deal-lp-investor.schema.js";
import { dealMember } from "../schema/deal.schema/deal-member.schema.js";
import { listInvestorClassesByDealId } from "./dealInvestorClass.service.js";
import { formatDdMmmYyyy } from "../utils/formatDdMmmYyyy.js";

const UPLOAD_SUBDIR = "deal-investments";

/** Canonical `investor_role` for LP investors (Investors tab add + list filter). */
export const LP_INVESTOR_ROLE_STORED = "lp_investors";

const LP_INVESTOR_ROLE_MATCH = [
  LP_INVESTOR_ROLE_STORED,
  "LP Investors",
  "LP Investor",
] as const;

/** True when `investor_role` is the LP Investors tab role (not sponsor / deal team roles). */
export function isLpInvestorRole(raw: string | null | undefined): boolean {
  const s = String(raw ?? "").trim().toLowerCase();
  return s === "lp_investors" || s === "lp investors" || s === "lp investor";
}

const MEMBER_NAME: Record<string, string> = {
  rebecca_duffy: "Rebecca Duffy",
  nigam_family: "Nigam Family LLC",
  j_smith: "J. Smith",
};

const USER_BY_CONTACT: Record<
  string,
  { userDisplayName: string; userEmail: string }
> = {
  rebecca_duffy: {
    userDisplayName: "rduffy",
    userEmail: "rebecca.duffy@example.com",
  },
  nigam_family: {
    userDisplayName: "anigam",
    userEmail: "contact@nigamfamily.com",
  },
  j_smith: {
    userDisplayName: "jsmith",
    userEmail: "j.smith@example.com",
  },
};

const PROFILE_LABEL: Record<string, string> = {
  individual: "Individual",
  custodian_ira_401k: "Custodian IRA or custodian based 401(k)",
  joint_tenancy: "Joint tenancy",
  llc_corp_trust_etc:
    "LLC, corp, partnership, trust, solo 401(k), or checkbook IRA",
};

/**
 * Ensures `investor_class` matches a row in `deal_investor_class` for this deal.
 * Accepts class id or name (case-insensitive name match). Stores the class **name** on the investment row.
 */
/** Stored as `contact_id` when Add Investment autosave runs before a member is chosen. */
export const DEAL_INVESTMENT_AUTOSAVE_CONTACT_PLACEHOLDER =
  "__portal_investment_autosave__";

export async function resolveFirstInvestorClassForDeal(
  dealId: string,
): Promise<
  { ok: true; storedInvestorClass: string } | { ok: false; message: string }
> {
  const classes = await listInvestorClassesByDealId(dealId);
  if (classes.length === 0) {
    return {
      ok: false,
      message:
        "Add at least one investor class in the Classes section before recording an investment.",
    };
  }
  const first = classes[0]!;
  const name = first.name?.trim();
  return { ok: true, storedInvestorClass: name || first.id };
}

export async function resolveInvestorClassForDealInvestment(
  dealId: string,
  raw: string,
): Promise<
  { ok: true; storedInvestorClass: string } | { ok: false; message: string }
> {
  const classes = await listInvestorClassesByDealId(dealId);
  const t = raw.trim();

  if (classes.length === 0) {
    if (!t) {
      return {
        ok: false,
        message:
          "Add at least one investor class in the Classes section before recording an investment.",
      };
    }
    return {
      ok: false,
      message:
        "No investor classes are defined for this deal. Complete the Classes section before assigning a class.",
    };
  }

  if (!t) {
    return { ok: false, message: "Investor class is required." };
  }

  const byId = classes.find((c) => c.id === t);
  if (byId) {
    const name = byId.name?.trim();
    return {
      ok: true,
      storedInvestorClass: name || byId.id,
    };
  }

  const norm = (s: string) => s.trim().toLowerCase();
  const byName = classes.find((c) => norm(c.name) === norm(t));
  if (byName) {
    const name = byName.name?.trim();
    return {
      ok: true,
      storedInvestorClass: name || byName.id,
    };
  }

  return {
    ok: false,
    message:
      "The selected investor class is not defined for this deal. Choose a class from the Classes section.",
  };
}

export type CreateDealInvestmentInput = {
  offeringId: string;
  contactId: string;
  /** Human-readable member label (from directory); stored so list API does not show raw id */
  contactDisplayName: string;
  profileId: string;
  investor_role: string;
  status: string;
  investorClass: string;
  docSignedDate: string | null;
  commitmentAmount: string;
  extraContributionAmounts: string[];
  documentStoragePath: string | null;
};

/** Matches PostgreSQL uuid text (any variant) — used for users.id lookups */
function looksLikeUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    s.trim(),
  );
}

function memberName(contactId: string): string {
  const mapped = MEMBER_NAME[contactId]?.trim();
  if (mapped) return mapped;
  const c = contactId?.trim();
  if (!c) return "—";
  if (looksLikeUuid(c)) return "—";
  return c;
}

function formatMemberDisplayFromUser(u: {
  firstName: string;
  lastName: string;
  username: string;
  companyName: string;
}): string {
  const full = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
  if (full) return full;
  const co = u.companyName?.trim();
  if (co) return co;
  const un = u.username?.trim();
  if (un) return un;
  return "—";
}

type ResolvedPortalUser = {
  displayName: string;
  userDisplayName: string;
  userEmail: string;
};

/**
 * Load portal `users` and CRM `contact` rows for uuid `contact_id` values so list APIs
 * return name + email (contacts are not in `users`).
 */
export async function resolveUsersByContactIds(
  rows: DealInvestmentRow[],
): Promise<Map<string, ResolvedPortalUser>> {
  const need = new Set<string>();
  for (const r of rows) {
    const id = r.contactId?.trim();
    if (id && looksLikeUuid(id)) need.add(id.toLowerCase());
  }
  if (need.size === 0) return new Map();
  const ids = [...need];
  const found = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      username: users.username,
      companyName: users.companyName,
    })
    .from(users)
    .where(inArray(users.id, ids));
  const m = new Map<string, ResolvedPortalUser>();
  for (const u of found) {
    const key = String(u.id).toLowerCase();
    const email = u.email?.trim() || "—";
    const un = u.username?.trim() || "—";
    m.set(key, {
      displayName: formatMemberDisplayFromUser(u),
      userDisplayName: un,
      userEmail: email,
    });
  }
  const notInUsers = ids.filter((id) => !m.has(id.toLowerCase()));
  if (notInUsers.length > 0) {
    const contactRows = await db
      .select({
        id: contact.id,
        email: contact.email,
        firstName: contact.firstName,
        lastName: contact.lastName,
      })
      .from(contact)
      .where(inArray(contact.id, notInUsers));
    for (const c of contactRows) {
      const key = String(c.id).toLowerCase();
      const displayName = [c.firstName, c.lastName]
        .filter(Boolean)
        .join(" ")
        .trim()
        || "—";
      const email = c.email?.trim() || "—";
      m.set(key, {
        displayName,
        userDisplayName: "—",
        userEmail: email,
      });
    }
  }
  return m;
}

/** First + last for “Added by” / roster adder labels; prefers person name over company. */
function formatFirstLastFromNames(
  first: string | null | undefined,
  last: string | null | undefined,
): string {
  const full = [first, last]
    .map((x) => String(x ?? "").trim())
    .filter(Boolean)
    .join(" ")
    .trim();
  return full || "—";
}

/**
 * Resolve portal user ids (e.g. `deal_member.added_by`, `deal_lp_investor.added_by`) to a display
 * string: **first + last name** when present, else company / username for users (`formatMemberDisplayFromUser`).
 * IDs not in `users` are resolved from `contact` (same UUID directory) so sponsor-only contact rows still show.
 */
export async function resolveUserDisplayNamesByIds(
  ids: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const need = new Set<string>();
  for (const raw of ids) {
    const id = raw?.trim();
    if (id && looksLikeUuid(id)) need.add(id.toLowerCase());
  }
  if (need.size === 0) return new Map();
  const idList = [...need];
  const found = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      username: users.username,
      companyName: users.companyName,
    })
    .from(users)
    .where(inArray(users.id, idList));
  const m = new Map<string, string>();
  for (const u of found) {
    const key = String(u.id).toLowerCase();
    const firstLast = formatFirstLastFromNames(u.firstName, u.lastName);
    if (firstLast !== "—") {
      m.set(key, firstLast);
    } else {
      m.set(key, formatMemberDisplayFromUser(u));
    }
  }
  const missingAfterUsers = idList.filter((id) => !m.has(id));
  if (missingAfterUsers.length === 0) return m;

  const contactRows = await db
    .select({
      id: contact.id,
      firstName: contact.firstName,
      lastName: contact.lastName,
    })
    .from(contact)
    .where(inArray(contact.id, missingAfterUsers));
  for (const c of contactRows) {
    const key = String(c.id).toLowerCase();
    m.set(key, formatFirstLastFromNames(c.firstName, c.lastName));
  }
  return m;
}

function profileLabel(profileId: string): string {
  if (!profileId?.trim()) return "—";
  return PROFILE_LABEL[profileId] ?? profileId;
}

function userForContact(contactId: string): {
  userDisplayName: string;
  userEmail: string;
} {
  return (
    USER_BY_CONTACT[contactId] ?? {
      userDisplayName: "—",
      userEmail: "—",
    }
  );
}

function formatSignedDate(iso: string | null | undefined): string {
  const s = iso?.trim();
  if (!s) return "—";
  return formatDdMmmYyyy(s);
}

function committedAmountParts(
  commitmentAmount: string,
  extras: string[] | null | undefined,
): number[] {
  const list = Array.isArray(extras) ? extras.map(String) : [];
  const raw = [commitmentAmount, ...list];
  return raw
    .map((s) => parseFloat(String(s).replace(/[^0-9.-]/g, "")))
    .filter((n) => Number.isFinite(n));
}

function formatCommitted(
  commitmentAmount: string,
  extras: string[] | null | undefined,
): string {
  const nums = committedAmountParts(commitmentAmount, extras);
  const sum =
    nums.length === 0 ? 0 : nums.reduce((a, b) => a + b, 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(sum);
}

function rowCommittedNumeric(row: DealInvestmentRow): number {
  const nums = committedAmountParts(
    row.commitmentAmount,
    row.extraContributionAmounts as string[] | null,
  );
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0);
}

/** Sum of primary commitment + extra lines (used for cumulative LP commits). */
export function committedNumericFromDealInvestmentRow(
  row: DealInvestmentRow,
): number {
  return rowCommittedNumeric(row);
}

function formatUsdKpi(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function buildInvestorKpisFromRows(rows: DealInvestmentRow[]): {
  offeringSize: string;
  committed: string;
  remaining: string;
  totalApproved: string;
  totalPending: string;
  totalFunded: string;
  approvedCount: string;
  pendingCount: string;
  waitlistCount: string;
  averageApproved: string;
  nonAccreditedCount: string;
} {
  let total = 0;
  for (const r of rows) total += rowCommittedNumeric(r);
  const count = rows.length;
  const avg = count > 0 && total > 0 ? total / count : 0;
  return {
    offeringSize: "—",
    committed: formatUsdKpi(total),
    remaining: "—",
    totalApproved: formatUsdKpi(total),
    totalPending: "—",
    totalFunded: "—",
    approvedCount: String(count),
    pendingCount: "—",
    waitlistCount: "—",
    averageApproved: count > 0 && total > 0 ? formatUsdKpi(avg) : "—",
    nonAccreditedCount: "—",
  };
}

export function mapRowToInvestorApi(
  row: DealInvestmentRow,
  resolvedByUserId?: Map<string, ResolvedPortalUser>,
) {
  const cid = row.contactId?.trim() ?? "";
  if (cid === DEAL_INVESTMENT_AUTOSAVE_CONTACT_PLACEHOLDER) {
    const extras = (row.extraContributionAmounts as string[] | null) ?? [];
    return {
      id: row.id,
      displayName: "Draft",
      entitySubtitle: profileLabel(row.profileId),
      userDisplayName: "—",
      userEmail: "—",
      investorClass: row.investorClass?.trim() || "—",
      investorRole: row.investor_role?.trim() || "",
      status: row.status?.trim() || "—",
      committed: formatCommitted(
        row.commitmentAmount,
        row.extraContributionAmounts as string[] | null,
      ),
      signedDate: formatSignedDate(row.docSignedDate),
      fundedDate: "—",
      selfAccredited: "—",
      verifiedAccLabel: "Not Started",
      contactId: row.contactId ?? "",
      profileId: row.profileId ?? "",
      offeringId: row.offeringId ?? "",
      commitmentAmountRaw: row.commitmentAmount ?? "",
      extraContributionAmounts: extras,
      docSignedDateIso: row.docSignedDate?.trim() ?? "",
    };
  }
  const legacy = userForContact(row.contactId);
  const res =
    cid && looksLikeUuid(cid)
      ? resolvedByUserId?.get(cid.toLowerCase())
      : undefined;

  const stored = row.contactDisplayName?.trim();
  const displayName =
    stored || res?.displayName || memberName(row.contactId);

  const userDisplayName = res?.userDisplayName ?? legacy.userDisplayName;
  const userEmail = res?.userEmail ?? legacy.userEmail;

  const extras = (row.extraContributionAmounts as string[] | null) ?? [];
  return {
    id: row.id,
    displayName,
    entitySubtitle: profileLabel(row.profileId),
    userDisplayName,
    userEmail,
    investorClass: row.investorClass?.trim() || "—",
    investorRole: row.investor_role?.trim() || "",
    status: row.status?.trim() || "—",
    committed: formatCommitted(
      row.commitmentAmount,
      row.extraContributionAmounts as string[] | null,
    ),
    signedDate: formatSignedDate(row.docSignedDate),
    fundedDate: "—",
    selfAccredited: "—",
    verifiedAccLabel: "Not Started",
    /** Raw fields for edit-investment form */
    contactId: row.contactId ?? "",
    profileId: row.profileId ?? "",
    offeringId: row.offeringId ?? "",
    commitmentAmountRaw: row.commitmentAmount ?? "",
    extraContributionAmounts: extras,
    docSignedDateIso: row.docSignedDate?.trim() ?? "",
  };
}

function rosterContactKey(raw: string | null | undefined): string {
  return String(raw ?? "").trim().toLowerCase();
}

const PLACEHOLDER_CONTACT_KEY = rosterContactKey(
  DEAL_INVESTMENT_AUTOSAVE_CONTACT_PLACEHOLDER,
);

/**
 * Total committed per contact for a deal, summed across every `deal_investment` row
 * for that deal + contact (multiple rows additive; matches cumulative storage per row).
 */
export function totalCommittedByContactKeyFromRows(
  rows: DealInvestmentRow[],
): Map<string, number> {
  const m = new Map<string, number>();
  for (const inv of rows) {
    const k = rosterContactKey(inv.contactId);
    if (!k || k === PLACEHOLDER_CONTACT_KEY) continue;
    const n = rowCommittedNumeric(inv);
    m.set(k, (m.get(k) ?? 0) + n);
  }
  return m;
}

/** Replace primary + extras with one stored total (avoids double-count when summing rows). */
export function applyTotalCommittedToDealInvestmentRow(
  row: DealInvestmentRow,
  totalByContact: Map<string, number>,
): DealInvestmentRow {
  const k = rosterContactKey(row.contactId);
  if (!k) return row;
  const t = totalByContact.get(k);
  if (t === undefined) return row;
  const rounded = Math.round(t * 100) / 100;
  return {
    ...row,
    commitmentAmount: String(rounded),
    extraContributionAmounts: [],
  };
}

function normalizeEmailForCanonical(
  email: string | null | undefined,
): string | null {
  const t = String(email ?? "").trim().toLowerCase();
  if (!t || !t.includes("@")) return null;
  return t;
}

/**
 * Maps each roster `contact_id` / `contact_member_id` string to a stable key so that
 * the same person represented by both `users.id` and `contact.id` shares one bucket
 * for commitment totals (email match).
 */
export async function mapContactIdsToCanonicalCommitmentKeys(
  rawIds: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = new Set<string>();
  for (const x of rawIds) {
    const t = String(x ?? "").trim();
    if (t) unique.add(t);
  }
  if (unique.size === 0) return out;

  const cleaned = [...unique];
  const uuids = cleaned.filter((id) => looksLikeUuid(id));

  const idToEmail = new Map<string, string>();
  if (uuids.length > 0) {
    const [userRows, contactRows] = await Promise.all([
      db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(inArray(users.id, uuids)),
      db
        .select({ id: contact.id, email: contact.email })
        .from(contact)
        .where(inArray(contact.id, uuids)),
    ]);
    for (const u of userRows) {
      const em = normalizeEmailForCanonical(u.email);
      if (em) idToEmail.set(String(u.id).toLowerCase(), em);
    }
    for (const c of contactRows) {
      const em = normalizeEmailForCanonical(c.email);
      if (em) idToEmail.set(String(c.id).toLowerCase(), em);
    }
  }

  for (const raw of cleaned) {
    const rk = rosterContactKey(raw);
    const em = looksLikeUuid(raw) ? idToEmail.get(rk) : undefined;
    out.set(rk, em ? `em:${em}` : `id:${rk}`);
  }
  return out;
}

/**
 * Like `totalCommittedByContactKeyFromRows`, but sums by canonical investor key
 * (see `mapContactIdsToCanonicalCommitmentKeys`).
 */
export function totalCommittedByCanonicalKeyFromRows(
  rows: DealInvestmentRow[],
  rawToCanonical: Map<string, string>,
): Map<string, number> {
  const m = new Map<string, number>();
  for (const inv of rows) {
    const k = rosterContactKey(inv.contactId);
    if (!k || k === PLACEHOLDER_CONTACT_KEY) continue;
    const ck = rawToCanonical.get(k) ?? `id:${k}`;
    const n = rowCommittedNumeric(inv);
    m.set(ck, (m.get(ck) ?? 0) + n);
  }
  return m;
}

export function groupDealInvestmentsByCanonicalKey(
  rows: DealInvestmentRow[],
  rawToCanonical: Map<string, string>,
): Map<string, DealInvestmentRow[]> {
  const m = new Map<string, DealInvestmentRow[]>();
  for (const inv of rows) {
    const k = rosterContactKey(inv.contactId);
    if (!k || k === PLACEHOLDER_CONTACT_KEY) continue;
    const ck = rawToCanonical.get(k) ?? `id:${k}`;
    const arr = m.get(ck) ?? [];
    arr.push(inv);
    m.set(ck, arr);
  }
  return m;
}

/** Sets primary commitment to the total for this canonical key; clears extras. */
export function applyTotalCommittedToDealInvestmentRowForCanonical(
  row: DealInvestmentRow,
  totalByCanonical: Map<string, number>,
  canonicalKey: string,
): DealInvestmentRow {
  const t = totalByCanonical.get(canonicalKey) ?? 0;
  const rounded = Math.round(t * 100) / 100;
  return {
    ...row,
    commitmentAmount: String(rounded),
    extraContributionAmounts: [],
  };
}

function isPortalParticipantStoredRole(raw: string | null | undefined): boolean {
  const t = String(raw ?? "").trim().toLowerCase();
  return t === "deal_participant" || t === "deal participant";
}

/**
 * Loads `deal_member.deal_member_role` per contact for this deal (roster is source of truth
 * for sponsor / deal-team labels; `deal_investment.investor_role` may still carry portal role).
 */
async function loadDealMemberRolesByContactForDeal(
  dealId: string,
): Promise<Map<string, string>> {
  const rows = await db
    .select({
      contactMemberId: dealMember.contactMemberId,
      dealMemberRole: dealMember.dealMemberRole,
    })
    .from(dealMember)
    .where(eq(dealMember.dealId, dealId));
  const map = new Map<string, string>();
  for (const r of rows) {
    const k = rosterContactKey(r.contactMemberId);
    if (!k) continue;
    const role = String(r.dealMemberRole ?? "").trim();
    if (!role) continue;
    map.set(k, role);
  }
  return map;
}

async function loadLpRosterContactKeysForDeal(dealId: string): Promise<Set<string>> {
  const rows = await db
    .select({ contactMemberId: dealLpInvestor.contactMemberId })
    .from(dealLpInvestor)
    .where(eq(dealLpInvestor.dealId, dealId));
  const set = new Set<string>();
  for (const r of rows) {
    const k = rosterContactKey(r.contactMemberId);
    if (k) set.add(k);
  }
  return set;
}

/**
 * Replaces stored portal role `deal_participant` on investment rows with the deal roster role
 * from `deal_member`, or `lp_investors` when the contact is on the LP roster.
 */
export async function enrichInvestorRolesForDealRows(
  dealId: string,
  rows: DealInvestmentRow[],
): Promise<DealInvestmentRow[]> {
  if (rows.length === 0) return rows;
  const [memberRoleByContact, lpContactKeys] = await Promise.all([
    loadDealMemberRolesByContactForDeal(dealId),
    loadLpRosterContactKeysForDeal(dealId),
  ]);
  return rows.map((row) => {
    if (!isPortalParticipantStoredRole(row.investor_role)) return row;
    const k = rosterContactKey(row.contactId);
    if (!k) return row;
    const roster = memberRoleByContact.get(k)?.trim();
    if (roster) return { ...row, investor_role: roster };
    if (lpContactKeys.has(k)) {
      return { ...row, investor_role: LP_INVESTOR_ROLE_STORED };
    }
    return row;
  });
}

export async function mapDealInvestmentsToInvestorApi(
  rows: DealInvestmentRow[],
): Promise<ReturnType<typeof mapRowToInvestorApi>[]> {
  const dealId = rows[0]?.dealId;
  const enriched =
    dealId && rows.length > 0
      ? await enrichInvestorRolesForDealRows(dealId, rows)
      : rows;
  const resolved = await resolveUsersByContactIds(enriched);
  return enriched.map((r) => mapRowToInvestorApi(r, resolved));
}

/**
 * LP roster `added_by` first, then `deal_member` rows (roster wins for same contact).
 * Keys are normalized `contact_id` strings; values are portal user ids (`users.id`).
 */
export async function loadRosterAddedByUserIdByContactKey(
  dealId: string,
): Promise<Map<string, string>> {
  const [memberRows, lpRoster] = await Promise.all([
    db
      .select({
        contactMemberId: dealMember.contactMemberId,
        addedBy: dealMember.addedBy,
      })
      .from(dealMember)
      .where(eq(dealMember.dealId, dealId)),
    db
      .select({
        contactMemberId: dealLpInvestor.contactMemberId,
        addedBy: dealLpInvestor.addedBy,
      })
      .from(dealLpInvestor)
      .where(eq(dealLpInvestor.dealId, dealId)),
  ]);
  const addedByUserIdByContact = new Map<string, string>();
  for (const m of lpRoster) {
    const k = rosterContactKey(m.contactMemberId);
    if (!k || !m.addedBy) continue;
    if (!addedByUserIdByContact.has(k))
      addedByUserIdByContact.set(k, String(m.addedBy));
  }
  for (const m of memberRows) {
    const k = rosterContactKey(m.contactMemberId);
    if (!k || !m.addedBy) continue;
    addedByUserIdByContact.set(k, String(m.addedBy));
  }
  return addedByUserIdByContact;
}

/**
 * Maps `contact_member_id` / roster `contact_id` to portal `users.id` (lowercase).
 * Direct `users.id` maps to itself; CRM `contact.id` maps via email match to a user when present.
 */
async function resolvePortalUserIdLowerByContactMemberIds(
  rawIds: readonly string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const uniqueRaw = [
    ...new Set(rawIds.map((x) => String(x ?? "").trim()).filter(Boolean)),
  ];
  if (uniqueRaw.length === 0) return out;

  const uuids = uniqueRaw.filter((id) => looksLikeUuid(id));
  if (uuids.length === 0) return out;

  const userRows = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.id, uuids));
  const userIdLower = new Set(userRows.map((u) => String(u.id).toLowerCase()));
  for (const raw of uniqueRaw) {
    if (!looksLikeUuid(raw)) continue;
    const k = rosterContactKey(raw);
    if (userIdLower.has(k)) out.set(k, k);
  }

  const missingUuid = uuids.filter((id) => !out.has(rosterContactKey(id)));
  if (missingUuid.length === 0) return out;

  const contactRows = await db
    .select({ id: contact.id, email: contact.email })
    .from(contact)
    .where(inArray(contact.id, missingUuid));

  const emails = [
    ...new Set(
      contactRows
        .map((c) => String(c.email ?? "").trim().toLowerCase())
        .filter((e) => e.includes("@")),
    ),
  ];
  const emailToUserLower = new Map<string, string>();
  for (const em of emails) {
    const [u] = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(trim(${users.email})) = ${em}`)
      .limit(1);
    if (u) emailToUserLower.set(em, String(u.id).toLowerCase());
  }
  for (const c of contactRows) {
    const k = rosterContactKey(c.id);
    const em = String(c.email ?? "").trim().toLowerCase();
    if (em && emailToUserLower.has(em)) out.set(k, emailToUserLower.get(em)!);
  }
  return out;
}

/**
 * Sum of commitment from investors a **deal member** brought in: roster `added_by` equals
 * that member’s portal `users.id`, excluding the member’s **own** commitment.
 *
 * For contacts in `deal_lp_investor`, the displayed total uses **`committed_amount` only**
 * (Invest Now / LP path). `deal_investment` rows for the same contact are skipped so we do
 * not double-count. Contacts without an LP row still contribute via `deal_investment`.
 *
 * Result is keyed by normalized member `contact_member_id` (same keys as the roster row).
 */
export async function sumCommittedFromInvestorsAddedByMemberContacts(
  dealId: string,
  memberContactKeys: ReadonlySet<string>,
): Promise<Map<string, number>> {
  if (memberContactKeys.size === 0) return new Map();

  const memberKeysArr = [...memberContactKeys].filter(Boolean);
  const portalUserByMemberKey =
    await resolvePortalUserIdLowerByContactMemberIds(memberKeysArr);

  const interestedSponsorIds = new Set<string>();
  for (const k of memberKeysArr) {
    const uid = portalUserByMemberKey.get(k);
    if (uid) interestedSponsorIds.add(uid);
  }

  const addedByByContact = await loadRosterAddedByUserIdByContactKey(dealId);
  const investments = await listDealInvestmentsByDealId(dealId);

  const lpRows = await db
    .select({
      contactMemberId: dealLpInvestor.contactMemberId,
      addedBy: dealLpInvestor.addedBy,
      committed_amount: dealLpInvestor.committed_amount,
    })
    .from(dealLpInvestor)
    .where(eq(dealLpInvestor.dealId, dealId));

  const contactKeyUsesLpCommittedAmount = new Set<string>();
  for (const r of lpRows) {
    const rk = rosterContactKey(r.contactMemberId);
    if (rk) contactKeyUsesLpCommittedAmount.add(rk);
  }

  const invContactKeys = new Set<string>();
  for (const inv of investments) {
    const rk = rosterContactKey(inv.contactId);
    if (rk) invContactKeys.add(rk);
  }
  const portalByInvContactKey = await resolvePortalUserIdLowerByContactMemberIds([
    ...invContactKeys,
  ]);

  const sumBySponsorUserId = new Map<string, number>();

  for (const inv of investments) {
    const invCk = rosterContactKey(inv.contactId);
    if (contactKeyUsesLpCommittedAmount.has(invCk)) continue;
    const adderRaw = addedByByContact.get(invCk);
    if (!adderRaw) continue;
    const adderUid = String(adderRaw).toLowerCase();
    if (!interestedSponsorIds.has(adderUid)) continue;
    const invPortal = portalByInvContactKey.get(invCk);
    const isSelf =
      (invPortal && invPortal === adderUid) || invCk === adderUid;
    if (isSelf) continue;
    const n = rowCommittedNumeric(inv);
    sumBySponsorUserId.set(
      adderUid,
      (sumBySponsorUserId.get(adderUid) ?? 0) + n,
    );
  }

  const lpContactKeys = new Set<string>();
  for (const r of lpRows) {
    const rk = rosterContactKey(r.contactMemberId);
    if (rk) lpContactKeys.add(rk);
  }
  const portalByLpContactKey = await resolvePortalUserIdLowerByContactMemberIds([
    ...lpContactKeys,
  ]);

  for (const r of lpRows) {
    if (!r.addedBy) continue;
    const adderUid = String(r.addedBy).toLowerCase();
    if (!interestedSponsorIds.has(adderUid)) continue;
    const ck = rosterContactKey(r.contactMemberId);
    const invPortal = portalByLpContactKey.get(ck);
    const isSelf = (invPortal && invPortal === adderUid) || ck === adderUid;
    if (isSelf) continue;
    const n = parseFloat(
      String(r.committed_amount ?? "").replace(/[^0-9.-]/g, ""),
    );
    if (!Number.isFinite(n)) continue;
    sumBySponsorUserId.set(
      adderUid,
      (sumBySponsorUserId.get(adderUid) ?? 0) + n,
    );
  }

  const out = new Map<string, number>();
  for (const mk of memberKeysArr) {
    const sponsorUid = portalUserByMemberKey.get(mk);
    const total = sponsorUid
      ? (sumBySponsorUserId.get(sponsorUid) ?? 0)
      : 0;
    out.set(mk, total);
  }
  return out;
}

export function formatCommittedUsdWhole(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

/**
 * Match investment `contact_id` to roster `added_by` when raw ids differ but the
 * person is the same (e.g. portal `users.id` on `deal_investment` vs `contact.id`
 * on `deal_member` / `deal_lp_investor`) using the same canonical keys as commitment totals.
 */
function resolveRosterAddedByUserId(
  contactIdRaw: string | undefined,
  rosterAddedByByContactKey: Map<string, string>,
  rawToCanonical: Map<string, string>,
): string | undefined {
  const k = rosterContactKey(contactIdRaw);
  if (!k) return undefined;
  const direct = rosterAddedByByContactKey.get(k);
  if (direct) return direct;
  const targetCanon =
    rawToCanonical.get(k) ?? `id:${k}`;
  for (const [rosterK, uid] of rosterAddedByByContactKey) {
    const rosterCanon =
      rawToCanonical.get(rosterK) ?? `id:${rosterK}`;
    if (rosterCanon === targetCanon) return uid;
  }
  return undefined;
}

/**
 * Adds `addedByDisplayName` from `deal_member.added_by` (wins over LP roster) and
 * `deal_lp_investor.added_by` so the Investors tab can show who added each investor
 * next to committed amounts.
 */
export async function enrichInvestorApiRowsWithAddedBy<
  T extends { contactId?: string; addedByDisplayName?: string },
>(dealId: string, rows: T[]): Promise<Array<T & { addedByUserId?: string }>> {
  if (rows.length === 0) return rows as Array<T & { addedByUserId?: string }>;
  const rosterAddedByByContactKey =
    await loadRosterAddedByUserIdByContactKey(dealId);
  const idSet = new Set<string>();
  for (const rk of rosterAddedByByContactKey.keys()) {
    if (rk) idSet.add(rk);
  }
  for (const row of rows) {
    const c = String(row.contactId ?? "").trim();
    if (c) idSet.add(c);
  }
  const rawToCanonical = await mapContactIdsToCanonicalCommitmentKeys([
    ...idSet,
  ]);
  const uidsNeeded = new Set<string>();
  for (const row of rows) {
    const uid = resolveRosterAddedByUserId(
      row.contactId,
      rosterAddedByByContactKey,
      rawToCanonical,
    );
    if (uid) uidsNeeded.add(String(uid).toLowerCase());
  }
  const names = await resolveUserDisplayNamesByIds([...uidsNeeded]);
  return rows.map((row) => {
    const uid = resolveRosterAddedByUserId(
      row.contactId,
      rosterAddedByByContactKey,
      rawToCanonical,
    );
    const nk = uid ? String(uid).toLowerCase() : "";
    const display = nk && names.has(nk) ? names.get(nk)! : undefined;
    const patch: { addedByUserId?: string; addedByDisplayName?: string } = {};
    if (uid) patch.addedByUserId = uid;
    if (display) patch.addedByDisplayName = display;
    if (Object.keys(patch).length === 0) return row as T & { addedByUserId?: string };
    return { ...row, ...patch } as T & { addedByUserId?: string };
  });
}

export async function assertDealExists(dealId: string): Promise<boolean> {
  const rows = await db
    .select({ id: addDealForm.id })
    .from(addDealForm)
    .where(eq(addDealForm.id, dealId))
    .limit(1);
  return rows.length > 0;
}

export async function listDealInvestmentsByDealId(
  dealId: string,
  options?: { lpInvestorsOnly?: boolean },
): Promise<DealInvestmentRow[]> {
  const whereExpr =
    options?.lpInvestorsOnly === true
      ? and(
          eq(dealInvestment.dealId, dealId),
          inArray(dealInvestment.investor_role, [...LP_INVESTOR_ROLE_MATCH]),
        )
      : eq(dealInvestment.dealId, dealId);
  return db
    .select()
    .from(dealInvestment)
    .where(whereExpr)
    .orderBy(desc(dealInvestment.createdAt));
}

/** Sum of parsed commitment amounts for all investments on a deal (deals list / dashboard enrichment). */
export async function sumCommittedAmountForDeal(dealId: string): Promise<number> {
  const rows = await listDealInvestmentsByDealId(dealId);
  let s = 0;
  for (const r of rows) s += rowCommittedNumeric(r);
  return s;
}

export interface DealMemoryUploadFile {
  buffer: Buffer;
  originalname: string;
}

function sanitizeStem(originalName: string): string {
  const base = path.basename(originalName || "file");
  const stem = path.basename(base, path.extname(base));
  const cleaned = stem
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return cleaned.length ? cleaned : "file";
}

function safeExt(originalName: string): string {
  const ext = path.extname(path.basename(originalName || "")).toLowerCase();
  if (!ext || !/^\.[a-z0-9]{1,12}$/.test(ext)) return "";
  return ext;
}

export async function saveSubscriptionDocument(params: {
  dealId: string;
  file: DealMemoryUploadFile;
}): Promise<string> {
  const uploadRoot = path.join(
    getUploadsPhysicalRoot(),
    UPLOAD_SUBDIR,
    params.dealId,
  );
  await mkdir(uploadRoot, { recursive: true });
  const ts = Date.now();
  const name = `${sanitizeStem(params.file.originalname)}_${randomUUID()}_${ts}${safeExt(params.file.originalname)}`;
  const dest = path.join(uploadRoot, name);
  await writeFile(dest, params.file.buffer);
  return path.join(UPLOAD_SUBDIR, params.dealId, name).replace(/\\/g, "/");
}

export async function insertDealInvestment(params: {
  dealId: string;
  input: CreateDealInvestmentInput;
}): Promise<DealInvestmentRow> {
  const insertRow: DealInvestmentInsert = {
    dealId: params.dealId,
    offeringId: params.input.offeringId,
    contactId: params.input.contactId,
    contactDisplayName: params.input.contactDisplayName?.trim() ?? "",
    profileId: params.input.profileId,
    investor_role: params.input.investor_role,
    status: params.input.status,
    investorClass: params.input.investorClass,
    docSignedDate: params.input.docSignedDate ?? null,
    commitmentAmount: params.input.commitmentAmount,
    extraContributionAmounts: params.input.extraContributionAmounts ?? [],
    documentStoragePath: params.input.documentStoragePath ?? null,
  };
  const [row] = await db.insert(dealInvestment).values(insertRow).returning();
  if (!row) throw new Error("INSERT_FAILED");
  return row;
}

export async function getDealInvestmentById(
  dealId: string,
  investmentId: string,
): Promise<DealInvestmentRow | undefined> {
  const rows = await db
    .select()
    .from(dealInvestment)
    .where(
      and(
        eq(dealInvestment.dealId, dealId),
        eq(dealInvestment.id, investmentId),
      ),
    )
    .limit(1);
  return rows[0];
}

/**
 * Latest `deal_investment.commitment_amount` for `(deal_id, contact_id)` (newest `created_at`).
 * Returns `null` when no row exists or the stored amount is blank.
 */
export async function getLatestCommitmentAmountForDealContact(
  dealId: string,
  contactId: string,
): Promise<string | null> {
  const did = String(dealId ?? "").trim();
  const cid = String(contactId ?? "").trim();
  if (!did || !cid) return null;

  const [row] = await db
    .select({ commitmentAmount: dealInvestment.commitmentAmount })
    .from(dealInvestment)
    .where(
      and(eq(dealInvestment.dealId, did), eq(dealInvestment.contactId, cid)),
    )
    .orderBy(desc(dealInvestment.createdAt))
    .limit(1);

  if (!row) return null;
  const raw = row.commitmentAmount?.trim() ?? "";
  return raw === "" ? null : raw;
}

export async function updateDealInvestment(params: {
  dealId: string;
  investmentId: string;
  input: CreateDealInvestmentInput;
}): Promise<DealInvestmentRow | null> {
  const [row] = await db
    .update(dealInvestment)
    .set({
      offeringId: params.input.offeringId,
      contactId: params.input.contactId,
      contactDisplayName: params.input.contactDisplayName?.trim() ?? "",
      profileId: params.input.profileId,
      investor_role: params.input.investor_role,
      status: params.input.status,
      investorClass: params.input.investorClass,
      docSignedDate: params.input.docSignedDate ?? null,
      commitmentAmount: params.input.commitmentAmount,
      extraContributionAmounts: params.input.extraContributionAmounts ?? [],
      documentStoragePath: params.input.documentStoragePath ?? null,
    })
    .where(
      and(
        eq(dealInvestment.dealId, params.dealId),
        eq(dealInvestment.id, params.investmentId),
      ),
    )
    .returning();
  return row ?? null;
}

const DEAL_ID_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Number of `deal_investment` rows per deal (same cardinality as
 * `GET /deals/:dealId/investors` when each investment maps to one list row).
 */
export async function countInvestmentsByDealIds(
  dealIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  for (const id of dealIds) {
    map.set(id, 0);
  }
  const ids = [...new Set(dealIds.filter((id) => DEAL_ID_UUID_RE.test(id)))];
  if (ids.length === 0) return map;

  const res = await pool.query<{ deal_id: string; cnt: string }>(
    `SELECT deal_id::text, COUNT(*)::int AS cnt
     FROM deal_investment
     WHERE deal_id = ANY($1::uuid[])
     GROUP BY deal_id`,
    [ids],
  );
  for (const row of res.rows) {
    map.set(row.deal_id, Number(row.cnt));
  }
  return map;
}
