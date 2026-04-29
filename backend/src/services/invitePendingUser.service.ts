import { randomBytes } from "node:crypto";
import bcrypt from "bcrypt";
import { eq, sql } from "drizzle-orm";
import { db } from "../database/db.js";
import { users } from "../schema/schema.js";
import { markContactsAsPortalUserByEmailNorm } from "./contact.service.js";

const BCRYPT_ROUNDS = 10;

export type InviteCompanyContext = {
  companyId: string | null;
  companyName: string | null;
};

export type UpsertPendingInviteResult =
  | { ok: true }
  | { ok: false; status: number; message: string };

/**
 * Ensures a members-list row for an invited email: `user_signup_completed = false`
 * until the user finishes signup. Uses a random username and password hash until then.
 */
export async function upsertPendingInvitedUser(
  email: string,
  company: InviteCompanyContext,
  invitedRole: string,
  inviteExpiresAt: Date,
): Promise<UpsertPendingInviteResult> {
  const emailNorm = email.trim().toLowerCase();
  if (!emailNorm || !emailNorm.includes("@")) {
    return { ok: false, status: 400, message: "A valid email address is required" };
  }

  const [existing] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${emailNorm}`)
    .limit(1);

  if (existing) {
    const completed =
      String(existing.userSignupCompleted ?? "").trim().toLowerCase() === "true";
    if (completed) {
      const inviteOrg = company.companyId?.trim() ?? "";
      const memberOrg = existing.organizationId?.trim() ?? "";
      const sameOrg =
        inviteOrg !== "" && memberOrg !== "" && inviteOrg === memberOrg;
      if (sameOrg) {
        return {
          ok: false,
          status: 409,
          message:
            "This email is already a member of your organization.",
        };
      }
      return {
        ok: false,
        status: 409,
        message: "A user with this email already exists",
      };
    }

    const patch: {
      role: string;
      inviteExpiresAt: Date;
      updatedAt: Date;
      organizationId?: string | null;
    } = {
      role: invitedRole,
      inviteExpiresAt,
      updatedAt: new Date(),
    };
    if (company.companyId != null && company.companyId !== "") {
      patch.organizationId = company.companyId;
    }

    await db.update(users).set(patch).where(eq(users.id, existing.id));
    try {
      await markContactsAsPortalUserByEmailNorm(emailNorm);
    } catch (e) {
      console.error("markContactsAsPortalUserByEmailNorm after invite patch:", e);
    }
    return { ok: true };
  }

  const placeholderUsername = `invited_${randomBytes(12).toString("hex")}`;
  const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), BCRYPT_ROUNDS);

  await db.insert(users).values({
    email: emailNorm,
    username: placeholderUsername,
    passwordHash,
    role: invitedRole,
    userStatus: "active",
    userSignupCompleted: "false",
    organizationId: company.companyId ?? null,
    inviteExpiresAt,
  });

  try {
    await markContactsAsPortalUserByEmailNorm(emailNorm);
  } catch (e) {
    console.error("markContactsAsPortalUserByEmailNorm after pending invite insert:", e);
  }

  return { ok: true };
}
