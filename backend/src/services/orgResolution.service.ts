import { eq, sql } from "drizzle-orm";
import {
  COMPANY_USER,
  isCompanyAdminRole,
  PLATFORM_USER,
} from "../constants/roles.js";
import { db } from "../database/db.js";
import { users } from "../schema/auth.schema/signin.js";
import { companies } from "../schema/schema.js";

export interface UserOrgResolutionFields {
  organizationId: string | null
  companyName: string | null
  role: string | null
}

async function resolveCompanyIdFromUserCompanyName(
  companyName: string | null | undefined,
): Promise<string | null> {
  const cn = String(companyName ?? "").trim();
  if (!cn) return null;
  const norm = cn.toLowerCase();
  const [co] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(sql`lower(trim(${companies.name})) = ${norm}`)
    .limit(1);
  return co?.id ?? null;
}

/**
 * `users.organization_id`, with `company_name` → `companies` when unset for roles that
 * participate in a company directory: company_admin, company_user, and platform_user
 * (portal users often have `company_name` before `organization_id` is backfilled).
 * Pass `preloaded` when you already loaded org fields for `userId` to avoid a second query.
 */
export async function resolveOrganizationIdForUserId(
  userId: string,
  preloaded?: UserOrgResolutionFields | null,
): Promise<string | null> {
  const row =
    preloaded ??
    (
      await db
        .select({
          organizationId: users.organizationId,
          companyName: users.companyName,
          role: users.role,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
    )[0];
  if (!row) return null;
  let orgId = row.organizationId ?? null;
  const role = String(row.role ?? "").trim();
  if (
    !orgId &&
    (isCompanyAdminRole(role) ||
      role === COMPANY_USER ||
      role === PLATFORM_USER)
  ) {
    orgId = await resolveCompanyIdFromUserCompanyName(row.companyName);
  }

  return orgId;
}
