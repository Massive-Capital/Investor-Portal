/**
 * Create or promote a platform administrator (run from backend folder).
 *
 * Usage:
 *   npx tsx src/scripts/seedPlatformAdmin.ts
 *   SEED_ADMIN_EMAIL=you@corp.com SEED_ADMIN_PASSWORD='YourPass1!' npx tsx src/scripts/seedPlatformAdmin.ts
 *
 * Env (optional):
 *   SEED_ADMIN_EMAIL    (default: platform.admin@example.com)
 *   SEED_ADMIN_PASSWORD (default: ChangeMe123!)
 *   SEED_ADMIN_USERNAME (default: platformadmin)
 *   SEED_ADMIN_FIRST    (default: Platform)
 *   SEED_ADMIN_LAST     (default: Admin)
 */
import { config } from "dotenv";
import bcrypt from "bcrypt";
import { eq, sql } from "drizzle-orm";
import { db, pool } from "../database/db.js";
import { users } from "../schema/schema.js";
import { PLATFORM_ADMIN } from "../constants/roles.js";

config({ path: ".env.local" });
config();

const BCRYPT_ROUNDS = 10;

const email = (process.env.SEED_ADMIN_EMAIL ?? "platform.admin@example.com")
  .trim()
  .toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";
const username = (process.env.SEED_ADMIN_USERNAME ?? "platformadmin").trim();
const firstName = (process.env.SEED_ADMIN_FIRST ?? "Platform").trim();
const lastName = (process.env.SEED_ADMIN_LAST ?? "Admin").trim();
const companyName = (process.env.SEED_ADMIN_COMPANY ?? "").trim();

async function main(): Promise<void> {
  if (!email.includes("@")) {
    console.error("SEED_ADMIN_EMAIL must be a valid email.");
    process.exitCode = 1;
    return;
  }
  if (password.length < 8) {
    console.error("SEED_ADMIN_PASSWORD must be at least 8 characters.");
    process.exitCode = 1;
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const [byEmail] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);

  if (byEmail) {
    await db
      .update(users)
      .set({
        passwordHash,
        role: PLATFORM_ADMIN,
        userStatus: "active",
        userSignupCompleted: "true",
        firstName,
        lastName,
        ...(companyName ? { companyName } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, byEmail.id));
    console.log(`Updated existing user to ${PLATFORM_ADMIN}: ${email}`);
    return;
  }

  const [byUsername] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.username}) = ${username.toLowerCase()}`)
    .limit(1);

  if (byUsername) {
    console.error(
      `Username "${username}" is already taken by another account. Set SEED_ADMIN_USERNAME.`,
    );
    process.exitCode = 1;
    return;
  }

  await db.insert(users).values({
    email,
    username,
    passwordHash,
    role: PLATFORM_ADMIN,
    userStatus: "active",
    userSignupCompleted: "true",
    firstName,
    lastName,
    companyName,
    phone: "",
  });

  console.log(`Created ${PLATFORM_ADMIN}: ${email} (username: ${username})`);
  console.log("Sign in with that email or username and the password you set.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    void pool.end();
  });
