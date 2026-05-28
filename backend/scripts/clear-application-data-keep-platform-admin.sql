-- =============================================================================
-- Clear DATA from all application tables (rows only — tables are NOT dropped).
--
-- IMPORTANT: Do not use TRUNCATE ... CASCADE on companies — users.organization_id
-- references companies, so PostgreSQL would truncate users too and delete platform admin.
--
-- Kept user: platform.admin@example.com (seed id b2c15cb6-1678-4819-9d24-6fdd8d192064)
--
-- Run from backend/:
--   psql -h localhost -p 5432 -U postgres -d investor_portal_db -f scripts/clear-application-data-keep-platform-admin.sql
--
-- BACK UP THE DATABASE FIRST.
-- =============================================================================

\set ON_ERROR_STOP on

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE lower(trim(u.email)) = lower('platform.admin@example.com')
  ) THEN
    RAISE EXCEPTION
      'Platform admin not found (platform.admin@example.com). Run migrations/seeds first.';
  END IF;
END $$;

BEGIN;

-- Activity (references users)
DELETE FROM public.user_page_navigations;
DELETE FROM public.user_portal_sessions;

-- Audit / mail (RESTRICT on users — clear before deleting other users)
DELETE FROM public.investor_communication_logs;
DELETE FROM public.member_admin_audit_logs;
DELETE FROM public.company_admin_audit_logs;
DELETE FROM public.soc_auth_audit_logs;

-- eSign templates
DELETE FROM public.esign_reusable_template;
DELETE FROM public.investment_signatures;

-- Company membership (scoped roles)
DELETE FROM public.user_company_membership;

-- CRM
DELETE FROM public.contact;
DELETE FROM public.contact_email_template;
DELETE FROM public.organization_contact_tag;
DELETE FROM public.organization_contact_list;

-- Investor profile book
DELETE FROM public.user_beneficiaries;
DELETE FROM public.user_saved_addresses;
DELETE FROM public.user_investor_profiles;

-- Deal graph
DELETE FROM public.deal_investment;
DELETE FROM public.deal_investor_class;
DELETE FROM public.deal_member;
DELETE FROM public.deal_lp_investor;
DELETE FROM public.assigning_deal_user;
DELETE FROM public.add_deal_form;
DELETE FROM public.deals;

-- Company settings
DELETE FROM public.company_workspace_tab_settings;

-- Detach ALL users from companies before deleting companies (avoids FK issues)
UPDATE public.users
SET organization_id = NULL,
    updated_at = now();

-- Table 24: users — remove everyone except platform.admin@example.com
DELETE FROM public.users u
WHERE lower(trim(u.email)) <> lower('platform.admin@example.com');

-- Companies (all rows — platform admin org_id already NULL)
DELETE FROM public.companies;

COMMIT;

-- Verify
SELECT id, email, username, role, organization_id
FROM public.users;

SELECT 'add_deal_form' AS table_name, count(*)::int AS rows FROM public.add_deal_form
UNION ALL SELECT 'assigning_deal_user', count(*)::int FROM public.assigning_deal_user
UNION ALL SELECT 'companies', count(*)::int FROM public.companies
UNION ALL SELECT 'company_admin_audit_logs', count(*)::int FROM public.company_admin_audit_logs
UNION ALL SELECT 'company_workspace_tab_settings', count(*)::int FROM public.company_workspace_tab_settings
UNION ALL SELECT 'contact', count(*)::int FROM public.contact
UNION ALL SELECT 'contact_email_template', count(*)::int FROM public.contact_email_template
UNION ALL SELECT 'deal_investment', count(*)::int FROM public.deal_investment
UNION ALL SELECT 'deal_investor_class', count(*)::int FROM public.deal_investor_class
UNION ALL SELECT 'deal_lp_investor', count(*)::int FROM public.deal_lp_investor
UNION ALL SELECT 'deal_member', count(*)::int FROM public.deal_member
UNION ALL SELECT 'deals', count(*)::int FROM public.deals
UNION ALL SELECT 'esign_reusable_template', count(*)::int FROM public.esign_reusable_template
UNION ALL SELECT 'investment_signatures', count(*)::int FROM public.investment_signatures
UNION ALL SELECT 'investor_communication_logs', count(*)::int FROM public.investor_communication_logs
UNION ALL SELECT 'member_admin_audit_logs', count(*)::int FROM public.member_admin_audit_logs
UNION ALL SELECT 'organization_contact_list', count(*)::int FROM public.organization_contact_list
UNION ALL SELECT 'organization_contact_tag', count(*)::int FROM public.organization_contact_tag
UNION ALL SELECT 'soc_auth_audit_logs', count(*)::int FROM public.soc_auth_audit_logs
UNION ALL SELECT 'user_beneficiaries', count(*)::int FROM public.user_beneficiaries
UNION ALL SELECT 'user_company_membership', count(*)::int FROM public.user_company_membership
UNION ALL SELECT 'user_investor_profiles', count(*)::int FROM public.user_investor_profiles
UNION ALL SELECT 'user_page_navigations', count(*)::int FROM public.user_page_navigations
UNION ALL SELECT 'user_portal_sessions', count(*)::int FROM public.user_portal_sessions
UNION ALL SELECT 'user_saved_addresses', count(*)::int FROM public.user_saved_addresses
UNION ALL SELECT 'users', count(*)::int FROM public.users
ORDER BY table_name;
