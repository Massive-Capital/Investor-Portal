--
-- PostgreSQL database dump
--

\restrict MMvAsUxa6k7O6gSEjQw7gfVPuGFeRSCypmJgk79xhahHjUL5wD7Hi72f1roFiIe

-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

-- Started on 2026-07-31 17:55:00

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 7 (class 2615 OID 65215)
-- Name: drizzle; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA drizzle;


ALTER SCHEMA drizzle OWNER TO postgres;

--
-- TOC entry 2 (class 3079 OID 66697)
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- TOC entry 5747 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 222 (class 1259 OID 65217)
-- Name: __drizzle_migrations; Type: TABLE; Schema: drizzle; Owner: postgres
--

CREATE TABLE drizzle.__drizzle_migrations (
    id integer NOT NULL,
    hash text NOT NULL,
    created_at bigint
);


ALTER TABLE drizzle.__drizzle_migrations OWNER TO postgres;

--
-- TOC entry 221 (class 1259 OID 65216)
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE; Schema: drizzle; Owner: postgres
--

CREATE SEQUENCE drizzle.__drizzle_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNER TO postgres;

--
-- TOC entry 5748 (class 0 OID 0)
-- Dependencies: 221
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: drizzle; Owner: postgres
--

ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNED BY drizzle.__drizzle_migrations.id;


--
-- TOC entry 226 (class 1259 OID 65290)
-- Name: add_deal_form; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.add_deal_form (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    deal_name text NOT NULL,
    deal_type text DEFAULT ''::text NOT NULL,
    deal_stage text NOT NULL,
    sec_type text NOT NULL,
    close_date date,
    owning_entity_name text NOT NULL,
    funds_required_before_gp_sign boolean DEFAULT false NOT NULL,
    auto_send_funding_instructions boolean DEFAULT false NOT NULL,
    property_name text NOT NULL,
    country text DEFAULT ''::text NOT NULL,
    address_line_1 text,
    address_line_2 text,
    city text DEFAULT ''::text NOT NULL,
    state text,
    zip_code text,
    asset_image_path text,
    investor_summary_html text,
    gallery_cover_image_url text,
    key_highlights_json text,
    deal_announcement_title text,
    deal_announcement_message text,
    offering_status text DEFAULT 'draft_hidden'::text NOT NULL,
    offering_visibility text DEFAULT 'show_on_dashboard'::text NOT NULL,
    show_on_investbase boolean DEFAULT false NOT NULL,
    internal_name text DEFAULT ''::text NOT NULL,
    offering_overview_asset_ids text DEFAULT '[]'::text NOT NULL,
    offering_gallery_paths text DEFAULT '[]'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    offering_preview_token text,
    offering_investor_preview_json text,
    esign_templates_json text,
    investor_questionnaire_json text,
    funding_instructions_json text,
    offering_overview_class_id uuid,
    archived boolean DEFAULT false NOT NULL,
    class_setup_json text DEFAULT '{}'::text NOT NULL,
    distribution_setup_json text DEFAULT '{}'::text NOT NULL,
    CONSTRAINT add_deal_form_deal_stage_check CHECK ((deal_stage = ANY (ARRAY['draft'::text, 'Draft'::text, 'raising_capital'::text, 'capital_raising'::text, 'asset_managing'::text, 'managing_asset'::text, 'liquidated'::text])))
);


ALTER TABLE public.add_deal_form OWNER TO postgres;

--
-- TOC entry 5749 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN add_deal_form.archived; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.add_deal_form.archived IS 'When true, deal appears under Archives instead of Active on the syndication deals list.';


--
-- TOC entry 5750 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN add_deal_form.class_setup_json; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.add_deal_form.class_setup_json IS 'JSON: Class Setup module deal-level config (targetRaise, latestChanges). Per-class terms live on deal_investor_class.';


--
-- TOC entry 5751 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN add_deal_form.distribution_setup_json; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.add_deal_form.distribution_setup_json IS 'JSON: Distribution Setup module — waterfalls.operating / waterfalls.capital payment rows. Split cascade is derived from class_setup_json.promote.';


--
-- TOC entry 235 (class 1259 OID 65585)
-- Name: assigning_deal_user; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.assigning_deal_user (
    deal_id uuid NOT NULL,
    user_id uuid NOT NULL,
    user_added_deal uuid
);


ALTER TABLE public.assigning_deal_user OWNER TO postgres;

--
-- TOC entry 223 (class 1259 OID 65227)
-- Name: companies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.companies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    ghl_location_id character varying(64),
    ghl_location_status character varying(32) DEFAULT 'pending'::character varying NOT NULL,
    ghl_location_error text,
    ghl_location_provisioned_at timestamp with time zone,
    stripe_customer_id character varying(255),
    stripe_subscription_id character varying(255),
    stripe_plan_id character varying(64),
    stripe_billing_cycle character varying(32),
    stripe_subscription_status character varying(64) DEFAULT 'none'::character varying NOT NULL,
    stripe_price_id character varying(255),
    stripe_current_period_end timestamp with time zone,
    stripe_last_payment_error text,
    stripe_last_payment_failed_at timestamp with time zone
);


ALTER TABLE public.companies OWNER TO postgres;

--
-- TOC entry 5752 (class 0 OID 0)
-- Dependencies: 223
-- Name: COLUMN companies.ghl_location_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.companies.ghl_location_id IS 'GoHighLevel sub-account (location) id for this organization.';


--
-- TOC entry 5753 (class 0 OID 0)
-- Dependencies: 223
-- Name: COLUMN companies.ghl_location_status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.companies.ghl_location_status IS 'pending | active | failed | skipped — GHL sub-account provisioning state.';


--
-- TOC entry 5754 (class 0 OID 0)
-- Dependencies: 223
-- Name: COLUMN companies.ghl_location_error; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.companies.ghl_location_error IS 'Last GHL provisioning error message when ghl_location_status = failed.';


--
-- TOC entry 5755 (class 0 OID 0)
-- Dependencies: 223
-- Name: COLUMN companies.ghl_location_provisioned_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.companies.ghl_location_provisioned_at IS 'When the GHL sub-account was successfully created or linked.';


--
-- TOC entry 5756 (class 0 OID 0)
-- Dependencies: 223
-- Name: COLUMN companies.stripe_customer_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.companies.stripe_customer_id IS 'Stripe Customer id (cus_…) for this organization.';


--
-- TOC entry 5757 (class 0 OID 0)
-- Dependencies: 223
-- Name: COLUMN companies.stripe_subscription_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.companies.stripe_subscription_id IS 'Stripe Subscription id (sub_…) when the company is on a paid plan.';


--
-- TOC entry 5758 (class 0 OID 0)
-- Dependencies: 223
-- Name: COLUMN companies.stripe_plan_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.companies.stripe_plan_id IS 'Local plan key: portal | platform | custom.';


--
-- TOC entry 5759 (class 0 OID 0)
-- Dependencies: 223
-- Name: COLUMN companies.stripe_billing_cycle; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.companies.stripe_billing_cycle IS 'Billing interval: monthly | annual.';


--
-- TOC entry 5760 (class 0 OID 0)
-- Dependencies: 223
-- Name: COLUMN companies.stripe_subscription_status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.companies.stripe_subscription_status IS 'Mirrors Stripe subscription status, or none when unset.';


--
-- TOC entry 5761 (class 0 OID 0)
-- Dependencies: 223
-- Name: COLUMN companies.stripe_price_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.companies.stripe_price_id IS 'Active Stripe Price id (price_…).';


--
-- TOC entry 5762 (class 0 OID 0)
-- Dependencies: 223
-- Name: COLUMN companies.stripe_current_period_end; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.companies.stripe_current_period_end IS 'End of the current Stripe billing period.';


--
-- TOC entry 5763 (class 0 OID 0)
-- Dependencies: 223
-- Name: COLUMN companies.stripe_last_payment_error; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.companies.stripe_last_payment_error IS 'Last Stripe payment failure message for this company.';


--
-- TOC entry 228 (class 1259 OID 65359)
-- Name: company_admin_audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.company_admin_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_user_id uuid NOT NULL,
    target_company_id uuid NOT NULL,
    action character varying(32) NOT NULL,
    reason text NOT NULL,
    changes_json jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.company_admin_audit_logs OWNER TO postgres;

--
-- TOC entry 252 (class 1259 OID 66139)
-- Name: company_billing_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.company_billing_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    stripe_event_id character varying(255),
    event_type character varying(128) NOT NULL,
    stripe_invoice_id character varying(255),
    stripe_subscription_id character varying(255),
    stripe_customer_id character varying(255),
    message text,
    payload jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.company_billing_events OWNER TO postgres;

--
-- TOC entry 5764 (class 0 OID 0)
-- Dependencies: 252
-- Name: TABLE company_billing_events; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.company_billing_events IS 'Append-only log of Stripe billing webhook/sync events.';


--
-- TOC entry 251 (class 1259 OID 66107)
-- Name: company_billing_invoices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.company_billing_invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    stripe_invoice_id character varying(255) NOT NULL,
    stripe_customer_id character varying(255),
    stripe_subscription_id character varying(255),
    invoice_number character varying(128),
    status character varying(64) DEFAULT 'open'::character varying NOT NULL,
    currency character varying(16) DEFAULT 'usd'::character varying NOT NULL,
    amount_due_cents integer DEFAULT 0 NOT NULL,
    amount_paid_cents integer DEFAULT 0 NOT NULL,
    amount_remaining_cents integer DEFAULT 0 NOT NULL,
    hosted_invoice_url text,
    invoice_pdf text,
    payment_failure_message text,
    payment_failed_at timestamp with time zone,
    paid_at timestamp with time zone,
    invoice_date timestamp with time zone,
    due_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.company_billing_invoices OWNER TO postgres;

--
-- TOC entry 5765 (class 0 OID 0)
-- Dependencies: 251
-- Name: TABLE company_billing_invoices; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.company_billing_invoices IS 'Local copy of Stripe invoices for company billing history and failure tracking.';


--
-- TOC entry 253 (class 1259 OID 66158)
-- Name: company_billing_payment_methods; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.company_billing_payment_methods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    stripe_payment_method_id character varying(255) CONSTRAINT company_billing_payment_metho_stripe_payment_method_id_not_null NOT NULL,
    stripe_customer_id character varying(255),
    type character varying(64) DEFAULT 'card'::character varying NOT NULL,
    brand character varying(64),
    last4 character varying(8),
    exp_month integer,
    exp_year integer,
    funding character varying(32),
    country character varying(8),
    fingerprint character varying(255),
    billing_name text,
    billing_email character varying(320),
    billing_phone character varying(64),
    billing_address jsonb,
    is_default boolean DEFAULT false NOT NULL,
    livemode boolean DEFAULT false NOT NULL,
    stripe_created_at timestamp with time zone,
    stripe_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    detached_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.company_billing_payment_methods OWNER TO postgres;

--
-- TOC entry 5766 (class 0 OID 0)
-- Dependencies: 253
-- Name: TABLE company_billing_payment_methods; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.company_billing_payment_methods IS 'Local copy of Stripe PaymentMethods attached to the company customer (portal + checkout).';


--
-- TOC entry 5767 (class 0 OID 0)
-- Dependencies: 253
-- Name: COLUMN company_billing_payment_methods.stripe_payload; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.company_billing_payment_methods.stripe_payload IS 'Snapshot of the Stripe PaymentMethod object as returned by the API.';


--
-- TOC entry 5768 (class 0 OID 0)
-- Dependencies: 253
-- Name: COLUMN company_billing_payment_methods.detached_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.company_billing_payment_methods.detached_at IS 'Set when the payment method is removed in Stripe; null while active.';


--
-- TOC entry 232 (class 1259 OID 65505)
-- Name: company_workspace_tab_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.company_workspace_tab_settings (
    company_id uuid NOT NULL,
    tab_key character varying(64) NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.company_workspace_tab_settings OWNER TO postgres;

--
-- TOC entry 231 (class 1259 OID 65472)
-- Name: contact; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contact (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    first_name character varying(200) NOT NULL,
    last_name character varying(200) NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(64) DEFAULT ''::character varying NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    tags jsonb DEFAULT '[]'::jsonb NOT NULL,
    lists jsonb DEFAULT '[]'::jsonb NOT NULL,
    owners jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    status character varying(32) DEFAULT 'active'::character varying NOT NULL,
    last_edit_reason text,
    is_portal_user boolean DEFAULT false NOT NULL,
    organization_id uuid,
    platform_admin_only boolean DEFAULT false NOT NULL,
    full_name character varying(400) DEFAULT ''::character varying NOT NULL
);


ALTER TABLE public.contact OWNER TO postgres;

--
-- TOC entry 241 (class 1259 OID 65777)
-- Name: contact_email_template; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contact_email_template (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    subject character varying(255) DEFAULT ''::character varying NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    attachment jsonb,
    archived boolean DEFAULT false NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.contact_email_template OWNER TO postgres;

--
-- TOC entry 254 (class 1259 OID 66191)
-- Name: deal_asset; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.deal_asset (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deal_id uuid NOT NULL,
    client_asset_id text NOT NULL,
    property_name text DEFAULT ''::text NOT NULL,
    country text DEFAULT ''::text NOT NULL,
    street_address_1 text DEFAULT ''::text NOT NULL,
    street_address_2 text DEFAULT ''::text NOT NULL,
    city text DEFAULT ''::text NOT NULL,
    state text DEFAULT ''::text NOT NULL,
    zip_code text DEFAULT ''::text NOT NULL,
    address_display text DEFAULT ''::text NOT NULL,
    asset_type text DEFAULT ''::text NOT NULL,
    image_count integer DEFAULT 0 NOT NULL,
    archived boolean DEFAULT false NOT NULL,
    additional_info_json text DEFAULT '[]'::text NOT NULL,
    attr_rows_json text DEFAULT '[]'::text NOT NULL,
    image_preview_urls_json text DEFAULT '[]'::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.deal_asset OWNER TO postgres;

--
-- TOC entry 5769 (class 0 OID 0)
-- Dependencies: 254
-- Name: TABLE deal_asset; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.deal_asset IS 'Offering Assets section: one row per deal asset including additional information JSON.';


--
-- TOC entry 5770 (class 0 OID 0)
-- Dependencies: 254
-- Name: COLUMN deal_asset.additional_info_json; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.deal_asset.additional_info_json IS 'JSON: [{ "label": string, "value": string }, ...]';


--
-- TOC entry 5771 (class 0 OID 0)
-- Dependencies: 254
-- Name: COLUMN deal_asset.attr_rows_json; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.deal_asset.attr_rows_json IS 'JSON: [{ "id", "label", "kind", "value", "unitSuffix?", "na?", "preset?" }, ...]';


--
-- TOC entry 229 (class 1259 OID 65384)
-- Name: deal_investment; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.deal_investment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deal_id uuid NOT NULL,
    offering_id text DEFAULT ''::text NOT NULL,
    contact_id text DEFAULT ''::text NOT NULL,
    profile_id text DEFAULT ''::text NOT NULL,
    status text DEFAULT ''::text NOT NULL,
    investor_class text DEFAULT ''::text NOT NULL,
    doc_signed_date text,
    commitment_amount text DEFAULT ''::text NOT NULL,
    extra_contribution_amounts jsonb DEFAULT '[]'::jsonb NOT NULL,
    document_storage_path text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    contact_display_name text DEFAULT ''::text NOT NULL,
    investor_role text DEFAULT ''::text NOT NULL,
    user_investor_profile_id uuid,
    fund_approved boolean DEFAULT false NOT NULL,
    fund_approved_commitment_snapshot text DEFAULT ''::text NOT NULL,
    fund_approved_by text,
    fund_approved_at timestamp with time zone,
    esign_status_json text,
    investor_questionnaire_answers_json text,
    investor_w9_form_json text,
    funding_method text DEFAULT ''::text NOT NULL
);


ALTER TABLE public.deal_investment OWNER TO postgres;

--
-- TOC entry 230 (class 1259 OID 65427)
-- Name: deal_investor_class; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.deal_investor_class (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deal_id uuid NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    subscription_type text DEFAULT ''::text NOT NULL,
    entity_name text DEFAULT ''::text NOT NULL,
    start_date text DEFAULT ''::text NOT NULL,
    offering_size text DEFAULT ''::text NOT NULL,
    raise_amount_distributions text DEFAULT ''::text NOT NULL,
    billing_raise_quota text DEFAULT ''::text NOT NULL,
    minimum_investment text DEFAULT ''::text NOT NULL,
    price_per_unit text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    visibility text DEFAULT ''::text NOT NULL,
    advanced_options_json text DEFAULT '{}'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    number_of_units text DEFAULT ''::text NOT NULL
);


ALTER TABLE public.deal_investor_class OWNER TO postgres;

--
-- TOC entry 234 (class 1259 OID 65554)
-- Name: deal_lp_investor; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.deal_lp_investor (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deal_id uuid NOT NULL,
    added_by uuid,
    contact_member_id text DEFAULT ''::text NOT NULL,
    investor_class text DEFAULT ''::text NOT NULL,
    send_invitation_mail text DEFAULT 'no'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    profile_id text DEFAULT ''::text NOT NULL,
    email character varying(255),
    role character varying(100) DEFAULT ''::character varying NOT NULL,
    committed_amount text DEFAULT ''::text NOT NULL,
    user_investor_profile_id uuid,
    doc_signed_date text,
    esign_status_json text,
    percent_of_class_ownership text DEFAULT ''::text NOT NULL,
    percent_of_class_distributions text DEFAULT ''::text NOT NULL
);


ALTER TABLE public.deal_lp_investor OWNER TO postgres;

--
-- TOC entry 233 (class 1259 OID 65523)
-- Name: deal_member; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.deal_member (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deal_id uuid NOT NULL,
    added_by uuid,
    contact_member_id text DEFAULT ''::text NOT NULL,
    deal_member_role text DEFAULT ''::text NOT NULL,
    send_invitation_mail text DEFAULT 'no'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.deal_member OWNER TO postgres;

--
-- TOC entry 224 (class 1259 OID 65241)
-- Name: deals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.deals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.deals OWNER TO postgres;

--
-- TOC entry 246 (class 1259 OID 65937)
-- Name: esign_reusable_template; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.esign_reusable_template (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    dropbox_sign_template_id character varying(128),
    dropbox_sign_status character varying(16) DEFAULT 'none'::character varying NOT NULL,
    roles jsonb DEFAULT '[]'::jsonb NOT NULL,
    relative_path text,
    original_name character varying(512),
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    archived boolean DEFAULT false NOT NULL
);


ALTER TABLE public.esign_reusable_template OWNER TO postgres;

--
-- TOC entry 257 (class 1259 OID 66735)
-- Name: etl_column_mapping; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.etl_column_mapping (
    mapping_id integer NOT NULL,
    upload_type character varying(100) NOT NULL,
    excel_column_name character varying(255) NOT NULL,
    database_column_name character varying(255) NOT NULL,
    data_type character varying(50) DEFAULT 'STRING'::character varying NOT NULL,
    required_flag boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.etl_column_mapping OWNER TO postgres;

--
-- TOC entry 258 (class 1259 OID 66748)
-- Name: etl_column_mapping_mapping_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.etl_column_mapping_mapping_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.etl_column_mapping_mapping_id_seq OWNER TO postgres;

--
-- TOC entry 5772 (class 0 OID 0)
-- Dependencies: 258
-- Name: etl_column_mapping_mapping_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.etl_column_mapping_mapping_id_seq OWNED BY public.etl_column_mapping.mapping_id;


--
-- TOC entry 259 (class 1259 OID 66749)
-- Name: etl_error_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.etl_error_log (
    error_id integer NOT NULL,
    job_id integer NOT NULL,
    row_number integer,
    column_name character varying(255),
    error_type character varying(50),
    error_message text NOT NULL,
    stack_trace text,
    created_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.etl_error_log OWNER TO postgres;

--
-- TOC entry 260 (class 1259 OID 66758)
-- Name: etl_error_log_error_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.etl_error_log_error_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.etl_error_log_error_id_seq OWNER TO postgres;

--
-- TOC entry 5773 (class 0 OID 0)
-- Dependencies: 260
-- Name: etl_error_log_error_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.etl_error_log_error_id_seq OWNED BY public.etl_error_log.error_id;


--
-- TOC entry 261 (class 1259 OID 66759)
-- Name: etl_file_tracking; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.etl_file_tracking (
    file_id integer NOT NULL,
    job_id integer NOT NULL,
    file_name character varying(500) NOT NULL,
    file_size bigint,
    file_path character varying(1000),
    upload_time timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    file_status character varying(50) DEFAULT 'UPLOADED'::character varying
);


ALTER TABLE public.etl_file_tracking OWNER TO postgres;

--
-- TOC entry 262 (class 1259 OID 66769)
-- Name: etl_file_tracking_file_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.etl_file_tracking_file_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.etl_file_tracking_file_id_seq OWNER TO postgres;

--
-- TOC entry 5774 (class 0 OID 0)
-- Dependencies: 262
-- Name: etl_file_tracking_file_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.etl_file_tracking_file_id_seq OWNED BY public.etl_file_tracking.file_id;


--
-- TOC entry 263 (class 1259 OID 66770)
-- Name: etl_job_master; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.etl_job_master (
    job_id integer NOT NULL,
    job_type character varying(100) NOT NULL,
    file_name character varying(500),
    status character varying(50) DEFAULT 'PENDING'::character varying NOT NULL,
    start_time timestamp without time zone,
    end_time timestamp without time zone,
    total_records integer DEFAULT 0,
    success_count integer DEFAULT 0,
    failed_count integer DEFAULT 0,
    created_by character varying(255) DEFAULT 'system'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.etl_job_master OWNER TO postgres;

--
-- TOC entry 264 (class 1259 OID 66784)
-- Name: etl_job_master_job_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.etl_job_master_job_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.etl_job_master_job_id_seq OWNER TO postgres;

--
-- TOC entry 5775 (class 0 OID 0)
-- Dependencies: 264
-- Name: etl_job_master_job_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.etl_job_master_job_id_seq OWNED BY public.etl_job_master.job_id;


--
-- TOC entry 265 (class 1259 OID 66785)
-- Name: etl_media_uploads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.etl_media_uploads (
    media_id integer NOT NULL,
    entity_type character varying(50) NOT NULL,
    media_type character varying(50) NOT NULL,
    document_section character varying(200),
    deal_id character varying(100),
    organization_id character varying(100),
    original_name character varying(500) NOT NULL,
    stored_name character varying(500) NOT NULL,
    file_path character varying(1000) NOT NULL,
    file_size bigint,
    mime_type character varying(200),
    created_by character varying(255) DEFAULT 'web-user'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.etl_media_uploads OWNER TO postgres;

--
-- TOC entry 266 (class 1259 OID 66798)
-- Name: etl_media_uploads_media_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.etl_media_uploads_media_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.etl_media_uploads_media_id_seq OWNER TO postgres;

--
-- TOC entry 5776 (class 0 OID 0)
-- Dependencies: 266
-- Name: etl_media_uploads_media_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.etl_media_uploads_media_id_seq OWNED BY public.etl_media_uploads.media_id;


--
-- TOC entry 267 (class 1259 OID 66799)
-- Name: etl_record_status; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.etl_record_status (
    record_status_id integer NOT NULL,
    job_id integer NOT NULL,
    row_number integer NOT NULL,
    status character varying(50) NOT NULL,
    entity_id character varying(100),
    error_message text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    column_name text
);


ALTER TABLE public.etl_record_status OWNER TO postgres;

--
-- TOC entry 268 (class 1259 OID 66810)
-- Name: etl_record_status_record_status_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.etl_record_status_record_status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.etl_record_status_record_status_id_seq OWNER TO postgres;

--
-- TOC entry 5777 (class 0 OID 0)
-- Dependencies: 268
-- Name: etl_record_status_record_status_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.etl_record_status_record_status_id_seq OWNED BY public.etl_record_status.record_status_id;


--
-- TOC entry 269 (class 1259 OID 66811)
-- Name: etl_stage_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.etl_stage_log (
    stage_log_id integer NOT NULL,
    job_id integer NOT NULL,
    stage_name character varying(50) NOT NULL,
    status character varying(50) NOT NULL,
    start_time timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    end_time timestamp without time zone,
    message text
);


ALTER TABLE public.etl_stage_log OWNER TO postgres;

--
-- TOC entry 270 (class 1259 OID 66821)
-- Name: etl_stage_log_stage_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.etl_stage_log_stage_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.etl_stage_log_stage_log_id_seq OWNER TO postgres;

--
-- TOC entry 5778 (class 0 OID 0)
-- Dependencies: 270
-- Name: etl_stage_log_stage_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.etl_stage_log_stage_log_id_seq OWNED BY public.etl_stage_log.stage_log_id;


--
-- TOC entry 247 (class 1259 OID 65971)
-- Name: investment_signatures; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.investment_signatures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    investment_id uuid NOT NULL,
    investor_id text DEFAULT ''::text NOT NULL,
    signature_request_id text NOT NULL,
    status text DEFAULT 'Sent'::text NOT NULL,
    sign_url text,
    sent_at timestamp with time zone,
    viewed_at timestamp with time zone,
    signed_at timestamp with time zone,
    completed_at timestamp with time zone,
    dropbox_response text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.investment_signatures OWNER TO postgres;

--
-- TOC entry 255 (class 1259 OID 66257)
-- Name: investor_checkout_payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.investor_checkout_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    investment_id uuid NOT NULL,
    deal_id uuid NOT NULL,
    investor_user_id uuid NOT NULL,
    stripe_checkout_session_id character varying(255) NOT NULL,
    stripe_payment_intent_id character varying(255),
    amount_cents integer NOT NULL,
    currency character varying(16) DEFAULT 'usd'::character varying NOT NULL,
    status character varying(32) DEFAULT 'created'::character varying NOT NULL,
    failure_message text,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.investor_checkout_payments OWNER TO postgres;

--
-- TOC entry 243 (class 1259 OID 65828)
-- Name: investor_communication_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.investor_communication_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_id uuid,
    deal_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    sender_name character varying(255) DEFAULT ''::character varying NOT NULL,
    subject character varying(500) DEFAULT ''::character varying NOT NULL,
    recipient_users jsonb DEFAULT '[]'::jsonb NOT NULL,
    mail_status character varying(32) DEFAULT 'sent'::character varying NOT NULL,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.investor_communication_logs OWNER TO postgres;

--
-- TOC entry 256 (class 1259 OID 66298)
-- Name: investor_distribution_payouts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.investor_distribution_payouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deal_id uuid NOT NULL,
    distribution_id character varying(255) NOT NULL,
    investment_id uuid NOT NULL,
    user_investor_profile_id uuid NOT NULL,
    investor_user_id uuid NOT NULL,
    initiated_by_user_id uuid NOT NULL,
    amount_cents integer NOT NULL,
    currency character varying(16) DEFAULT 'usd'::character varying NOT NULL,
    stripe_connected_account_id character varying(255) CONSTRAINT investor_distribution_payou_stripe_connected_account_i_not_null NOT NULL,
    stripe_transfer_id character varying(255),
    stripe_payout_id character varying(255),
    status character varying(32) DEFAULT 'pending'::character varying NOT NULL,
    failure_code character varying(128),
    failure_message text,
    initiated_at timestamp with time zone,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.investor_distribution_payouts OWNER TO postgres;

--
-- TOC entry 271 (class 1259 OID 66822)
-- Name: investors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.investors (
    id integer NOT NULL,
    deal_id character varying(50) NOT NULL,
    investor_name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    investment_amount numeric(15,2) NOT NULL,
    image_path character varying(500),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.investors OWNER TO postgres;

--
-- TOC entry 272 (class 1259 OID 66834)
-- Name: investors_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.investors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.investors_id_seq OWNER TO postgres;

--
-- TOC entry 5779 (class 0 OID 0)
-- Dependencies: 272
-- Name: investors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.investors_id_seq OWNED BY public.investors.id;


--
-- TOC entry 227 (class 1259 OID 65334)
-- Name: member_admin_audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.member_admin_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_user_id uuid NOT NULL,
    target_user_id uuid NOT NULL,
    action character varying(32) NOT NULL,
    reason text NOT NULL,
    changes_json jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.member_admin_audit_logs OWNER TO postgres;

--
-- TOC entry 237 (class 1259 OID 65641)
-- Name: organization_contact_list; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organization_contact_list (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(200) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.organization_contact_list OWNER TO postgres;

--
-- TOC entry 236 (class 1259 OID 65623)
-- Name: organization_contact_tag; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organization_contact_tag (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(200) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.organization_contact_tag OWNER TO postgres;

--
-- TOC entry 249 (class 1259 OID 66026)
-- Name: platform_signup_notification; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.platform_signup_notification (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    contact_id uuid,
    signup_kind character varying(32) NOT NULL,
    company_name character varying(500),
    organization_id uuid,
    user_email character varying(255) NOT NULL,
    user_display_name character varying(400) NOT NULL,
    user_role character varying(64) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.platform_signup_notification OWNER TO postgres;

--
-- TOC entry 242 (class 1259 OID 65811)
-- Name: soc_auth_audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.soc_auth_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event character varying(512) NOT NULL,
    outcome character varying(32) NOT NULL,
    http_status integer NOT NULL,
    duration_ms integer NOT NULL,
    method character varying(16),
    path text,
    identifier text,
    client_ip character varying(128),
    requested_machine_ip character varying(128),
    request_url text,
    user_agent text,
    user_id character varying(36),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.soc_auth_audit_logs OWNER TO postgres;

--
-- TOC entry 250 (class 1259 OID 66057)
-- Name: user_auth_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_auth_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_type character varying(16) NOT NULL,
    token_hash character varying(64) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    replaced_by_id uuid,
    portal_session_id uuid,
    user_agent text,
    client_ip character varying(128),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_auth_tokens_token_type_check CHECK (((token_type)::text = ANY ((ARRAY['access'::character varying, 'refresh'::character varying])::text[])))
);


ALTER TABLE public.user_auth_tokens OWNER TO postgres;

--
-- TOC entry 239 (class 1259 OID 65691)
-- Name: user_beneficiaries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_beneficiaries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    full_name character varying(200) DEFAULT ''::character varying NOT NULL,
    relationship character varying(100) DEFAULT ''::character varying NOT NULL,
    tax_id character varying(100) DEFAULT ''::character varying NOT NULL,
    phone character varying(32) DEFAULT ''::character varying NOT NULL,
    email character varying(255) DEFAULT ''::character varying NOT NULL,
    address_query text DEFAULT ''::text NOT NULL,
    archived boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_beneficiaries OWNER TO postgres;

--
-- TOC entry 248 (class 1259 OID 65997)
-- Name: user_company_membership; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_company_membership (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    company_id uuid NOT NULL,
    role character varying(50) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_company_membership OWNER TO postgres;

--
-- TOC entry 238 (class 1259 OID 65664)
-- Name: user_investor_profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_investor_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    profile_name character varying(255) NOT NULL,
    profile_type character varying(100) DEFAULT ''::character varying NOT NULL,
    added_by character varying(255) DEFAULT ''::character varying NOT NULL,
    investments_count integer DEFAULT 0 NOT NULL,
    archived boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_edit_reason text,
    form_snapshot jsonb,
    distribution_method character varying(32) DEFAULT ''::character varying NOT NULL,
    ach_routing_number character varying(9) DEFAULT ''::character varying NOT NULL,
    ach_account_number character varying(34) DEFAULT ''::character varying NOT NULL,
    ach_bank_address text DEFAULT ''::text NOT NULL,
    ach_bank_name character varying(255) DEFAULT ''::character varying NOT NULL,
    ach_bank_account_type character varying(32) DEFAULT ''::character varying NOT NULL,
    bank_account_query text DEFAULT ''::text NOT NULL,
    check_payee_name character varying(255) DEFAULT ''::character varying NOT NULL,
    check_mailing_address_id uuid,
    is_draft boolean DEFAULT false NOT NULL,
    stripe_connect_account_id character varying(255),
    stripe_connect_details_submitted boolean DEFAULT false CONSTRAINT user_investor_profiles_stripe_connect_details_submitte_not_null NOT NULL,
    stripe_connect_charges_enabled boolean DEFAULT false NOT NULL,
    stripe_connect_payouts_enabled boolean DEFAULT false NOT NULL,
    stripe_connect_status character varying(32) DEFAULT 'not_started'::character varying NOT NULL,
    stripe_connect_updated_at timestamp with time zone
);


ALTER TABLE public.user_investor_profiles OWNER TO postgres;

--
-- TOC entry 5780 (class 0 OID 0)
-- Dependencies: 238
-- Name: TABLE user_investor_profiles; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.user_investor_profiles IS 'Saved investor (LP) profiles: display label, type, and optional full add-profile form data per portal user.';


--
-- TOC entry 5781 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN user_investor_profiles.form_snapshot; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_investor_profiles.form_snapshot IS 'Add/edit LP profile wizard: one JSON object with all multi-step form fields (identity, tax, distribution, address IDs, beneficiary). NULL for legacy rows or empty saves.';


--
-- TOC entry 5782 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN user_investor_profiles.distribution_method; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_investor_profiles.distribution_method IS 'ach | check | other — how distributions are paid for this profile.';


--
-- TOC entry 5783 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN user_investor_profiles.ach_routing_number; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_investor_profiles.ach_routing_number IS '9-digit ABA routing number when distribution_method is ach.';


--
-- TOC entry 5784 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN user_investor_profiles.ach_account_number; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_investor_profiles.ach_account_number IS 'Bank account number when distribution_method is ach.';


--
-- TOC entry 5785 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN user_investor_profiles.ach_bank_address; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_investor_profiles.ach_bank_address IS 'Bank branch / mailing address when distribution_method is ach.';


--
-- TOC entry 5786 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN user_investor_profiles.ach_bank_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_investor_profiles.ach_bank_name IS 'Financial institution name when distribution_method is ach.';


--
-- TOC entry 5787 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN user_investor_profiles.ach_bank_account_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_investor_profiles.ach_bank_account_type IS 'e.g. checking | savings when distribution_method is ach.';


--
-- TOC entry 5788 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN user_investor_profiles.is_draft; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_investor_profiles.is_draft IS 'True while the add-profile wizard is in progress (autosave); false after explicit Save.';


--
-- TOC entry 245 (class 1259 OID 65907)
-- Name: user_page_navigations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_page_navigations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    session_id uuid NOT NULL,
    page_path text NOT NULL,
    page_label character varying(255) DEFAULT ''::character varying NOT NULL,
    visit_count integer DEFAULT 1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_page_navigations OWNER TO postgres;

--
-- TOC entry 244 (class 1259 OID 65891)
-- Name: user_portal_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_portal_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    login_at timestamp with time zone DEFAULT now() NOT NULL,
    logout_at timestamp with time zone
);


ALTER TABLE public.user_portal_sessions OWNER TO postgres;

--
-- TOC entry 240 (class 1259 OID 65723)
-- Name: user_saved_addresses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_saved_addresses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    full_name_or_company character varying(255) DEFAULT ''::character varying NOT NULL,
    country character varying(100) DEFAULT ''::character varying NOT NULL,
    street1 character varying(255) DEFAULT ''::character varying NOT NULL,
    street2 character varying(255) DEFAULT ''::character varying NOT NULL,
    city character varying(100) DEFAULT ''::character varying NOT NULL,
    state character varying(100) DEFAULT ''::character varying NOT NULL,
    zip character varying(32) DEFAULT ''::character varying NOT NULL,
    check_memo character varying(500) DEFAULT ''::character varying NOT NULL,
    distribution_note text DEFAULT ''::text NOT NULL,
    archived boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_saved_addresses OWNER TO postgres;

--
-- TOC entry 225 (class 1259 OID 65256)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    username character varying(100) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(50) DEFAULT 'platform_user'::character varying NOT NULL,
    user_status character varying(50) DEFAULT 'active'::character varying NOT NULL,
    user_signup_completed character varying(10) DEFAULT 'true'::character varying NOT NULL,
    organization_id uuid,
    first_name character varying(100) DEFAULT ''::character varying NOT NULL,
    last_name character varying(100) DEFAULT ''::character varying NOT NULL,
    phone character varying(32) DEFAULT ''::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    invite_expires_at timestamp with time zone
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 5071 (class 2604 OID 66835)
-- Name: __drizzle_migrations id; Type: DEFAULT; Schema: drizzle; Owner: postgres
--

ALTER TABLE ONLY drizzle.__drizzle_migrations ALTER COLUMN id SET DEFAULT nextval('drizzle.__drizzle_migrations_id_seq'::regclass);


--
-- TOC entry 5297 (class 2604 OID 66836)
-- Name: etl_column_mapping mapping_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etl_column_mapping ALTER COLUMN mapping_id SET DEFAULT nextval('public.etl_column_mapping_mapping_id_seq'::regclass);


--
-- TOC entry 5301 (class 2604 OID 66837)
-- Name: etl_error_log error_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etl_error_log ALTER COLUMN error_id SET DEFAULT nextval('public.etl_error_log_error_id_seq'::regclass);


--
-- TOC entry 5303 (class 2604 OID 66838)
-- Name: etl_file_tracking file_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etl_file_tracking ALTER COLUMN file_id SET DEFAULT nextval('public.etl_file_tracking_file_id_seq'::regclass);


--
-- TOC entry 5306 (class 2604 OID 66839)
-- Name: etl_job_master job_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etl_job_master ALTER COLUMN job_id SET DEFAULT nextval('public.etl_job_master_job_id_seq'::regclass);


--
-- TOC entry 5313 (class 2604 OID 66840)
-- Name: etl_media_uploads media_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etl_media_uploads ALTER COLUMN media_id SET DEFAULT nextval('public.etl_media_uploads_media_id_seq'::regclass);


--
-- TOC entry 5316 (class 2604 OID 66841)
-- Name: etl_record_status record_status_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etl_record_status ALTER COLUMN record_status_id SET DEFAULT nextval('public.etl_record_status_record_status_id_seq'::regclass);


--
-- TOC entry 5319 (class 2604 OID 66842)
-- Name: etl_stage_log stage_log_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etl_stage_log ALTER COLUMN stage_log_id SET DEFAULT nextval('public.etl_stage_log_stage_log_id_seq'::regclass);


--
-- TOC entry 5321 (class 2604 OID 66843)
-- Name: investors id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.investors ALTER COLUMN id SET DEFAULT nextval('public.investors_id_seq'::regclass);


--
-- TOC entry 5691 (class 0 OID 65217)
-- Dependencies: 222
-- Data for Name: __drizzle_migrations; Type: TABLE DATA; Schema: drizzle; Owner: postgres
--

COPY drizzle.__drizzle_migrations (id, hash, created_at) FROM stdin;
1	4b5a83c79f661e29d2c8b0b53de841ba6a7edb7e1c658443c898de951568de3d	1890000000000
2	f68b01c16b9b775450efc966b40d1e064929fd91f76f8a231757e689b5e0c7a9	1744300800000
3	4744f1f70c97adf1407c32ffbcb408a258eb954fbe1afa01033fecb0eedd578d	1776000000000
4	99d6d6c98ade0ed5ebf67888180b7d9dd50c3d6a6e47935fba7b18904e835338	1776100000000
5	0b8c916b98a16744c185c3d5215c2eb2d6d42ef7b3ac109e90c3255c9bd49a69	1776200000000
6	117d1b84744868b1b31a145a531a8c2ed0d15b8a998d69e64f0b4b52289d0c70	1776300000000
7	77501b4e1dc1f1863405f75d1bb9f543dca2b0115f0dfc32648cc8fa6f107af8	1776400000000
8	bc482cec5e6285d614f0c959c1d39dc9492d99c7e32b0f41f7902d2cc9679584	1776500000000
9	0a6c0222e438852ffa7361ff65044cc6a46c06ce5e2570f6468d76febbdb90e4	1776600000000
10	4fa488cb19d20dc58ea05eb112691ad330b26321dc69f224212414a9b85d9ca0	1776700000000
11	775d8f8f096c815b8693f61127e3382f5eb2d0f49de6e723a426e5535b290352	1776800000000
12	e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855	1890100000000
13	e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855	1890200000000
14	3ffe9fcee6154d4f0ba9ec339cebf8edd89998fc7fbc3af363396aef25733d50	1890300000000
15	e48563c18a1c2468df3a5a839bce6f49f6d25e7db6a4689e1d00f1ed1704b925	1890400000000
16	c1771dddf1cf1880762b5cb2fdb704c007d0623764b99cded2bb7cc5cef3606f	1890500000000
17	a77da002b1442521da4daa806ebf3a97d3aef7839724375ba4293444c4853b62	1890600000000
18	76656b7b82dde3faae9703d99a1f69f0e2efbc700e367bb887f5f2e5241022f4	1890700000000
19	c2180f3f1750866aa7ba52cd3378d2b59296cfe4659526c781ea9c277d145c00	1890800000000
20	74df743a4a27cdfeac3bd2315fa106fa45a2d0a791c18d6efc799411c99175cc	1890900000000
21	63c30599021314b4687d8a9dedb262b1b004ce944a0f875aeed0aa46f01be357	1891000000000
22	4eec8209a4b05ca9d54731498fef3952d4d88f85023988f71aa9f79a2562b6ad	1891100000000
23	fcc55487c182e8a97ad23d815e5cf1e2f65b1dba201415965bb1c53a5dc9079e	1891200000000
24	4539f6cb74bd4617dd8131dc547f06d64834080c6712277895564c77876e2844	1891300000000
25	dd2856aec5eb31ae4f8488be07dd26ecdcd366a08dc858e7e0da9b95274cda81	1891400000000
26	c56f5f8cce063562206a85a7dfb917c168b75d8c5e69e99852792a522c6350fe	1891500000000
27	53e8780503147958b014030e9d7acf2c6dcfa6d67770f4dd698e7c87b9650d2f	1891600000000
28	aa2848f9027e6b7ad1497bd6ad4253cd661decc511154fc1f4309e699759ff6b	1891700000000
29	046e8af6947a4e4d441849f8d2eefb44e73503c780fb65066fe6d9d38dfca564	1891800000000
30	273423cc04765cc3aad79b819587537117b5176140b9cb44fe4ea3b9db847520	1891900000000
31	0cb168794ec337c6f55c7f733eaa1e5f3dcc1de44fde128dfbc1891c20432713	1892000000000
32	3ee4ad4036b38c06802979b2ebd07d5b8006c4386eabaf45b3a6deea4098f4ac	1892100000000
33	25989abfe9e9f68f6491bbec9755634544c77850d887459df35b9785df16c7e5	1892200000000
34	98c4451bd32def0d2f6130fb3315bd23379f1cc025451f068c68f4b77ffa2bbc	1892250000000
35	b18e0f1e26059a007ede891293f918beb27bb1dd8ee0c13ef2272fbcadb97398	1892300000000
36	9b20c23c96099694835029837f7237db484fc35249d6899113a75c9df4f01511	1892350000000
37	7d1b634e1aa3e34a5ec78de241faccb43f77db17ebc7350016db0b0776a77088	1892400000000
38	989ed310142d06afdc1b4ccb7d2e972a01cc0e70b37add3eafa66d283d38dcec	1892450000000
39	d19e96454ee0eda52b5bbb33041ef3db9bc09f99f21e214ff4118ba6d16ac9a4	1892500000000
40	86e8ca837cafdde0435435df0bcde1f30ec631e9575333b4df97960a4ef3b620	1892550000000
41	f3d596ead863cd824e5c0b9e68b4e2e385eb160d9edec3624b21e38b9bc37e04	1892600000000
42	464b46db7085b0dbe1cfb06f25fce7bd591b358808fb5dfb3c5aba9d3b8c992a	1892650000000
43	0bb9f10d3a9e0c226363d7dc5bc484661bf18e0364485c3e346d5adc1a2a2f18	1892700000000
44	fa0c12f8fc2fe8b1bf179a03b1d86553d462cca299dcf317ba36152654376f84	1892750000000
45	5d4d57f115c9ac0092aa331f3ff5bbf9be2add9f22f553cd33fc984d792a1a19	1892800000000
46	0a1b68d45b5efcdfb0ff3df0ab38ac725ef80610044a99aa7b8e7e67ad44bdd5	1892850000000
47	c836e3077614c1df88407750b09723ecc14ca5016479f94ef893b307f1ae87b3	1892900000000
48	e79b7e159466b5f22ef5d80d153d75c4703df446db0251ca2c9c43642ca0b180	1892950000000
49	f7684cfbfe1e1381ec5288905854d889b38127cc0cd944b3ffc14a5605c02cd9	1893000000000
50	d3870eefe559090c3a261caaed2a01758b4d0759cb83d499a170cc6f205032e0	1893050000000
51	287826ca80a1a1a22049b1293dfcc5f20b9fec18a6e92bd640032cd08fc234a8	1893100000000
52	9fa92173cbe3f4f05e38ec5fa92bd5997287b2daeb38b0735ae920a4320ed08b	1893150000000
53	effc27d1f84b7ae8a9d2901e7ec1e327c39b98b6024f05e2693028f17bc22e3d	1893200000000
54	11dcb08ba41ff2d76539561bf8aa6e53630604492ef49996374b2e9216cac194	1893250000000
55	a8008897fb8eb820d6318cac46a28d4f1e745cd58950af59bd71865c44e81fc6	1893300000000
56	4626f2016d5da4fc2c3c50602ecdfa2dd462afadc0eb7a8fe3dd938726f62fc5	1893350000000
57	9670e3435dc0c673c90626bd26a505fc579bcac28f05587f55f0db058c29817e	1893400000000
58	7295b507b204e204f9dd943c673f3fd43894ad783b013ff95f4ae5698c2ae156	1893450000000
59	4f1da9dc9d7b421338fcf8f655308c04fc9ea8551bdcdb3d006016a42ffd119e	1893500000000
60	072c7f8a3b19cfe5a98761df0185f806da2557cab948bfac9d4adc188678c411	1893550000000
61	3937f5d940fc61034349cf6606235657b75b1ff798c9461c70e3c281320a6779	1893600000000
62	beda991739f77a6ae32bc4e5e033a72fc333c3119d7d61b0f943e9a19a4a5833	1893650000000
63	3235ca69177ea59dfb394d7096ae38bd8bd880d0ccb14cc8b97ebd49a26e07d7	1893700000000
64	5167c55c9932c568186f6e5314f364f49f7d563c0fcf3a8a982b332799edf3a1	1893750000000
65	cb6ad87f349d429ed11c273478433e2a411884ef404bed31f45e937dd4738829	1893800000000
66	8ece1b3732c4c68ee112eafc96fa5c393f015f9daf4b37c6424d0863f41ad85f	1893850000000
67	79af966927bc6208ca41e078c5a1bd777bbb4e221b2f3b776f63eb28e21e8c8f	1893900000000
68	5bca5c931658a6fbbeb71e9a6af3823455af20f40e0e519db837ab20f4b3d3f2	1893950000000
69	6eb08a785b0562ec75e58ed16ae6a160914616f03cab69bd58e039b8fd37acdd	1894000000000
70	145721419c4842fb13db8ef60e0aa059e681178aa83a58be21a58d4558a8ece3	1894050000000
\.


--
-- TOC entry 5695 (class 0 OID 65290)
-- Dependencies: 226
-- Data for Name: add_deal_form; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.add_deal_form (id, organization_id, deal_name, deal_type, deal_stage, sec_type, close_date, owning_entity_name, funds_required_before_gp_sign, auto_send_funding_instructions, property_name, country, address_line_1, address_line_2, city, state, zip_code, asset_image_path, investor_summary_html, gallery_cover_image_url, key_highlights_json, deal_announcement_title, deal_announcement_message, offering_status, offering_visibility, show_on_investbase, internal_name, offering_overview_asset_ids, offering_gallery_paths, created_at, offering_preview_token, offering_investor_preview_json, esign_templates_json, investor_questionnaire_json, funding_instructions_json, offering_overview_class_id, archived, class_setup_json, distribution_setup_json) FROM stdin;
\.


--
-- TOC entry 5704 (class 0 OID 65585)
-- Dependencies: 235
-- Data for Name: assigning_deal_user; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.assigning_deal_user (deal_id, user_id, user_added_deal) FROM stdin;
\.


--
-- TOC entry 5692 (class 0 OID 65227)
-- Dependencies: 223
-- Data for Name: companies; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.companies (id, name, status, created_at, updated_at, ghl_location_id, ghl_location_status, ghl_location_error, ghl_location_provisioned_at, stripe_customer_id, stripe_subscription_id, stripe_plan_id, stripe_billing_cycle, stripe_subscription_status, stripe_price_id, stripe_current_period_end, stripe_last_payment_error, stripe_last_payment_failed_at) FROM stdin;
3f8a9c1e-2b4d-4f6a-8c7e-1d0e9a8b7c6d	Massive Capital	active	2026-07-31 17:40:54.068758+05:30	2026-07-31 17:40:54.068758+05:30	\N	pending	\N	\N	\N	\N	\N	\N	none	\N	\N	\N	\N
\.


--
-- TOC entry 5697 (class 0 OID 65359)
-- Dependencies: 228
-- Data for Name: company_admin_audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.company_admin_audit_logs (id, actor_user_id, target_company_id, action, reason, changes_json, created_at) FROM stdin;
\.


--
-- TOC entry 5721 (class 0 OID 66139)
-- Dependencies: 252
-- Data for Name: company_billing_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.company_billing_events (id, company_id, stripe_event_id, event_type, stripe_invoice_id, stripe_subscription_id, stripe_customer_id, message, payload, created_at) FROM stdin;
\.


--
-- TOC entry 5720 (class 0 OID 66107)
-- Dependencies: 251
-- Data for Name: company_billing_invoices; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.company_billing_invoices (id, company_id, stripe_invoice_id, stripe_customer_id, stripe_subscription_id, invoice_number, status, currency, amount_due_cents, amount_paid_cents, amount_remaining_cents, hosted_invoice_url, invoice_pdf, payment_failure_message, payment_failed_at, paid_at, invoice_date, due_date, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5722 (class 0 OID 66158)
-- Dependencies: 253
-- Data for Name: company_billing_payment_methods; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.company_billing_payment_methods (id, company_id, stripe_payment_method_id, stripe_customer_id, type, brand, last4, exp_month, exp_year, funding, country, fingerprint, billing_name, billing_email, billing_phone, billing_address, is_default, livemode, stripe_created_at, stripe_payload, detached_at, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5701 (class 0 OID 65505)
-- Dependencies: 232
-- Data for Name: company_workspace_tab_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.company_workspace_tab_settings (company_id, tab_key, payload, updated_at) FROM stdin;
\.


--
-- TOC entry 5700 (class 0 OID 65472)
-- Dependencies: 231
-- Data for Name: contact; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.contact (id, first_name, last_name, email, phone, note, tags, lists, owners, created_by, created_at, status, last_edit_reason, is_portal_user, organization_id, platform_admin_only, full_name) FROM stdin;
\.


--
-- TOC entry 5710 (class 0 OID 65777)
-- Dependencies: 241
-- Data for Name: contact_email_template; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.contact_email_template (id, organization_id, name, subject, body, attachment, archived, created_by, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5723 (class 0 OID 66191)
-- Dependencies: 254
-- Data for Name: deal_asset; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.deal_asset (id, deal_id, client_asset_id, property_name, country, street_address_1, street_address_2, city, state, zip_code, address_display, asset_type, image_count, archived, additional_info_json, attr_rows_json, image_preview_urls_json, sort_order, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5698 (class 0 OID 65384)
-- Dependencies: 229
-- Data for Name: deal_investment; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.deal_investment (id, deal_id, offering_id, contact_id, profile_id, status, investor_class, doc_signed_date, commitment_amount, extra_contribution_amounts, document_storage_path, created_at, contact_display_name, investor_role, user_investor_profile_id, fund_approved, fund_approved_commitment_snapshot, fund_approved_by, fund_approved_at, esign_status_json, investor_questionnaire_answers_json, investor_w9_form_json, funding_method) FROM stdin;
\.


--
-- TOC entry 5699 (class 0 OID 65427)
-- Dependencies: 230
-- Data for Name: deal_investor_class; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.deal_investor_class (id, deal_id, name, subscription_type, entity_name, start_date, offering_size, raise_amount_distributions, billing_raise_quota, minimum_investment, price_per_unit, status, visibility, advanced_options_json, created_at, updated_at, number_of_units) FROM stdin;
\.


--
-- TOC entry 5703 (class 0 OID 65554)
-- Dependencies: 234
-- Data for Name: deal_lp_investor; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.deal_lp_investor (id, deal_id, added_by, contact_member_id, investor_class, send_invitation_mail, created_at, updated_at, profile_id, email, role, committed_amount, user_investor_profile_id, doc_signed_date, esign_status_json, percent_of_class_ownership, percent_of_class_distributions) FROM stdin;
\.


--
-- TOC entry 5702 (class 0 OID 65523)
-- Dependencies: 233
-- Data for Name: deal_member; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.deal_member (id, deal_id, added_by, contact_member_id, deal_member_role, send_invitation_mail, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5693 (class 0 OID 65241)
-- Dependencies: 224
-- Data for Name: deals; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.deals (id, company_id, created_at) FROM stdin;
\.


--
-- TOC entry 5715 (class 0 OID 65937)
-- Dependencies: 246
-- Data for Name: esign_reusable_template; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.esign_reusable_template (id, organization_id, name, dropbox_sign_template_id, dropbox_sign_status, roles, relative_path, original_name, created_by, created_at, updated_at, archived) FROM stdin;
\.


--
-- TOC entry 5726 (class 0 OID 66735)
-- Dependencies: 257
-- Data for Name: etl_column_mapping; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.etl_column_mapping (mapping_id, upload_type, excel_column_name, database_column_name, data_type, required_flag, created_at) FROM stdin;
\.


--
-- TOC entry 5728 (class 0 OID 66749)
-- Dependencies: 259
-- Data for Name: etl_error_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.etl_error_log (error_id, job_id, row_number, column_name, error_type, error_message, stack_trace, created_date) FROM stdin;
\.


--
-- TOC entry 5730 (class 0 OID 66759)
-- Dependencies: 261
-- Data for Name: etl_file_tracking; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.etl_file_tracking (file_id, job_id, file_name, file_size, file_path, upload_time, file_status) FROM stdin;
\.


--
-- TOC entry 5732 (class 0 OID 66770)
-- Dependencies: 263
-- Data for Name: etl_job_master; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.etl_job_master (job_id, job_type, file_name, status, start_time, end_time, total_records, success_count, failed_count, created_by, created_at) FROM stdin;
\.


--
-- TOC entry 5734 (class 0 OID 66785)
-- Dependencies: 265
-- Data for Name: etl_media_uploads; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.etl_media_uploads (media_id, entity_type, media_type, document_section, deal_id, organization_id, original_name, stored_name, file_path, file_size, mime_type, created_by, created_at) FROM stdin;
\.


--
-- TOC entry 5736 (class 0 OID 66799)
-- Dependencies: 267
-- Data for Name: etl_record_status; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.etl_record_status (record_status_id, job_id, row_number, status, entity_id, error_message, created_at, updated_at, column_name) FROM stdin;
\.


--
-- TOC entry 5738 (class 0 OID 66811)
-- Dependencies: 269
-- Data for Name: etl_stage_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.etl_stage_log (stage_log_id, job_id, stage_name, status, start_time, end_time, message) FROM stdin;
\.


--
-- TOC entry 5716 (class 0 OID 65971)
-- Dependencies: 247
-- Data for Name: investment_signatures; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.investment_signatures (id, investment_id, investor_id, signature_request_id, status, sign_url, sent_at, viewed_at, signed_at, completed_at, dropbox_response, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5724 (class 0 OID 66257)
-- Dependencies: 255
-- Data for Name: investor_checkout_payments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.investor_checkout_payments (id, investment_id, deal_id, investor_user_id, stripe_checkout_session_id, stripe_payment_intent_id, amount_cents, currency, status, failure_message, paid_at, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5712 (class 0 OID 65828)
-- Dependencies: 243
-- Data for Name: investor_communication_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.investor_communication_logs (id, template_id, deal_id, sender_id, sender_name, subject, recipient_users, mail_status, sent_at, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5725 (class 0 OID 66298)
-- Dependencies: 256
-- Data for Name: investor_distribution_payouts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.investor_distribution_payouts (id, deal_id, distribution_id, investment_id, user_investor_profile_id, investor_user_id, initiated_by_user_id, amount_cents, currency, stripe_connected_account_id, stripe_transfer_id, stripe_payout_id, status, failure_code, failure_message, initiated_at, paid_at, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5740 (class 0 OID 66822)
-- Dependencies: 271
-- Data for Name: investors; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.investors (id, deal_id, investor_name, email, investment_amount, image_path, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5696 (class 0 OID 65334)
-- Dependencies: 227
-- Data for Name: member_admin_audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.member_admin_audit_logs (id, actor_user_id, target_user_id, action, reason, changes_json, created_at) FROM stdin;
\.


--
-- TOC entry 5706 (class 0 OID 65641)
-- Dependencies: 237
-- Data for Name: organization_contact_list; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.organization_contact_list (id, organization_id, name, created_at) FROM stdin;
\.


--
-- TOC entry 5705 (class 0 OID 65623)
-- Dependencies: 236
-- Data for Name: organization_contact_tag; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.organization_contact_tag (id, organization_id, name, created_at) FROM stdin;
\.


--
-- TOC entry 5718 (class 0 OID 66026)
-- Dependencies: 249
-- Data for Name: platform_signup_notification; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.platform_signup_notification (id, user_id, contact_id, signup_kind, company_name, organization_id, user_email, user_display_name, user_role, created_at) FROM stdin;
\.


--
-- TOC entry 5711 (class 0 OID 65811)
-- Dependencies: 242
-- Data for Name: soc_auth_audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.soc_auth_audit_logs (id, event, outcome, http_status, duration_ms, method, path, identifier, client_ip, requested_machine_ip, request_url, user_agent, user_id, created_at) FROM stdin;
\.


--
-- TOC entry 5719 (class 0 OID 66057)
-- Dependencies: 250
-- Data for Name: user_auth_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_auth_tokens (id, user_id, token_type, token_hash, expires_at, revoked_at, replaced_by_id, portal_session_id, user_agent, client_ip, created_at) FROM stdin;
\.


--
-- TOC entry 5708 (class 0 OID 65691)
-- Dependencies: 239
-- Data for Name: user_beneficiaries; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_beneficiaries (id, user_id, full_name, relationship, tax_id, phone, email, address_query, archived, created_at) FROM stdin;
\.


--
-- TOC entry 5717 (class 0 OID 65997)
-- Dependencies: 248
-- Data for Name: user_company_membership; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_company_membership (id, user_id, company_id, role, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5707 (class 0 OID 65664)
-- Dependencies: 238
-- Data for Name: user_investor_profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_investor_profiles (id, user_id, profile_name, profile_type, added_by, investments_count, archived, created_at, last_edit_reason, form_snapshot, distribution_method, ach_routing_number, ach_account_number, ach_bank_address, ach_bank_name, ach_bank_account_type, bank_account_query, check_payee_name, check_mailing_address_id, is_draft, stripe_connect_account_id, stripe_connect_details_submitted, stripe_connect_charges_enabled, stripe_connect_payouts_enabled, stripe_connect_status, stripe_connect_updated_at) FROM stdin;
\.


--
-- TOC entry 5714 (class 0 OID 65907)
-- Dependencies: 245
-- Data for Name: user_page_navigations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_page_navigations (id, user_id, session_id, page_path, page_label, visit_count, updated_at) FROM stdin;
\.


--
-- TOC entry 5713 (class 0 OID 65891)
-- Dependencies: 244
-- Data for Name: user_portal_sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_portal_sessions (id, user_id, login_at, logout_at) FROM stdin;
\.


--
-- TOC entry 5709 (class 0 OID 65723)
-- Dependencies: 240
-- Data for Name: user_saved_addresses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_saved_addresses (id, user_id, full_name_or_company, country, street1, street2, city, state, zip, check_memo, distribution_note, archived, created_at) FROM stdin;
\.


--
-- TOC entry 5694 (class 0 OID 65256)
-- Dependencies: 225
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, username, password_hash, role, user_status, user_signup_completed, organization_id, first_name, last_name, phone, created_at, updated_at, invite_expires_at) FROM stdin;
b2c15cb6-1678-4819-9d24-6fdd8d192064	platform.admin@example.com	platformadmin	$2b$10$i6AuCoVjx3XxI32s8hRia.d1flK87VWianJ2VFr5l7Mloa1sTPeMe	platform_admin	active	true	3f8a9c1e-2b4d-4f6a-8c7e-1d0e9a8b7c6d	Platform	Admin		2026-03-28 19:32:33.541+05:30	2026-04-27 12:51:58.685+05:30	\N
\.


--
-- TOC entry 5789 (class 0 OID 0)
-- Dependencies: 221
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE SET; Schema: drizzle; Owner: postgres
--

SELECT pg_catalog.setval('drizzle.__drizzle_migrations_id_seq', 70, true);


--
-- TOC entry 5790 (class 0 OID 0)
-- Dependencies: 258
-- Name: etl_column_mapping_mapping_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.etl_column_mapping_mapping_id_seq', 1, false);


--
-- TOC entry 5791 (class 0 OID 0)
-- Dependencies: 260
-- Name: etl_error_log_error_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.etl_error_log_error_id_seq', 1, false);


--
-- TOC entry 5792 (class 0 OID 0)
-- Dependencies: 262
-- Name: etl_file_tracking_file_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.etl_file_tracking_file_id_seq', 1, false);


--
-- TOC entry 5793 (class 0 OID 0)
-- Dependencies: 264
-- Name: etl_job_master_job_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.etl_job_master_job_id_seq', 1, false);


--
-- TOC entry 5794 (class 0 OID 0)
-- Dependencies: 266
-- Name: etl_media_uploads_media_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.etl_media_uploads_media_id_seq', 1, false);


--
-- TOC entry 5795 (class 0 OID 0)
-- Dependencies: 268
-- Name: etl_record_status_record_status_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.etl_record_status_record_status_id_seq', 1, false);


--
-- TOC entry 5796 (class 0 OID 0)
-- Dependencies: 270
-- Name: etl_stage_log_stage_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.etl_stage_log_stage_log_id_seq', 1, false);


--
-- TOC entry 5797 (class 0 OID 0)
-- Dependencies: 272
-- Name: investors_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.investors_id_seq', 1, false);


--
-- TOC entry 5327 (class 2606 OID 65226)
-- Name: __drizzle_migrations __drizzle_migrations_pkey; Type: CONSTRAINT; Schema: drizzle; Owner: postgres
--

ALTER TABLE ONLY drizzle.__drizzle_migrations
    ADD CONSTRAINT __drizzle_migrations_pkey PRIMARY KEY (id);


--
-- TOC entry 5345 (class 2606 OID 65328)
-- Name: add_deal_form add_deal_form_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.add_deal_form
    ADD CONSTRAINT add_deal_form_pkey PRIMARY KEY (id);


--
-- TOC entry 5369 (class 2606 OID 65591)
-- Name: assigning_deal_user assigning_deal_user_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assigning_deal_user
    ADD CONSTRAINT assigning_deal_user_pkey PRIMARY KEY (deal_id, user_id);


--
-- TOC entry 5329 (class 2606 OID 65240)
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- TOC entry 5349 (class 2606 OID 65373)
-- Name: company_admin_audit_logs company_admin_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_admin_audit_logs
    ADD CONSTRAINT company_admin_audit_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 5433 (class 2606 OID 66150)
-- Name: company_billing_events company_billing_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_billing_events
    ADD CONSTRAINT company_billing_events_pkey PRIMARY KEY (id);


--
-- TOC entry 5429 (class 2606 OID 66131)
-- Name: company_billing_invoices company_billing_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_billing_invoices
    ADD CONSTRAINT company_billing_invoices_pkey PRIMARY KEY (id);


--
-- TOC entry 5438 (class 2606 OID 66180)
-- Name: company_billing_payment_methods company_billing_payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_billing_payment_methods
    ADD CONSTRAINT company_billing_payment_methods_pkey PRIMARY KEY (id);


--
-- TOC entry 5359 (class 2606 OID 65517)
-- Name: company_workspace_tab_settings company_workspace_tab_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_workspace_tab_settings
    ADD CONSTRAINT company_workspace_tab_settings_pkey PRIMARY KEY (company_id, tab_key);


--
-- TOC entry 5392 (class 2606 OID 65797)
-- Name: contact_email_template contact_email_template_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_email_template
    ADD CONSTRAINT contact_email_template_pkey PRIMARY KEY (id);


--
-- TOC entry 5357 (class 2606 OID 65496)
-- Name: contact contact_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact
    ADD CONSTRAINT contact_pkey PRIMARY KEY (id);


--
-- TOC entry 5441 (class 2606 OID 66237)
-- Name: deal_asset deal_asset_deal_client_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_asset
    ADD CONSTRAINT deal_asset_deal_client_id_unique UNIQUE (deal_id, client_asset_id);


--
-- TOC entry 5443 (class 2606 OID 66845)
-- Name: deal_asset deal_asset_deal_client_uidx; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_asset
    ADD CONSTRAINT deal_asset_deal_client_uidx UNIQUE (deal_id, client_asset_id);


--
-- TOC entry 5446 (class 2606 OID 66235)
-- Name: deal_asset deal_asset_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_asset
    ADD CONSTRAINT deal_asset_pkey PRIMARY KEY (id);


--
-- TOC entry 5351 (class 2606 OID 65409)
-- Name: deal_investment deal_investment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_investment
    ADD CONSTRAINT deal_investment_pkey PRIMARY KEY (id);


--
-- TOC entry 5354 (class 2606 OID 65464)
-- Name: deal_investor_class deal_investor_class_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_investor_class
    ADD CONSTRAINT deal_investor_class_pkey PRIMARY KEY (id);


--
-- TOC entry 5366 (class 2606 OID 65573)
-- Name: deal_lp_investor deal_lp_investor_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_lp_investor
    ADD CONSTRAINT deal_lp_investor_pkey PRIMARY KEY (id);


--
-- TOC entry 5362 (class 2606 OID 65542)
-- Name: deal_member deal_member_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_member
    ADD CONSTRAINT deal_member_pkey PRIMARY KEY (id);


--
-- TOC entry 5333 (class 2606 OID 65250)
-- Name: deals deals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_pkey PRIMARY KEY (id);


--
-- TOC entry 5412 (class 2606 OID 65957)
-- Name: esign_reusable_template esign_reusable_template_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.esign_reusable_template
    ADD CONSTRAINT esign_reusable_template_pkey PRIMARY KEY (id);


--
-- TOC entry 5461 (class 2606 OID 66847)
-- Name: etl_column_mapping etl_column_mapping_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etl_column_mapping
    ADD CONSTRAINT etl_column_mapping_pkey PRIMARY KEY (mapping_id);


--
-- TOC entry 5463 (class 2606 OID 66849)
-- Name: etl_column_mapping etl_column_mapping_upload_type_excel_column_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etl_column_mapping
    ADD CONSTRAINT etl_column_mapping_upload_type_excel_column_name_key UNIQUE (upload_type, excel_column_name);


--
-- TOC entry 5465 (class 2606 OID 66851)
-- Name: etl_error_log etl_error_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etl_error_log
    ADD CONSTRAINT etl_error_log_pkey PRIMARY KEY (error_id);


--
-- TOC entry 5467 (class 2606 OID 66853)
-- Name: etl_file_tracking etl_file_tracking_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etl_file_tracking
    ADD CONSTRAINT etl_file_tracking_pkey PRIMARY KEY (file_id);


--
-- TOC entry 5469 (class 2606 OID 66855)
-- Name: etl_job_master etl_job_master_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etl_job_master
    ADD CONSTRAINT etl_job_master_pkey PRIMARY KEY (job_id);


--
-- TOC entry 5471 (class 2606 OID 66857)
-- Name: etl_media_uploads etl_media_uploads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etl_media_uploads
    ADD CONSTRAINT etl_media_uploads_pkey PRIMARY KEY (media_id);


--
-- TOC entry 5473 (class 2606 OID 66859)
-- Name: etl_record_status etl_record_status_job_id_row_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etl_record_status
    ADD CONSTRAINT etl_record_status_job_id_row_number_key UNIQUE (job_id, row_number);


--
-- TOC entry 5475 (class 2606 OID 66861)
-- Name: etl_record_status etl_record_status_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etl_record_status
    ADD CONSTRAINT etl_record_status_pkey PRIMARY KEY (record_status_id);


--
-- TOC entry 5477 (class 2606 OID 66863)
-- Name: etl_stage_log etl_stage_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etl_stage_log
    ADD CONSTRAINT etl_stage_log_pkey PRIMARY KEY (stage_log_id);


--
-- TOC entry 5415 (class 2606 OID 65989)
-- Name: investment_signatures investment_signatures_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.investment_signatures
    ADD CONSTRAINT investment_signatures_pkey PRIMARY KEY (id);


--
-- TOC entry 5451 (class 2606 OID 66278)
-- Name: investor_checkout_payments investor_checkout_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.investor_checkout_payments
    ADD CONSTRAINT investor_checkout_payments_pkey PRIMARY KEY (id);


--
-- TOC entry 5399 (class 2606 OID 65850)
-- Name: investor_communication_logs investor_communication_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.investor_communication_logs
    ADD CONSTRAINT investor_communication_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 5457 (class 2606 OID 66322)
-- Name: investor_distribution_payouts investor_distribution_payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.investor_distribution_payouts
    ADD CONSTRAINT investor_distribution_payouts_pkey PRIMARY KEY (id);


--
-- TOC entry 5479 (class 2606 OID 66865)
-- Name: investors investors_deal_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.investors
    ADD CONSTRAINT investors_deal_id_key UNIQUE (deal_id);


--
-- TOC entry 5481 (class 2606 OID 66867)
-- Name: investors investors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.investors
    ADD CONSTRAINT investors_pkey PRIMARY KEY (id);


--
-- TOC entry 5347 (class 2606 OID 65348)
-- Name: member_admin_audit_logs member_admin_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_admin_audit_logs
    ADD CONSTRAINT member_admin_audit_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 5375 (class 2606 OID 65653)
-- Name: organization_contact_list organization_contact_list_org_name_uidx; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_contact_list
    ADD CONSTRAINT organization_contact_list_org_name_uidx UNIQUE (organization_id, name);


--
-- TOC entry 5377 (class 2606 OID 65651)
-- Name: organization_contact_list organization_contact_list_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_contact_list
    ADD CONSTRAINT organization_contact_list_pkey PRIMARY KEY (id);


--
-- TOC entry 5371 (class 2606 OID 65635)
-- Name: organization_contact_tag organization_contact_tag_org_name_uidx; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_contact_tag
    ADD CONSTRAINT organization_contact_tag_org_name_uidx UNIQUE (organization_id, name);


--
-- TOC entry 5373 (class 2606 OID 65633)
-- Name: organization_contact_tag organization_contact_tag_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_contact_tag
    ADD CONSTRAINT organization_contact_tag_pkey PRIMARY KEY (id);


--
-- TOC entry 5421 (class 2606 OID 66041)
-- Name: platform_signup_notification platform_signup_notification_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.platform_signup_notification
    ADD CONSTRAINT platform_signup_notification_pkey PRIMARY KEY (id);


--
-- TOC entry 5396 (class 2606 OID 65825)
-- Name: soc_auth_audit_logs soc_auth_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.soc_auth_audit_logs
    ADD CONSTRAINT soc_auth_audit_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 5425 (class 2606 OID 66072)
-- Name: user_auth_tokens user_auth_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_auth_tokens
    ADD CONSTRAINT user_auth_tokens_pkey PRIMARY KEY (id);


--
-- TOC entry 5383 (class 2606 OID 65716)
-- Name: user_beneficiaries user_beneficiaries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_beneficiaries
    ADD CONSTRAINT user_beneficiaries_pkey PRIMARY KEY (id);


--
-- TOC entry 5418 (class 2606 OID 66010)
-- Name: user_company_membership user_company_membership_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_company_membership
    ADD CONSTRAINT user_company_membership_pkey PRIMARY KEY (id);


--
-- TOC entry 5379 (class 2606 OID 65684)
-- Name: user_investor_profiles user_investor_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_investor_profiles
    ADD CONSTRAINT user_investor_profiles_pkey PRIMARY KEY (id);


--
-- TOC entry 5405 (class 2606 OID 65924)
-- Name: user_page_navigations user_page_navigations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_page_navigations
    ADD CONSTRAINT user_page_navigations_pkey PRIMARY KEY (id);


--
-- TOC entry 5402 (class 2606 OID 65900)
-- Name: user_portal_sessions user_portal_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_portal_sessions
    ADD CONSTRAINT user_portal_sessions_pkey PRIMARY KEY (id);


--
-- TOC entry 5386 (class 2606 OID 65754)
-- Name: user_saved_addresses user_saved_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_saved_addresses
    ADD CONSTRAINT user_saved_addresses_pkey PRIMARY KEY (id);


--
-- TOC entry 5335 (class 2606 OID 66869)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 5337 (class 2606 OID 65287)
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- TOC entry 5339 (class 2606 OID 65285)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 5341 (class 2606 OID 66871)
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- TOC entry 5343 (class 2606 OID 65289)
-- Name: users users_username_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_unique UNIQUE (username);


--
-- TOC entry 5330 (class 1259 OID 66105)
-- Name: companies_stripe_customer_id_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX companies_stripe_customer_id_uidx ON public.companies USING btree (stripe_customer_id) WHERE (stripe_customer_id IS NOT NULL);


--
-- TOC entry 5331 (class 1259 OID 66106)
-- Name: companies_stripe_subscription_id_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX companies_stripe_subscription_id_uidx ON public.companies USING btree (stripe_subscription_id) WHERE (stripe_subscription_id IS NOT NULL);


--
-- TOC entry 5431 (class 1259 OID 66157)
-- Name: company_billing_events_company_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX company_billing_events_company_idx ON public.company_billing_events USING btree (company_id);


--
-- TOC entry 5434 (class 1259 OID 66156)
-- Name: company_billing_events_stripe_event_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX company_billing_events_stripe_event_uidx ON public.company_billing_events USING btree (stripe_event_id);


--
-- TOC entry 5427 (class 1259 OID 66138)
-- Name: company_billing_invoices_company_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX company_billing_invoices_company_idx ON public.company_billing_invoices USING btree (company_id);


--
-- TOC entry 5430 (class 1259 OID 66137)
-- Name: company_billing_invoices_stripe_invoice_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX company_billing_invoices_stripe_invoice_uidx ON public.company_billing_invoices USING btree (stripe_invoice_id);


--
-- TOC entry 5435 (class 1259 OID 66187)
-- Name: company_billing_payment_methods_company_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX company_billing_payment_methods_company_idx ON public.company_billing_payment_methods USING btree (company_id);


--
-- TOC entry 5436 (class 1259 OID 66188)
-- Name: company_billing_payment_methods_customer_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX company_billing_payment_methods_customer_idx ON public.company_billing_payment_methods USING btree (stripe_customer_id);


--
-- TOC entry 5439 (class 1259 OID 66186)
-- Name: company_billing_payment_methods_stripe_pm_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX company_billing_payment_methods_stripe_pm_uidx ON public.company_billing_payment_methods USING btree (stripe_payment_method_id);


--
-- TOC entry 5388 (class 1259 OID 65810)
-- Name: contact_email_template_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX contact_email_template_created_at_idx ON public.contact_email_template USING btree (created_at);


--
-- TOC entry 5389 (class 1259 OID 65809)
-- Name: contact_email_template_created_by_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX contact_email_template_created_by_idx ON public.contact_email_template USING btree (created_by);


--
-- TOC entry 5390 (class 1259 OID 65808)
-- Name: contact_email_template_organization_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX contact_email_template_organization_id_idx ON public.contact_email_template USING btree (organization_id);


--
-- TOC entry 5355 (class 1259 OID 65617)
-- Name: contact_organization_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX contact_organization_id_idx ON public.contact USING btree (organization_id);


--
-- TOC entry 5444 (class 1259 OID 66243)
-- Name: deal_asset_deal_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX deal_asset_deal_id_idx ON public.deal_asset USING btree (deal_id);


--
-- TOC entry 5352 (class 1259 OID 65766)
-- Name: deal_investment_user_investor_profile_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX deal_investment_user_investor_profile_id_idx ON public.deal_investment USING btree (user_investor_profile_id);


--
-- TOC entry 5363 (class 1259 OID 65584)
-- Name: deal_lp_investor_deal_id_contact_member_id_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX deal_lp_investor_deal_id_contact_member_id_uidx ON public.deal_lp_investor USING btree (deal_id, contact_member_id);


--
-- TOC entry 5364 (class 1259 OID 65661)
-- Name: deal_lp_investor_email_lower_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX deal_lp_investor_email_lower_idx ON public.deal_lp_investor USING btree (lower(TRIM(BOTH FROM email))) WHERE (NULLIF(TRIM(BOTH FROM email), ''::text) IS NOT NULL);


--
-- TOC entry 5367 (class 1259 OID 65772)
-- Name: deal_lp_investor_user_investor_profile_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX deal_lp_investor_user_investor_profile_id_idx ON public.deal_lp_investor USING btree (user_investor_profile_id);


--
-- TOC entry 5360 (class 1259 OID 65553)
-- Name: deal_member_deal_id_contact_member_id_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX deal_member_deal_id_contact_member_id_uidx ON public.deal_member USING btree (deal_id, contact_member_id);


--
-- TOC entry 5408 (class 1259 OID 65970)
-- Name: esign_reusable_template_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX esign_reusable_template_created_at_idx ON public.esign_reusable_template USING btree (created_at);


--
-- TOC entry 5409 (class 1259 OID 65969)
-- Name: esign_reusable_template_created_by_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX esign_reusable_template_created_by_idx ON public.esign_reusable_template USING btree (created_by);


--
-- TOC entry 5410 (class 1259 OID 65968)
-- Name: esign_reusable_template_organization_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX esign_reusable_template_organization_id_idx ON public.esign_reusable_template USING btree (organization_id);


--
-- TOC entry 5413 (class 1259 OID 65996)
-- Name: investment_signatures_investment_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX investment_signatures_investment_id_idx ON public.investment_signatures USING btree (investment_id);


--
-- TOC entry 5416 (class 1259 OID 65995)
-- Name: investment_signatures_signature_request_id_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX investment_signatures_signature_request_id_uidx ON public.investment_signatures USING btree (signature_request_id);


--
-- TOC entry 5447 (class 1259 OID 66297)
-- Name: investor_checkout_payments_deal_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX investor_checkout_payments_deal_idx ON public.investor_checkout_payments USING btree (deal_id);


--
-- TOC entry 5448 (class 1259 OID 66296)
-- Name: investor_checkout_payments_investment_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX investor_checkout_payments_investment_idx ON public.investor_checkout_payments USING btree (investment_id);


--
-- TOC entry 5449 (class 1259 OID 66295)
-- Name: investor_checkout_payments_pi_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX investor_checkout_payments_pi_uidx ON public.investor_checkout_payments USING btree (stripe_payment_intent_id) WHERE (stripe_payment_intent_id IS NOT NULL);


--
-- TOC entry 5452 (class 1259 OID 66294)
-- Name: investor_checkout_payments_session_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX investor_checkout_payments_session_uidx ON public.investor_checkout_payments USING btree (stripe_checkout_session_id);


--
-- TOC entry 5397 (class 1259 OID 65866)
-- Name: investor_communication_logs_deal_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX investor_communication_logs_deal_id_idx ON public.investor_communication_logs USING btree (deal_id);


--
-- TOC entry 5400 (class 1259 OID 65867)
-- Name: investor_communication_logs_sent_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX investor_communication_logs_sent_at_idx ON public.investor_communication_logs USING btree (sent_at);


--
-- TOC entry 5453 (class 1259 OID 66351)
-- Name: investor_distribution_payouts_distribution_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX investor_distribution_payouts_distribution_idx ON public.investor_distribution_payouts USING btree (deal_id, distribution_id);


--
-- TOC entry 5454 (class 1259 OID 66348)
-- Name: investor_distribution_payouts_line_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX investor_distribution_payouts_line_uidx ON public.investor_distribution_payouts USING btree (deal_id, distribution_id, investment_id);


--
-- TOC entry 5455 (class 1259 OID 66350)
-- Name: investor_distribution_payouts_payout_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX investor_distribution_payouts_payout_uidx ON public.investor_distribution_payouts USING btree (stripe_payout_id) WHERE (stripe_payout_id IS NOT NULL);


--
-- TOC entry 5458 (class 1259 OID 66352)
-- Name: investor_distribution_payouts_profile_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX investor_distribution_payouts_profile_idx ON public.investor_distribution_payouts USING btree (user_investor_profile_id);


--
-- TOC entry 5459 (class 1259 OID 66349)
-- Name: investor_distribution_payouts_transfer_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX investor_distribution_payouts_transfer_uidx ON public.investor_distribution_payouts USING btree (stripe_transfer_id) WHERE (stripe_transfer_id IS NOT NULL);


--
-- TOC entry 5393 (class 1259 OID 65826)
-- Name: soc_auth_audit_logs_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX soc_auth_audit_logs_created_at_idx ON public.soc_auth_audit_logs USING btree (created_at DESC);


--
-- TOC entry 5394 (class 1259 OID 65827)
-- Name: soc_auth_audit_logs_event_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX soc_auth_audit_logs_event_idx ON public.soc_auth_audit_logs USING btree (event);


--
-- TOC entry 5422 (class 1259 OID 66090)
-- Name: user_auth_tokens_expires_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_auth_tokens_expires_idx ON public.user_auth_tokens USING btree (expires_at);


--
-- TOC entry 5423 (class 1259 OID 66088)
-- Name: user_auth_tokens_hash_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX user_auth_tokens_hash_uidx ON public.user_auth_tokens USING btree (token_hash);


--
-- TOC entry 5426 (class 1259 OID 66089)
-- Name: user_auth_tokens_user_type_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_auth_tokens_user_type_active_idx ON public.user_auth_tokens USING btree (user_id, token_type) WHERE (revoked_at IS NULL);


--
-- TOC entry 5384 (class 1259 OID 65722)
-- Name: user_beneficiaries_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_beneficiaries_user_id_idx ON public.user_beneficiaries USING btree (user_id);


--
-- TOC entry 5419 (class 1259 OID 66021)
-- Name: user_company_membership_user_company_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX user_company_membership_user_company_uidx ON public.user_company_membership USING btree (user_id, company_id);


--
-- TOC entry 5380 (class 1259 OID 66256)
-- Name: user_investor_profiles_stripe_connect_account_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX user_investor_profiles_stripe_connect_account_uidx ON public.user_investor_profiles USING btree (stripe_connect_account_id) WHERE (stripe_connect_account_id IS NOT NULL);


--
-- TOC entry 5381 (class 1259 OID 65690)
-- Name: user_investor_profiles_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_investor_profiles_user_id_idx ON public.user_investor_profiles USING btree (user_id);


--
-- TOC entry 5406 (class 1259 OID 65935)
-- Name: user_page_navigations_session_path_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX user_page_navigations_session_path_uidx ON public.user_page_navigations USING btree (session_id, page_path);


--
-- TOC entry 5407 (class 1259 OID 65936)
-- Name: user_page_navigations_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_page_navigations_user_idx ON public.user_page_navigations USING btree (user_id);


--
-- TOC entry 5403 (class 1259 OID 65906)
-- Name: user_portal_sessions_user_login_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_portal_sessions_user_login_idx ON public.user_portal_sessions USING btree (user_id, login_at DESC);


--
-- TOC entry 5387 (class 1259 OID 65760)
-- Name: user_saved_addresses_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_saved_addresses_user_id_idx ON public.user_saved_addresses USING btree (user_id);


--
-- TOC entry 5484 (class 2606 OID 65329)
-- Name: add_deal_form add_deal_form_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.add_deal_form
    ADD CONSTRAINT add_deal_form_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- TOC entry 5500 (class 2606 OID 65592)
-- Name: assigning_deal_user assigning_deal_user_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assigning_deal_user
    ADD CONSTRAINT assigning_deal_user_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.add_deal_form(id) ON DELETE CASCADE;


--
-- TOC entry 5501 (class 2606 OID 65602)
-- Name: assigning_deal_user assigning_deal_user_user_added_deal_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assigning_deal_user
    ADD CONSTRAINT assigning_deal_user_user_added_deal_fkey FOREIGN KEY (user_added_deal) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 5502 (class 2606 OID 65597)
-- Name: assigning_deal_user assigning_deal_user_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assigning_deal_user
    ADD CONSTRAINT assigning_deal_user_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5487 (class 2606 OID 65374)
-- Name: company_admin_audit_logs company_admin_audit_logs_actor_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_admin_audit_logs
    ADD CONSTRAINT company_admin_audit_logs_actor_user_id_users_id_fk FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 5488 (class 2606 OID 65379)
-- Name: company_admin_audit_logs company_admin_audit_logs_target_company_id_companies_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_admin_audit_logs
    ADD CONSTRAINT company_admin_audit_logs_target_company_id_companies_id_fk FOREIGN KEY (target_company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;


--
-- TOC entry 5528 (class 2606 OID 66151)
-- Name: company_billing_events company_billing_events_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_billing_events
    ADD CONSTRAINT company_billing_events_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- TOC entry 5527 (class 2606 OID 66132)
-- Name: company_billing_invoices company_billing_invoices_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_billing_invoices
    ADD CONSTRAINT company_billing_invoices_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- TOC entry 5529 (class 2606 OID 66181)
-- Name: company_billing_payment_methods company_billing_payment_methods_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_billing_payment_methods
    ADD CONSTRAINT company_billing_payment_methods_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- TOC entry 5494 (class 2606 OID 65518)
-- Name: company_workspace_tab_settings company_workspace_tab_settings_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_workspace_tab_settings
    ADD CONSTRAINT company_workspace_tab_settings_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- TOC entry 5492 (class 2606 OID 65497)
-- Name: contact contact_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact
    ADD CONSTRAINT contact_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 5508 (class 2606 OID 65803)
-- Name: contact_email_template contact_email_template_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_email_template
    ADD CONSTRAINT contact_email_template_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 5509 (class 2606 OID 65798)
-- Name: contact_email_template contact_email_template_organization_id_companies_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_email_template
    ADD CONSTRAINT contact_email_template_organization_id_companies_id_fk FOREIGN KEY (organization_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- TOC entry 5493 (class 2606 OID 65612)
-- Name: contact contact_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact
    ADD CONSTRAINT contact_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- TOC entry 5530 (class 2606 OID 66238)
-- Name: deal_asset deal_asset_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_asset
    ADD CONSTRAINT deal_asset_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.add_deal_form(id) ON DELETE CASCADE;


--
-- TOC entry 5489 (class 2606 OID 65410)
-- Name: deal_investment deal_investment_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_investment
    ADD CONSTRAINT deal_investment_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.add_deal_form(id) ON DELETE CASCADE;


--
-- TOC entry 5490 (class 2606 OID 65761)
-- Name: deal_investment deal_investment_user_investor_profile_id_user_investor_profiles; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_investment
    ADD CONSTRAINT deal_investment_user_investor_profile_id_user_investor_profiles FOREIGN KEY (user_investor_profile_id) REFERENCES public.user_investor_profiles(id) ON DELETE SET NULL;


--
-- TOC entry 5491 (class 2606 OID 65465)
-- Name: deal_investor_class deal_investor_class_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_investor_class
    ADD CONSTRAINT deal_investor_class_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.add_deal_form(id) ON DELETE CASCADE;


--
-- TOC entry 5497 (class 2606 OID 65579)
-- Name: deal_lp_investor deal_lp_investor_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_lp_investor
    ADD CONSTRAINT deal_lp_investor_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 5498 (class 2606 OID 65574)
-- Name: deal_lp_investor deal_lp_investor_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_lp_investor
    ADD CONSTRAINT deal_lp_investor_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.add_deal_form(id) ON DELETE CASCADE;


--
-- TOC entry 5499 (class 2606 OID 65767)
-- Name: deal_lp_investor deal_lp_investor_user_investor_profile_id_user_investor_profile; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_lp_investor
    ADD CONSTRAINT deal_lp_investor_user_investor_profile_id_user_investor_profile FOREIGN KEY (user_investor_profile_id) REFERENCES public.user_investor_profiles(id) ON DELETE SET NULL;


--
-- TOC entry 5495 (class 2606 OID 65548)
-- Name: deal_member deal_member_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_member
    ADD CONSTRAINT deal_member_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 5496 (class 2606 OID 65543)
-- Name: deal_member deal_member_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_member
    ADD CONSTRAINT deal_member_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.add_deal_form(id) ON DELETE CASCADE;


--
-- TOC entry 5482 (class 2606 OID 65251)
-- Name: deals deals_company_id_companies_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_company_id_companies_id_fk FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- TOC entry 5516 (class 2606 OID 65963)
-- Name: esign_reusable_template esign_reusable_template_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.esign_reusable_template
    ADD CONSTRAINT esign_reusable_template_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 5517 (class 2606 OID 65958)
-- Name: esign_reusable_template esign_reusable_template_organization_id_companies_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.esign_reusable_template
    ADD CONSTRAINT esign_reusable_template_organization_id_companies_id_fk FOREIGN KEY (organization_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- TOC entry 5539 (class 2606 OID 66872)
-- Name: etl_error_log etl_error_log_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etl_error_log
    ADD CONSTRAINT etl_error_log_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.etl_job_master(job_id);


--
-- TOC entry 5540 (class 2606 OID 66877)
-- Name: etl_file_tracking etl_file_tracking_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etl_file_tracking
    ADD CONSTRAINT etl_file_tracking_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.etl_job_master(job_id);


--
-- TOC entry 5541 (class 2606 OID 66882)
-- Name: etl_record_status etl_record_status_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etl_record_status
    ADD CONSTRAINT etl_record_status_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.etl_job_master(job_id);


--
-- TOC entry 5542 (class 2606 OID 66887)
-- Name: etl_stage_log etl_stage_log_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etl_stage_log
    ADD CONSTRAINT etl_stage_log_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.etl_job_master(job_id);


--
-- TOC entry 5518 (class 2606 OID 65990)
-- Name: investment_signatures investment_signatures_investment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.investment_signatures
    ADD CONSTRAINT investment_signatures_investment_id_fkey FOREIGN KEY (investment_id) REFERENCES public.deal_investment(id) ON DELETE CASCADE;


--
-- TOC entry 5531 (class 2606 OID 66284)
-- Name: investor_checkout_payments investor_checkout_payments_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.investor_checkout_payments
    ADD CONSTRAINT investor_checkout_payments_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.add_deal_form(id) ON DELETE CASCADE;


--
-- TOC entry 5532 (class 2606 OID 66279)
-- Name: investor_checkout_payments investor_checkout_payments_investment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.investor_checkout_payments
    ADD CONSTRAINT investor_checkout_payments_investment_id_fkey FOREIGN KEY (investment_id) REFERENCES public.deal_investment(id) ON DELETE CASCADE;


--
-- TOC entry 5533 (class 2606 OID 66289)
-- Name: investor_checkout_payments investor_checkout_payments_investor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.investor_checkout_payments
    ADD CONSTRAINT investor_checkout_payments_investor_user_id_fkey FOREIGN KEY (investor_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5510 (class 2606 OID 65868)
-- Name: investor_communication_logs investor_communication_logs_deal_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.investor_communication_logs
    ADD CONSTRAINT investor_communication_logs_deal_id_fk FOREIGN KEY (deal_id) REFERENCES public.add_deal_form(id) ON DELETE CASCADE;


--
-- TOC entry 5511 (class 2606 OID 65861)
-- Name: investor_communication_logs investor_communication_logs_sender_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.investor_communication_logs
    ADD CONSTRAINT investor_communication_logs_sender_id_fk FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 5512 (class 2606 OID 65851)
-- Name: investor_communication_logs investor_communication_logs_template_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.investor_communication_logs
    ADD CONSTRAINT investor_communication_logs_template_id_fk FOREIGN KEY (template_id) REFERENCES public.contact_email_template(id) ON DELETE SET NULL;


--
-- TOC entry 5534 (class 2606 OID 66323)
-- Name: investor_distribution_payouts investor_distribution_payouts_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.investor_distribution_payouts
    ADD CONSTRAINT investor_distribution_payouts_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.add_deal_form(id) ON DELETE CASCADE;


--
-- TOC entry 5535 (class 2606 OID 66343)
-- Name: investor_distribution_payouts investor_distribution_payouts_initiated_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.investor_distribution_payouts
    ADD CONSTRAINT investor_distribution_payouts_initiated_by_user_id_fkey FOREIGN KEY (initiated_by_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 5536 (class 2606 OID 66328)
-- Name: investor_distribution_payouts investor_distribution_payouts_investment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.investor_distribution_payouts
    ADD CONSTRAINT investor_distribution_payouts_investment_id_fkey FOREIGN KEY (investment_id) REFERENCES public.deal_investment(id) ON DELETE RESTRICT;


--
-- TOC entry 5537 (class 2606 OID 66338)
-- Name: investor_distribution_payouts investor_distribution_payouts_investor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.investor_distribution_payouts
    ADD CONSTRAINT investor_distribution_payouts_investor_user_id_fkey FOREIGN KEY (investor_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 5538 (class 2606 OID 66333)
-- Name: investor_distribution_payouts investor_distribution_payouts_user_investor_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.investor_distribution_payouts
    ADD CONSTRAINT investor_distribution_payouts_user_investor_profile_id_fkey FOREIGN KEY (user_investor_profile_id) REFERENCES public.user_investor_profiles(id) ON DELETE RESTRICT;


--
-- TOC entry 5485 (class 2606 OID 65349)
-- Name: member_admin_audit_logs member_admin_audit_logs_actor_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_admin_audit_logs
    ADD CONSTRAINT member_admin_audit_logs_actor_user_id_users_id_fk FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 5486 (class 2606 OID 65354)
-- Name: member_admin_audit_logs member_admin_audit_logs_target_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_admin_audit_logs
    ADD CONSTRAINT member_admin_audit_logs_target_user_id_users_id_fk FOREIGN KEY (target_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5504 (class 2606 OID 65654)
-- Name: organization_contact_list organization_contact_list_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_contact_list
    ADD CONSTRAINT organization_contact_list_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- TOC entry 5503 (class 2606 OID 65636)
-- Name: organization_contact_tag organization_contact_tag_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_contact_tag
    ADD CONSTRAINT organization_contact_tag_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- TOC entry 5521 (class 2606 OID 66047)
-- Name: platform_signup_notification platform_signup_notification_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.platform_signup_notification
    ADD CONSTRAINT platform_signup_notification_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contact(id) ON DELETE SET NULL;


--
-- TOC entry 5522 (class 2606 OID 66052)
-- Name: platform_signup_notification platform_signup_notification_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.platform_signup_notification
    ADD CONSTRAINT platform_signup_notification_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- TOC entry 5523 (class 2606 OID 66042)
-- Name: platform_signup_notification platform_signup_notification_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.platform_signup_notification
    ADD CONSTRAINT platform_signup_notification_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5524 (class 2606 OID 66083)
-- Name: user_auth_tokens user_auth_tokens_portal_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_auth_tokens
    ADD CONSTRAINT user_auth_tokens_portal_session_id_fkey FOREIGN KEY (portal_session_id) REFERENCES public.user_portal_sessions(id) ON DELETE SET NULL;


--
-- TOC entry 5525 (class 2606 OID 66078)
-- Name: user_auth_tokens user_auth_tokens_replaced_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_auth_tokens
    ADD CONSTRAINT user_auth_tokens_replaced_by_id_fkey FOREIGN KEY (replaced_by_id) REFERENCES public.user_auth_tokens(id) ON DELETE SET NULL;


--
-- TOC entry 5526 (class 2606 OID 66073)
-- Name: user_auth_tokens user_auth_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_auth_tokens
    ADD CONSTRAINT user_auth_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5506 (class 2606 OID 65717)
-- Name: user_beneficiaries user_beneficiaries_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_beneficiaries
    ADD CONSTRAINT user_beneficiaries_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5519 (class 2606 OID 66016)
-- Name: user_company_membership user_company_membership_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_company_membership
    ADD CONSTRAINT user_company_membership_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- TOC entry 5520 (class 2606 OID 66011)
-- Name: user_company_membership user_company_membership_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_company_membership
    ADD CONSTRAINT user_company_membership_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5505 (class 2606 OID 65685)
-- Name: user_investor_profiles user_investor_profiles_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_investor_profiles
    ADD CONSTRAINT user_investor_profiles_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5514 (class 2606 OID 65930)
-- Name: user_page_navigations user_page_navigations_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_page_navigations
    ADD CONSTRAINT user_page_navigations_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.user_portal_sessions(id) ON DELETE CASCADE;


--
-- TOC entry 5515 (class 2606 OID 65925)
-- Name: user_page_navigations user_page_navigations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_page_navigations
    ADD CONSTRAINT user_page_navigations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5513 (class 2606 OID 65901)
-- Name: user_portal_sessions user_portal_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_portal_sessions
    ADD CONSTRAINT user_portal_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5507 (class 2606 OID 65755)
-- Name: user_saved_addresses user_saved_addresses_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_saved_addresses
    ADD CONSTRAINT user_saved_addresses_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5483 (class 2606 OID 65618)
-- Name: users users_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.companies(id) ON DELETE SET NULL;


-- Completed on 2026-07-31 17:55:01

--
-- PostgreSQL database dump complete
--

\unrestrict MMvAsUxa6k7O6gSEjQw7gfVPuGFeRSCypmJgk79xhahHjUL5wD7Hi72f1roFiIe

