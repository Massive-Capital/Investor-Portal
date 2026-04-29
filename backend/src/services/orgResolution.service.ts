import { eq } from "drizzle-orm";
import { db } from "../database/db.js";
import { users } from "../schema/auth.schema/signin.js";

export interface UserOrgResolutionFields {
  organizationId: string | null;
  role: string | null;
}

/**
 * `users.organization_id` — company directory scope for the user.
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
          role: users.role,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
    )[0];
  if (!row) return null;
  return row.organizationId ?? null;
}
