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

/**
 * Ensures `deal_investment` exists (Add Investment API).
 * Safe if migrations were not run manually — creates table only when missing.
 */
async function ensureDealInvestmentTable(): Promise<void> {
  const ddl = `
CREATE TABLE IF NOT EXISTS deal_investment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  deal_id uuid NOT NULL REFERENCES add_deal_form(id) ON DELETE CASCADE,
  offering_id text NOT NULL DEFAULT '',
  contact_id text NOT NULL DEFAULT '',
  profile_id text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT '',
  investor_class text NOT NULL DEFAULT '',
  doc_signed_date text,
  commitment_amount text NOT NULL DEFAULT '',
  extra_contribution_amounts jsonb NOT NULL DEFAULT '[]'::jsonb,
  document_storage_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);
`;
  try {
    await pool.query(ddl);
    await pool.query(
      `ALTER TABLE deal_investment ADD COLUMN IF NOT EXISTS contact_display_name text NOT NULL DEFAULT ''`,
    );
    await pool.query(
      `ALTER TABLE deal_investment ADD COLUMN IF NOT EXISTS investor_role text NOT NULL DEFAULT ''`,
    );
    // If investor_role was added manually as char(1)/varchar(1), widen to full text
    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns c
          WHERE c.table_schema = 'public'
            AND c.table_name = 'deal_investment'
            AND c.column_name = 'investor_role'
        ) THEN
          ALTER TABLE deal_investment
            ALTER COLUMN investor_role DROP DEFAULT;
          ALTER TABLE deal_investment
            ALTER COLUMN investor_role TYPE text
            USING trim(both from coalesce(investor_role::text, ''));
          ALTER TABLE deal_investment
            ALTER COLUMN investor_role SET DEFAULT '';
          ALTER TABLE deal_investment
            ALTER COLUMN investor_role SET NOT NULL;
        END IF;
      END $$;
    `);
    console.log("Table deal_investment is present");
  } catch (err) {
    console.warn(
      "Could not ensure deal_investment table (run migrations if add_deal_form is missing):",
      err instanceof Error ? err.message : err,
    );
  }
}

async function ensureDealInvestorClassTable(): Promise<void> {
  const ddl = `
CREATE TABLE IF NOT EXISTS deal_investor_class (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  deal_id uuid NOT NULL REFERENCES add_deal_form(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  subscription_type text NOT NULL DEFAULT '',
  entity_name text NOT NULL DEFAULT '',
  start_date text NOT NULL DEFAULT '',
  offering_size text NOT NULL DEFAULT '',
  minimum_investment text NOT NULL DEFAULT '',
  price_per_unit text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  visibility text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
`;
  try {
    await pool.query(ddl);
    console.log("Table deal_investor_class is present");
  } catch (err) {
    console.warn(
      "Could not ensure deal_investor_class table:",
      err instanceof Error ? err.message : err,
    );
  }
}

async function ensureContactTable(): Promise<void> {
  const ddl = `
CREATE TABLE IF NOT EXISTS contact (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  first_name varchar(200) NOT NULL,
  last_name varchar(200) NOT NULL,
  email varchar(255) NOT NULL,
  phone varchar(64) NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  lists jsonb NOT NULL DEFAULT '[]'::jsonb,
  owners jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
`;
  try {
    await pool.query(ddl);
    await pool.query(
      `ALTER TABLE contact ADD COLUMN IF NOT EXISTS status varchar(32) NOT NULL DEFAULT 'active'`,
    );
    await pool.query(
      `ALTER TABLE contact ADD COLUMN IF NOT EXISTS last_edit_reason text`,
    );
    console.log("Table contact is present");
  } catch (err) {
    console.warn(
      "Could not ensure contact table:",
      err instanceof Error ? err.message : err,
    );
  }
}

/** Links deals to companies for customer directory user/deal counts. */
async function ensureAddDealFormOrganizationId(): Promise<void> {
  try {
    await pool.query(
      `ALTER TABLE add_deal_form ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES companies(id) ON DELETE SET NULL`,
    );
    console.log("Column add_deal_form.organization_id is present");
  } catch (err) {
    console.warn(
      "Could not ensure add_deal_form.organization_id:",
      err instanceof Error ? err.message : err,
    );
  }
}

/** Per-company JSON for Company → Settings / Email / Contact / Offerings tabs. */
async function ensureCompanyWorkspaceTabSettingsTable(): Promise<void> {
  const ddl = `
CREATE TABLE IF NOT EXISTS company_workspace_tab_settings (
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tab_key varchar(64) NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, tab_key)
);
`;
  try {
    await pool.query(ddl);
    console.log("Table company_workspace_tab_settings is present");
  } catch (err) {
    console.warn(
      "Could not ensure company_workspace_tab_settings table:",
      err instanceof Error ? err.message : err,
    );
  }
}

/** Links portal users to deals when investments reference them as members (`contact_id`). */
async function ensureAssigningDealUserTable(): Promise<void> {
  const ddl = `
CREATE TABLE IF NOT EXISTS assigning_deal_user (
  deal_id uuid NOT NULL REFERENCES add_deal_form(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_added_deal uuid REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (deal_id, user_id)
);
`;
  /** Existing DBs may have been created without a PK; ON CONFLICT requires it. */
  const ensurePk = `
DO $ensure_adu_pk$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'assigning_deal_user'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'assigning_deal_user'
      AND c.contype = 'p'
  ) THEN
    ALTER TABLE public.assigning_deal_user
      ADD CONSTRAINT assigning_deal_user_pkey PRIMARY KEY (deal_id, user_id);
  END IF;
END
$ensure_adu_pk$;
`;
  try {
    await pool.query(ddl);
    await pool.query(ensurePk);
    console.log("Table assigning_deal_user is present");
  } catch (err) {
    console.warn(
      "Could not ensure assigning_deal_user table:",
      err instanceof Error ? err.message : err,
    );
  }
}

// Optional: function to check connection
export async function initDB() {
  try {
    await db.execute(`SELECT 1 AS connected`);
    console.log("Database connected successfully");
    await ensureDealInvestmentTable();
    await ensureDealInvestorClassTable();
    await ensureContactTable();
    await ensureAddDealFormOrganizationId();
    await ensureCompanyWorkspaceTabSettingsTable();
    await ensureAssigningDealUserTable();
  } catch (err) {
    console.error("Database connection failed:", err);
    throw err; // stop server if DB fails
  }
}
