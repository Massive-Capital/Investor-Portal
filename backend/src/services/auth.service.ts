import bcrypt from "bcrypt";
import jwt, { type SignOptions } from "jsonwebtoken";
import { eq, sql } from "drizzle-orm";
import { db } from "../database/db.js";
import { companies, users } from "../schema/schema.js";
import { getJwtExpiry, getJwtSecret } from "../config/auth.js";
import { isPlatformAdminRole } from "../constants/roles.js";

export type SigninSuccess = {
  ok: true;
  message: string;
  token: string;
  userDetails: Record<string, unknown>[];
};

export type SigninFailure = {
  ok: false;
  message: string;
};

export type SigninResult = SigninSuccess | SigninFailure;

/**
 * Same flow as legacy `userLogin`: email vs username lookup, status gates, bcrypt, JWT, userDetails.
 * Request body uses `email` in the original handler; here `rawEmailOrUsername` maps to `emailOrUsername` from the API.
 */
export async function signInWithPassword(
  rawEmailOrUsername: string,
  userPassword: string,
): Promise<SigninResult> {
  const input = (rawEmailOrUsername ?? "").toString().trim();
  if (!input) {
    return { ok: false, message: "Email or username is required" };
  }
  if (userPassword == null || userPassword === "") {
    return { ok: false, message: "Password is required" };
  }

  const isEmail = input.includes("@");
  const emailForLookup = isEmail ? input.toLowerCase() : null;
  const usernameLower = input.toLowerCase();

  try {
    const rows = await db
      .select({
        user: users,
      })
      .from(users)
      .where(
        isEmail
          ? eq(users.email, emailForLookup!)
          : sql`lower(${users.username}) = ${usernameLower}`,
      )
      .limit(1);
    const row = rows[0];
    if (!row) {
      return { ok: false, message: "User not found" };
    }
    const user_table = row.user;

    if (!user_table.passwordHash || user_table.passwordHash.trim() === "") {
      return { ok: false, message: "User not found" };
    }

    const user = await db
      .select()
      .from(users)
      .where(
        isEmail
          ? eq(users.email, emailForLookup!)
          : sql`lower(${users.username}) = ${usernameLower}`,
      )
      .limit(1);
    const usertable = user[0];
    if (!usertable) {
      return { ok: false, message: "User not found" };
    }

    const passwordMatch = await bcrypt.compare(
      userPassword,
      user_table.passwordHash,
    );
    if (!passwordMatch) {
      return { ok: false, message: "Password is mismatched" };
    }

    const signupCompleted = String(usertable.userSignupCompleted ?? "")
      .trim()
      .toLowerCase();
    if (signupCompleted !== "true") {
      return {
        ok: false,
        message:
          "Your account setup is not complete. Finish registration before signing in.",
      };
    }

    const userStatus = String(usertable.userStatus ?? "").trim().toLowerCase();
    if (userStatus === "inactive" || userStatus === "suspended") {
      return {
        ok: false,
        message:
          "Your account is inactive. You cannot sign in. Contact your administrator.",
      };
    }
    if (userStatus !== "active") {
      return {
        ok: false,
        message:
          "Your account is not active. You cannot sign in. Contact your administrator.",
      };
    }

    const orgId = usertable.organizationId;
    const role = String(usertable.role ?? "").trim();
    if (orgId && !isPlatformAdminRole(role)) {
      const [co] = await db
        .select({ status: companies.status })
        .from(companies)
        .where(eq(companies.id, orgId))
        .limit(1);
      const coStatus = String(co?.status ?? "").trim().toLowerCase();
      if (!co || coStatus !== "active") {
        return {
          ok: false,
          message:
            "Your organization is not active. You cannot sign in until it is reactivated. Contact your administrator.",
        };
      }
    }

    const secret = getJwtSecret();
    const token = jwt.sign(
      {
        id: user_table.id,
        email: user_table.email,
        userRole: user_table.role,
      },
      secret,
      { expiresIn: getJwtExpiry() } as SignOptions,
    );

    const { passwordHash: _pw, ...userWithoutSecret } = user_table;
    const userDetails = [
      {
        ...userWithoutSecret,
        organization_name: "",
        organization_id: user_table.organizationId ?? null,
      },
    ];

    return {
      ok: true,
      message: "User Login Successful",
      token,
      userDetails,
    };
  } catch (error) {
    console.error("Login error:", error);
    return {
      ok: false,
      message: "An error occurred during login. Please try again.",
    };
  }
}
