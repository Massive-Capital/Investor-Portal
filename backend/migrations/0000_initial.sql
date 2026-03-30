CREATE TABLE IF NOT EXISTS "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"username" varchar(100) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"role" varchar(50) DEFAULT 'platform_user' NOT NULL,
	"user_status" varchar(50) DEFAULT 'active' NOT NULL,
	"user_signup_completed" varchar(10) DEFAULT 'true' NOT NULL,
	"organization_id" uuid,
	"first_name" varchar(100) DEFAULT '' NOT NULL,
	"last_name" varchar(100) DEFAULT '' NOT NULL,
	"company_name" varchar(255) DEFAULT '' NOT NULL,
	"phone" varchar(32) DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
