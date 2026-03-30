CREATE TABLE "company_admin_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"target_company_id" uuid NOT NULL,
	"action" varchar(32) NOT NULL,
	"reason" text NOT NULL,
	"changes_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company_admin_audit_logs" ADD CONSTRAINT "company_admin_audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_admin_audit_logs" ADD CONSTRAINT "company_admin_audit_logs_target_company_id_companies_id_fk" FOREIGN KEY ("target_company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;
