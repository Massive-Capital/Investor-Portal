import { and, desc, eq, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import { isPlatformAdminRole } from "../constants/roles.js";
import { db } from "../database/db.js";
import { users } from "../schema/auth.schema/signin.js";
import { resolveDealViewerScope } from "./dealAccess.service.js";
import { companies } from "../schema/schema.js";
import {
  contact,
  type ContactInsert,
  type ContactRow,
} from "../schema/contact.schema.js";

/** First + last name, else email, else username — for CRM "owner" display */
export async function getUserDisplayNameById(
  userId: string,
): Promise<string> {
  const [u] = await db
    .select({
      email: users.email,
      username: users.username,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!u) return "";
  const fn = u.firstName?.trim() ?? "";
  const ln = u.lastName?.trim() ?? "";
  const full = [fn, ln].filter(Boolean).join(" ");
  if (full) return full;
  return u.email?.trim() || u.username?.trim() || "";
}

/** Exporter profile for members export audit emails (user admin). */
export async function getUserContactsExportAuditFields(
  userId: string,
): Promise<{ email: string; displayName: string; orgName: string }> {
  const rows = await db
    .select({
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      companyName: users.companyName,
      orgName: companies.name,
    })
    .from(users)
    .leftJoin(companies, eq(users.organizationId, companies.id))
    .where(eq(users.id, userId))
    .limit(1);
  const r = rows[0];
  if (!r) {
    return { email: "", displayName: "", orgName: "" };
  }
  const display =
    [r.firstName, r.lastName].filter(Boolean).join(" ").trim() || r.email;
  const org = r.companyName?.trim() || r.orgName?.trim() || "";
  return { email: r.email, displayName: display, orgName: org };
}

export type CreateContactInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  note: string;
  tags: string[];
  lists: string[];
  owners: string[];
};

/** Thrown when another contact in the same company scope already uses this email or phone. */
export class ContactScopeConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContactScopeConflictError";
  }
}

async function userIdsInOrganization(organizationId: string): Promise<string[]> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.organizationId, organizationId));
  return rows.map((r) => r.id);
}

function normalizeContactEmailForScope(e: string): string {
  return e.trim().toLowerCase();
}

function normalizeContactPhoneDigits(p: string): string {
  return String(p ?? "").replace(/\D/g, "");
}

/**
 * Contacts are scoped by the **creator’s** organization: all contacts whose
 * `created_by` is a user in that org share one pool for unique email / phone.
 * Creators with no `organization_id` (platform admin) use a global pool.
 */
async function assertContactEmailPhoneUniqueForCreatorScope(params: {
  creatorUserId: string;
  email: string;
  phone: string;
  excludeContactId?: string;
}): Promise<void> {
  const emailNorm = normalizeContactEmailForScope(params.email);
  const phoneDigits = normalizeContactPhoneDigits(params.phone);

  const [creator] = await db
    .select({ organizationId: users.organizationId })
    .from(users)
    .where(eq(users.id, params.creatorUserId))
    .limit(1);
  const orgId = creator?.organizationId ?? null;

  let scopePredicate: SQL;
  if (!orgId) {
    scopePredicate = sql`true`;
  } else {
    const memberIds = await userIdsInOrganization(orgId);
    if (memberIds.length === 0) {
      scopePredicate = sql`false`;
    } else {
      scopePredicate = inArray(contact.createdBy, memberIds);
    }
  }

  const emailMatch = sql`lower(trim(${contact.email})) = ${emailNorm}`;
  const phoneMatch =
    phoneDigits.length > 0
      ? sql`regexp_replace(${contact.phone}, '[^0-9]', '', 'g') = ${phoneDigits}`
      : sql`false`;

  const conflictClause = or(emailMatch, phoneMatch);
  if (!conflictClause) {
    throw new Error("CONTACT_SCOPE_BUILD_FAILED");
  }
  const parts: SQL[] = [scopePredicate, conflictClause];
  if (params.excludeContactId)
    parts.push(ne(contact.id, params.excludeContactId));

  const dup = await db
    .select({ id: contact.id })
    .from(contact)
    .where(and(...parts))
    .limit(1);

  if (dup[0]) {
    throw new ContactScopeConflictError(
      "A contact in your company already uses this email or phone number.",
    );
  }
}

export async function insertContact(params: {
  input: CreateContactInput;
  createdByUserId: string;
}): Promise<ContactRow> {
  await assertContactEmailPhoneUniqueForCreatorScope({
    creatorUserId: params.createdByUserId,
    email: params.input.email,
    phone: params.input.phone,
  });

  const row: ContactInsert = {
    firstName: params.input.firstName,
    lastName: params.input.lastName,
    email: params.input.email,
    phone: params.input.phone,
    note: params.input.note,
    tags: params.input.tags,
    lists: params.input.lists,
    owners: params.input.owners,
    status: "active",
    createdBy: params.createdByUserId,
  };
  const [inserted] = await db.insert(contact).values(row).returning();
  if (!inserted) throw new Error("INSERT_CONTACT_FAILED");
  return inserted;
}

export async function listContacts(): Promise<ContactRow[]> {
  return db
    .select()
    .from(contact)
    .orderBy(desc(contact.createdAt));
}

/**
 * Contacts visible to this viewer: platform admin → all contacts; otherwise same
 * as CRM list — rows created by any user in the viewer's organization. If the
 * viewer has no `organization_id`, only rows they created themselves.
 *
 * `COUNT(*)` from `deal_investment` where `trim(contact_id)` matches each CRM
 * contact id, scoped to deals visible to this viewer.
 */
export async function countDealInvestmentsByContactIdForViewer(params: {
  viewerUserId: string;
  jwtUserRole: string | undefined;
  contactIds: string[];
}): Promise<Map<string, number>> {
  const scope = await resolveDealViewerScope(
    params.viewerUserId,
    params.jwtUserRole,
  );
  const keys = [
    ...new Set(
      params.contactIds.map((id) => id.trim().toLowerCase()).filter(Boolean),
    ),
  ];
  const result = new Map<string, number>();
  for (const k of keys) result.set(k, 0);
  if (keys.length === 0) return result;

  const dealScopeSql = scope.isPlatformAdmin
    ? sql`true`
    : scope.organizationId
      ? sql`(
          af.organization_id = ${scope.organizationId}
          OR (
            af.organization_id IS NULL
            AND lower(trim(af.owning_entity_name)) = (
              SELECT lower(trim(${companies.name}))
              FROM ${companies}
              WHERE ${companies.id} = ${scope.organizationId}
              LIMIT 1
            )
          )
        )`
      : sql`false`;

  const idParams = sql.join(keys.map((k) => sql`${k}`), sql`, `);

  const executed = await db.execute(sql`
    SELECT lower(trim(di.contact_id)) AS cid, COUNT(*)::int AS cnt
    FROM deal_investment di
    INNER JOIN add_deal_form af ON af.id = di.deal_id
    WHERE lower(trim(di.contact_id)) IN (${idParams})
      AND (${dealScopeSql})
    GROUP BY lower(trim(di.contact_id))
  `);

  const raw = executed as unknown as
    | { rows?: unknown[] }
    | unknown[];
  const list = Array.isArray(raw) ? raw : (raw.rows ?? []);
  for (const row of list) {
    if (row == null || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const cid = String(r.cid ?? r.CID ?? "").trim().toLowerCase();
    const n = Number(r.cnt ?? r.CNT);
    if (cid) result.set(cid, Number.isFinite(n) ? n : 0);
  }
  return result;
}

export async function listContactsForViewer(
  viewerUserId: string,
  viewerRole?: string | null,
): Promise<ContactRow[]> {
  if (isPlatformAdminRole(viewerRole)) return listContacts();

  const [viewer] = await db
    .select({ organizationId: users.organizationId })
    .from(users)
    .where(eq(users.id, viewerUserId))
    .limit(1);
  const orgId = viewer?.organizationId ?? null;

  if (!orgId) {
    return db
      .select()
      .from(contact)
      .where(eq(contact.createdBy, viewerUserId))
      .orderBy(desc(contact.createdAt));
  }

  const memberRows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.organizationId, orgId));
  const ids = memberRows.map((r) => r.id).filter(Boolean);
  if (ids.length === 0) {
    return db
      .select()
      .from(contact)
      .where(eq(contact.createdBy, viewerUserId))
      .orderBy(desc(contact.createdAt));
  }

  return db
    .select()
    .from(contact)
    .where(inArray(contact.createdBy, ids))
    .orderBy(desc(contact.createdAt));
}

export async function getContactById(
  contactId: string,
): Promise<ContactRow | undefined> {
  const [row] = await db
    .select()
    .from(contact)
    .where(eq(contact.id, contactId))
    .limit(1);
  return row;
}

async function viewerCanAccessContactCreator(
  viewerUserId: string,
  createdByUserId: string,
  viewerRole?: string | null,
): Promise<boolean> {
  if (isPlatformAdminRole(viewerRole)) return true;
  if (viewerUserId === createdByUserId) return true;
  const [viewer] = await db
    .select({ organizationId: users.organizationId })
    .from(users)
    .where(eq(users.id, viewerUserId))
    .limit(1);
  const orgId = viewer?.organizationId;
  if (!orgId) return false;
  const [creator] = await db
    .select({ organizationId: users.organizationId })
    .from(users)
    .where(eq(users.id, createdByUserId))
    .limit(1);
  return creator?.organizationId === orgId;
}

export type UpdateContactFieldsInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  note: string;
  tags: string[];
  lists: string[];
  owners: string[];
  lastEditReason: string;
};

export async function updateContactFieldsForViewer(
  viewerUserId: string,
  contactId: string,
  fields: UpdateContactFieldsInput,
  viewerRole?: string | null,
): Promise<ContactRow | null> {
  const row = await getContactById(contactId);
  if (!row) return null;
  if (
    !(await viewerCanAccessContactCreator(
      viewerUserId,
      row.createdBy,
      viewerRole,
    ))
  )
    return null;

  await assertContactEmailPhoneUniqueForCreatorScope({
    creatorUserId: row.createdBy,
    email: fields.email,
    phone: fields.phone,
    excludeContactId: contactId,
  });

  const [updated] = await db
    .update(contact)
    .set({
      firstName: fields.firstName,
      lastName: fields.lastName,
      email: fields.email,
      phone: fields.phone,
      note: fields.note,
      tags: fields.tags,
      lists: fields.lists,
      owners: fields.owners,
      lastEditReason: fields.lastEditReason || null,
    })
    .where(eq(contact.id, contactId))
    .returning();
  return updated ?? null;
}

export async function patchContactStatusForViewer(
  viewerUserId: string,
  contactId: string,
  status: "active" | "suspended",
  viewerRole?: string | null,
): Promise<ContactRow | null> {
  const row = await getContactById(contactId);
  if (!row) return null;
  if (
    !(await viewerCanAccessContactCreator(
      viewerUserId,
      row.createdBy,
      viewerRole,
    ))
  )
    return null;
  const [updated] = await db
    .update(contact)
    .set({ status })
    .where(eq(contact.id, contactId))
    .returning();
  return updated ?? null;
}
