// backend/src/database/db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../schema/schema.js";

// Create the postgresql client
const DATABASE_USER = process.env.DATABASE_USER ?? "postgres";
const DATABASE_PASSWORD = process.env.DATABASE_PASSWORD ?? "Postgresql123";
const DATABASE_HOST = process.env.DATABASE_HOST ?? "localhost";
const DATABASE_PORT = process.env.DATABASE_PORT ?? "5432";
const DATABASE_NAME = process.env.DATABASE_NAME ?? "investor_portal_db";

const DATABASE_URI = `postgresql://${DATABASE_USER}:${DATABASE_PASSWORD}@${DATABASE_HOST}:${DATABASE_PORT}/${DATABASE_NAME}`;

const pool = new Pool({
  // Connection String
  connectionString: DATABASE_URI,
  // user: process.env.DATABASE_USER,
  // password: process.env.DATABASE_PASSWORD,
  // host: process.env.DATABASE_HOST,
  // port: Number(process.env.DATABASE_PORT),
  // database: process.env.DATABASE_NAME,
});

// Create Drizzle ORM instance
export const db = drizzle({ client: pool, schema });
export { pool };

async function ensureTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) NOT NULL UNIQUE,
      username VARCHAR(100) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'platform_user',
      user_status VARCHAR(50) NOT NULL DEFAULT 'active',
      user_signup_completed VARCHAR(10) NOT NULL DEFAULT 'true',
      organization_id UUID,
      first_name VARCHAR(100) NOT NULL DEFAULT '',
      last_name VARCHAR(100) NOT NULL DEFAULT '',
      company_name VARCHAR(255) NOT NULL DEFAULT '',
      phone VARCHAR(32) NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  for (const stmt of [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) NOT NULL DEFAULT 'platform_user'`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS user_status VARCHAR(50) NOT NULL DEFAULT 'active'`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS user_signup_completed VARCHAR(10) NOT NULL DEFAULT 'true'`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id UUID`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100) NOT NULL DEFAULT ''`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100) NOT NULL DEFAULT ''`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS company_name VARCHAR(255) NOT NULL DEFAULT ''`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(32) NOT NULL DEFAULT ''`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ`,
  ]) {
    await pool.query(stmt);
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS companies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS member_admin_audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      actor_user_id UUID NOT NULL,
      target_user_id UUID NOT NULL,
      action VARCHAR(32) NOT NULL,
      reason TEXT NOT NULL,
      changes_json JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE member_admin_audit_logs
        ADD CONSTRAINT member_admin_audit_logs_actor_user_id_users_id_fk
        FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE RESTRICT;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE member_admin_audit_logs
        ADD CONSTRAINT member_admin_audit_logs_target_user_id_users_id_fk
        FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);

  await pool.query(
    `UPDATE users SET role = 'platform_user' WHERE role = 'user' OR trim(role) = ''`,
  );

  const adminEmail = process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase();
  if (adminEmail) {
    await pool.query(
      `UPDATE users SET role = 'platform_admin' WHERE lower(email) = $1`,
      [adminEmail],
    );
  }
}

// Optional: function to check connection
export async function initDB() {
  try {
    await db.execute(`SELECT 1 AS connected`);
    await ensureTables();
    console.log("Database connected successfully");
  } catch (err) {
    console.error("Database connection failed:", err);
    throw err; // stop server if DB fails
  }
}
