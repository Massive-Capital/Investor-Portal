import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "../database/db.js";
import { users } from "../schema/schema.js";
import { getJwtSecret } from "../config/auth.js";
import {
  COMPANY_ADMIN,
  COMPANY_USER,
  DEAL_PARTICIPANT,
  isInviteAssignableRole,
  PLATFORM_USER,
} from "../constants/roles.js";
import { ensureCompanyByName } from "./company.service.js";
import { reconcileAssigningDealUsersForDeal } from "./assigningDealUser.service.js";
import { markContactsAsPortalUserByEmailNorm } from "./contact.service.js";
import { getAddDealFormById } from "./dealForm.service.js";

const BCRYPT_ROUNDS = 10;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 16;
const PHONE_MIN_DIGITS = 7;
const PHONE_MAX_DIGITS = 15;

export type SignupBody = {
  email?: unknown;
  companyName?: unknown;
  userName?: unknown;
  phone?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  newPassword?: unknown;
  confirmPassword?: unknown;
};

export type SignupResult =
  | { ok: true; message: string }
  | { ok: false; status: number; message: string };

type InvitePayload = {
  email?: string;
  exp?: number;
  companyName?: string;
  companyId?: string;
  invitedRole?: string;
  typ?: string;
  dealId?: string;
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Same phone may not be shared by two members (including pending) in one organization. */
async function assertPhoneUniqueInOrganization(params: {
  organizationId: string | undefined;
  phoneDigits: string;
  excludeUserId?: string;
}): Promise<SignupResult | null> {
  const { organizationId, phoneDigits, excludeUserId } = params;
  if (!organizationId || !phoneDigits) return null;

  const parts = [
    eq(users.organizationId, organizationId),
    eq(users.phone, phoneDigits),
  ];
  if (excludeUserId) parts.push(ne(users.id, excludeUserId));

  const [hit] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(...parts))
    .limit(1);

  if (hit) {
    return {
      ok: false,
      status: 409,
      message:
        "This phone number is already used by another member in this organization. Use a different number.",
    };
  }
  return null;
}

export async function registerUser(
  inviteToken: string | undefined,
  body: SignupBody,
): Promise<SignupResult> {
  const userName = str(body.userName);
  let companyName = str(body.companyName);
  const phone = str(body.phone);
  const firstName = str(body.firstName);
  const lastName = str(body.lastName);
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  const confirmPassword =
    typeof body.confirmPassword === "string" ? body.confirmPassword : "";

  if (!userName || !companyName || !phone || !firstName || !lastName) {
    return {
      ok: false,
      status: 400,
      message:
        "Company name, user name, phone, first name, and last name are required",
    };
  }

  if (!/^\d+$/.test(phone)) {
    return {
      ok: false,
      status: 400,
      message: "Phone number must contain only digits (no spaces or symbols)",
    };
  }
  if (phone.length < PHONE_MIN_DIGITS || phone.length > PHONE_MAX_DIGITS) {
    return {
      ok: false,
      status: 400,
      message: `Phone number must be between ${PHONE_MIN_DIGITS} and ${PHONE_MAX_DIGITS} digits`,
    };
  }

  if (!newPassword || !confirmPassword) {
    return {
      ok: false,
      status: 400,
      message: "Password and confirm password are required",
    };
  }

  if (newPassword !== confirmPassword) {
    return {
      ok: false,
      status: 400,
      message: "Passwords do not match",
    };
  }

  if (newPassword.length < PASSWORD_MIN || newPassword.length > PASSWORD_MAX) {
    return {
      ok: false,
      status: 400,
      message: `Password must be between ${PASSWORD_MIN} and ${PASSWORD_MAX} characters`,
    };
  }

  let email: string;
  let organizationIdFromInvite: string | undefined;
  let invitedRoleFromToken: string | undefined;
  let isDealMemberInvite = false;
  let dealInviteDealId: string | undefined;
  if (inviteToken && inviteToken.trim() !== "") {
    try {
      const payload = jwt.verify(inviteToken.trim(), getJwtSecret()) as InvitePayload;
      const fromToken = (payload.email ?? "").toString().trim().toLowerCase();
      if (!fromToken) {
        return {
          ok: false,
          status: 401,
          message: "Invalid invite: email missing from token",
        };
      }
      email = fromToken;

      if (String(payload.typ ?? "") === "deal_member_invite") {
        isDealMemberInvite = true;
        const dealId = str(payload.dealId);
        if (!dealId) {
          return {
            ok: false,
            status: 401,
            message: "Invalid invite: deal missing from token",
          };
        }
        const deal = await getAddDealFormById(dealId);
        if (!deal) {
          return {
            ok: false,
            status: 400,
            message: "Invalid invite: deal not found",
          };
        }
        const tokenCompanyId =
          typeof payload.companyId === "string" ? payload.companyId.trim() : "";
        const dealOrg = deal.organizationId?.trim() ?? "";
        if (!dealOrg || dealOrg !== tokenCompanyId) {
          return {
            ok: false,
            status: 401,
            message: "Invite link is invalid or has expired",
          };
        }
        const fromInviteCompany = str(payload.companyName);
        if (fromInviteCompany) {
          companyName = fromInviteCompany;
        }
        organizationIdFromInvite = dealOrg;
        dealInviteDealId = dealId;
      } else {
        const fromInviteCompany = str(payload.companyName);
        if (fromInviteCompany) {
          companyName = fromInviteCompany;
        }
        const cid = typeof payload.companyId === "string" ? payload.companyId.trim() : "";
        if (cid) organizationIdFromInvite = cid;
        const ir =
          typeof payload.invitedRole === "string" ? payload.invitedRole.trim() : "";
        if (ir && isInviteAssignableRole(ir)) {
          invitedRoleFromToken = ir;
        }
      }
    } catch {
      return {
        ok: false,
        status: 401,
        message: "Invite link is invalid or has expired",
      };
    }
  } else {
    email = str(body.email).toLowerCase();
    if (!email || !email.includes("@")) {
      return {
        ok: false,
        status: 400,
        message: "A valid email is required when signing up without an invite link",
      };
    }
  }

  const emailNorm = email.toLowerCase();
  /** Case-insensitive uniqueness only; stored username keeps user-provided casing. */
  const userNameLower = userName.toLowerCase();

  try {
    const [existingByEmail] = await db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${emailNorm}`)
      .limit(1);

    if (existingByEmail) {
      const completed =
        String(existingByEmail.userSignupCompleted ?? "").trim().toLowerCase() ===
        "true";
      if (completed) {
        return {
          ok: false,
          status: 409,
          message: "An account with this email already exists",
        };
      }
      if (!inviteToken?.trim()) {
        return {
          ok: false,
          status: 409,
          message:
            "This email has a pending invitation. Use the link in your invitation email to complete signup.",
        };
      }
    }

    const pendingId = existingByEmail?.id;
    const [existingUsername] = await db
      .select({ id: users.id })
      .from(users)
      .where(
        pendingId
          ? and(
              sql`lower(${users.username}) = ${userNameLower}`,
              ne(users.id, pendingId),
            )
          : sql`lower(${users.username}) = ${userNameLower}`,
      )
      .limit(1);

    if (existingUsername) {
      return {
        ok: false,
        status: 409,
        message: "This user name is already taken",
      };
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    let organizationId: string | undefined = organizationIdFromInvite;
    let roleForUser: string = PLATFORM_USER;
    const applyInviteRole =
      Boolean(inviteToken?.trim()) &&
      invitedRoleFromToken != null &&
      !isDealMemberInvite;

    if (isDealMemberInvite) {
      roleForUser = DEAL_PARTICIPANT;
    } else if (!organizationId) {
      const companyResult = await ensureCompanyByName(companyName);
      if (!companyResult.ok) {
        return {
          ok: false,
          status: companyResult.status,
          message: companyResult.message,
        };
      }
      organizationId = companyResult.company.id;
      if (applyInviteRole) {
        roleForUser = invitedRoleFromToken!;
      } else if (companyResult.created) {
        roleForUser = COMPANY_ADMIN;
      } else {
        roleForUser = COMPANY_USER;
      }
    } else if (applyInviteRole) {
      roleForUser = invitedRoleFromToken!;
    }

    const phoneDup = await assertPhoneUniqueInOrganization({
      organizationId,
      phoneDigits: phone,
      excludeUserId: pendingId,
    });
    if (phoneDup) return phoneDup;

    let createdUserId: string | undefined;

    if (pendingId && existingByEmail) {
      const orgToSet =
        organizationId ?? existingByEmail.organizationId ?? undefined;
      await db
        .update(users)
        .set({
          username: userName,
          passwordHash,
          firstName,
          lastName,
          phone,
          role: roleForUser,
          userStatus: "active",
          userSignupCompleted: "true",
          inviteExpiresAt: null,
          updatedAt: new Date(),
          ...(orgToSet ? { organizationId: orgToSet } : {}),
        })
        .where(eq(users.id, pendingId));
      createdUserId = pendingId;
    } else {
      const [inserted] = await db
        .insert(users)
        .values({
          email: emailNorm,
          username: userName,
          passwordHash,
          firstName,
          lastName,
          phone,
          role: roleForUser,
          userStatus: "active",
          userSignupCompleted: "true",
          ...(organizationId ? { organizationId } : {}),
        })
        .returning({ id: users.id });
      createdUserId = inserted?.id;
    }

    try {
      await markContactsAsPortalUserByEmailNorm(emailNorm);
    } catch (e) {
      console.error("markContactsAsPortalUserByEmailNorm after signup:", e);
    }

    const uidForReconcile = pendingId ?? createdUserId;
    if (dealInviteDealId && uidForReconcile) {
      try {
        await reconcileAssigningDealUsersForDeal(dealInviteDealId, uidForReconcile);
      } catch (e) {
        console.error("reconcileAssigningDealUsersForDeal after deal-invite signup:", e);
      }
    }

    return {
      ok: true,
      message: "Account created successfully",
    };
  } catch (err: unknown) {
    const pg =
      err && typeof err === "object" && "code" in err
        ? (err as { code?: string; message?: string; detail?: string })
        : {};
    const code = pg.code ?? "";
    if (code === "23505") {
      return {
        ok: false,
        status: 409,
        message:
          "This email or user name is already registered. Use a different email or user name.",
      };
    }
    if (code === "42703") {
      console.error("Signup error: missing DB column — run server once to migrate:", err);
      return {
        ok: false,
        status: 503,
        message:
          "Database needs a quick update. Restart the backend server and try again.",
      };
    }
    console.error("Signup error:", err);
    return {
      ok: false,
      status: 500,
      message: "Could not create account. Please try again.",
    };
  }
}
