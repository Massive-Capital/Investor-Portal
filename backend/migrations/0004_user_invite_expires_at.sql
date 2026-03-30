ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "invite_expires_at" timestamp with time zone;
