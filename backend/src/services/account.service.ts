import bcrypt from "bcrypt";
import { eq, getTableColumns } from "drizzle-orm";
import { db } from "../database/db.js";
import { companies, users, type UserRow } from "../schema/schema.js";
import { enrichUserRecordForDealParticipant } from "./dealParticipantProfile.service.js";
import { mergeLpInvestorFlagsIntoUserPayload } from "./lpInvestorAccess.service.js";
import { serializeUserForClient } from "./userAdmin.service.js";

const BCRYPT_ROUNDS = 10;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 16;

function userDetailsShape(u: Record<string, unknown>): Record<string, unknown> {
  return {
    ...u,
    organization_name: "",
  };
}

async function userDetailsShapeWithDealParticipant(
  u: Record<string, unknown>,
  userId: string,
): Promise<Record<string, unknown>> {
  const base = userDetailsShape(u);
  const enriched = await enrichUserRecordForDealParticipant(base, userId);
  return mergeLpInvestorFlagsIntoUserPayload(enriched, {
    email: u.email as string | undefined,
    portalRole: u.role as string | undefined,
  });
}

export async function changePasswordForUser(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<
  | { ok: true; user: Record<string, unknown> }
  | { ok: false; status: number; message: string }
> {
  if (!currentPassword || !newPassword) {
    return {
      ok: false,
      status: 400,
      message: "Current password and new password are required",
    };
  }
  if (newPassword.length < PASSWORD_MIN || newPassword.length > PASSWORD_MAX) {
    return {
      ok: false,
      status: 400,
      message: `New password must be between ${PASSWORD_MIN} and ${PASSWORD_MAX} characters`,
    };
  }
  if (currentPassword === newPassword) {
    return {
      ok: false,
      status: 400,
      message: "New password must be different from your current password",
    };
  }

  let row: UserRow | undefined;
  try {
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    row = rows[0] as UserRow | undefined;
  } catch (err) {
    console.error("changePasswordForUser: load user failed", err);
    return {
      ok: false,
      status: 500,
      message: "Could not load your account. Please try again.",
    };
  }
  if (!row) {
    return { ok: false, status: 404, message: "User not found" };
  }

  let match = false;
  try {
    match = await bcrypt.compare(currentPassword, row.passwordHash);
  } catch (err) {
    console.error("changePasswordForUser: bcrypt.compare failed", err);
    return {
      ok: false,
      status: 400,
      message:
        "Could not verify your current password. If this continues, contact support.",
    };
  }
  if (!match) {
    return { ok: false, status: 400, message: "Current password is incorrect" };
  }

  let passwordHash: string;
  try {
    passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  } catch (err) {
    console.error("changePasswordForUser: bcrypt.hash failed", err);
    return {
      ok: false,
      status: 500,
      message: "Could not process the new password. Please try again.",
    };
  }

  try {
    await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, userId));
  } catch (err) {
    console.error("changePasswordForUser: update failed", err);
    return {
      ok: false,
      status: 500,
      message: "Could not save your new password. Please try again.",
    };
  }

  type UserWithOrgName = UserRow & { orgName: string | null };
  let withOrg: UserWithOrgName | undefined;
  try {
    const rows = await db
      .select({
        ...getTableColumns(users),
        orgName: companies.name,
      })
      .from(users)
      .leftJoin(companies, eq(users.organizationId, companies.id))
      .where(eq(users.id, userId))
      .limit(1);
    withOrg = rows[0] as UserWithOrgName | undefined;
  } catch (err) {
    console.error("changePasswordForUser: reload user failed", err);
    return {
      ok: false,
      status: 500,
      message: "Password was updated but we could not reload your profile.",
    };
  }
  if (!withOrg) {
    return { ok: false, status: 500, message: "Could not update password" };
  }
  const { orgName, ...updated } = withOrg;
  return {
    ok: true,
    user: await userDetailsShapeWithDealParticipant(
      serializeUserForClient(updated as UserRow, orgName),
      userId,
    ),
  };
}

export type OwnProfilePatch = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  companyName?: string;
};

/** Current user profile for GET /auth/me (same shape as successful PATCH). */
export async function getOwnProfile(
  userId: string,
): Promise<
  | { ok: true; user: Record<string, unknown> }
  | { ok: false; status: number; message: string }
> {
  const [r] = await db
    .select({
      ...getTableColumns(users),
      orgName: companies.name,
    })
    .from(users)
    .leftJoin(companies, eq(users.organizationId, companies.id))
    .where(eq(users.id, userId))
    .limit(1);
  if (!r) {
    return { ok: false, status: 404, message: "User not found" };
  }
  const { orgName, ...row } = r;
  return {
    ok: true,
    user: await userDetailsShapeWithDealParticipant(
      serializeUserForClient(row as UserRow, orgName),
      userId,
    ),
  };
}

export async function updateOwnProfile(
  userId: string,
  patch: OwnProfilePatch,
): Promise<
  | { ok: true; user: Record<string, unknown> }
  | { ok: false; status: number; message: string }
> {
  const hasFirst = patch.firstName !== undefined;
  const hasLast = patch.lastName !== undefined;
  const hasPhone = patch.phone !== undefined;
  const hasCompany = patch.companyName !== undefined;
  if (!hasFirst && !hasLast && !hasPhone && !hasCompany) {
    return { ok: false, status: 400, message: "No profile fields to update" };
  }

  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!row) {
    return { ok: false, status: 404, message: "User not found" };
  }

  if (hasCompany) {
    if (!row.organizationId) {
      return {
        ok: false,
        status: 400,
        message: "No organization to update",
      };
    }
    const name = (patch.companyName ?? "").trim();
    if (!name) {
      return { ok: false, status: 400, message: "Company name is required" };
    }
    await db
      .update(companies)
      .set({ name, updatedAt: new Date() })
      .where(eq(companies.id, row.organizationId));
  }

  const hasUserFieldUpdates = hasFirst || hasLast || hasPhone;
  if (hasUserFieldUpdates) {
    const setObj: {
      updatedAt: Date;
      firstName?: string;
      lastName?: string;
      phone?: string;
    } = { updatedAt: new Date() };
    if (hasFirst) setObj.firstName = patch.firstName ?? "";
    if (hasLast) setObj.lastName = patch.lastName ?? "";
    if (hasPhone) setObj.phone = patch.phone ?? "";
    await db.update(users).set(setObj).where(eq(users.id, userId));
  }

  const [updated] = await db
    .select({
      ...getTableColumns(users),
      orgName: companies.name,
    })
    .from(users)
    .leftJoin(companies, eq(users.organizationId, companies.id))
    .where(eq(users.id, userId))
    .limit(1);
  if (!updated) {
    return { ok: false, status: 500, message: "Could not update profile" };
  }
  const { orgName, ...u } = updated;
  return {
    ok: true,
    user: await userDetailsShapeWithDealParticipant(
      serializeUserForClient(u as UserRow, orgName),
      userId,
    ),
  };
}
