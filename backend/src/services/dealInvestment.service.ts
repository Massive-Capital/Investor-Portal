import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { and, desc, eq, inArray } from "drizzle-orm";
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

/**
 * Resolve portal user ids (e.g. `deal_member.added_by`) to the same display
 * string used elsewhere for members (name / company / username).
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
    m.set(key, formatMemberDisplayFromUser(u));
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
  if (nums.length === 0) return commitmentAmount.trim() || "—";
  const sum = nums.reduce((a, b) => a + b, 0);
  if (sum === 0) return "—";
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

export async function mapDealInvestmentsToInvestorApi(
  rows: DealInvestmentRow[],
): Promise<ReturnType<typeof mapRowToInvestorApi>[]> {
  const resolved = await resolveUsersByContactIds(rows);
  return rows.map((r) => mapRowToInvestorApi(r, resolved));
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
