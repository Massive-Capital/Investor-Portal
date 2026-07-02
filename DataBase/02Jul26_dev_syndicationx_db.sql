--
-- PostgreSQL database dump
--

\restrict cybryiCdpeeKWE3POwRJLzmTmMDXTnBkm3vCHoasCWAg6rxdkEaXxuCax28vJS9

-- Dumped from database version 17.8
-- Dumped by pg_dump version 17.8

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
-- Name: drizzle; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA drizzle;


ALTER SCHEMA drizzle OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: __drizzle_migrations; Type: TABLE; Schema: drizzle; Owner: postgres
--

CREATE TABLE drizzle.__drizzle_migrations (
    id integer NOT NULL,
    hash text NOT NULL,
    created_at bigint
);


ALTER TABLE drizzle.__drizzle_migrations OWNER TO postgres;

--
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
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: drizzle; Owner: postgres
--

ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNED BY drizzle.__drizzle_migrations.id;


--
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
    CONSTRAINT add_deal_form_deal_stage_check CHECK ((deal_stage = ANY (ARRAY['draft'::text, 'Draft'::text, 'raising_capital'::text, 'capital_raising'::text, 'asset_managing'::text, 'managing_asset'::text, 'liquidated'::text])))
);


ALTER TABLE public.add_deal_form OWNER TO postgres;

--
-- Name: COLUMN add_deal_form.archived; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.add_deal_form.archived IS 'When true, deal appears under Archives instead of Active on the syndication deals list.';


--
-- Name: assigning_deal_user; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.assigning_deal_user (
    deal_id uuid NOT NULL,
    user_id uuid NOT NULL,
    user_added_deal uuid
);


ALTER TABLE public.assigning_deal_user OWNER TO postgres;

--
-- Name: companies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.companies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.companies OWNER TO postgres;

--
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
    platform_admin_only boolean DEFAULT false NOT NULL
);


ALTER TABLE public.contact OWNER TO postgres;

--
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
    esign_status_json text
);


ALTER TABLE public.deal_lp_investor OWNER TO postgres;

--
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
-- Name: deals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.deals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.deals OWNER TO postgres;

--
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
    is_draft boolean DEFAULT false NOT NULL
);


ALTER TABLE public.user_investor_profiles OWNER TO postgres;

--
-- Name: TABLE user_investor_profiles; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.user_investor_profiles IS 'Saved investor (LP) profiles: display label, type, and optional add-profile form data per portal user.';


--
-- Name: COLUMN user_investor_profiles.form_snapshot; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_investor_profiles.form_snapshot IS 'Add/edit LP profile wizard: one JSON object with all multi-step form fields (identity, tax, distribution, address IDs, beneficiary). NULL for legacy rows or when only list fields were saved.';


--
-- Name: COLUMN user_investor_profiles.distribution_method; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_investor_profiles.distribution_method IS 'ach | check | other — how distributions are paid for this profile.';


--
-- Name: COLUMN user_investor_profiles.ach_routing_number; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_investor_profiles.ach_routing_number IS '9-digit ABA routing number when distribution_method is ach.';


--
-- Name: COLUMN user_investor_profiles.ach_account_number; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_investor_profiles.ach_account_number IS 'Bank account number when distribution_method is ach.';


--
-- Name: COLUMN user_investor_profiles.ach_bank_address; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_investor_profiles.ach_bank_address IS 'Bank branch / mailing address when distribution_method is ach.';


--
-- Name: COLUMN user_investor_profiles.ach_bank_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_investor_profiles.ach_bank_name IS 'Financial institution name when distribution_method is ach.';


--
-- Name: COLUMN user_investor_profiles.ach_bank_account_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_investor_profiles.ach_bank_account_type IS 'e.g. checking | savings when distribution_method is ach.';


--
-- Name: COLUMN user_investor_profiles.is_draft; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_investor_profiles.is_draft IS 'True while the add-profile wizard is in progress (autosave); false after explicit Save.';


--
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
-- Name: __drizzle_migrations id; Type: DEFAULT; Schema: drizzle; Owner: postgres
--

ALTER TABLE ONLY drizzle.__drizzle_migrations ALTER COLUMN id SET DEFAULT nextval('drizzle.__drizzle_migrations_id_seq'::regclass);


--
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
\.


--
-- Data for Name: add_deal_form; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.add_deal_form (id, organization_id, deal_name, deal_type, deal_stage, sec_type, close_date, owning_entity_name, funds_required_before_gp_sign, auto_send_funding_instructions, property_name, country, address_line_1, address_line_2, city, state, zip_code, asset_image_path, investor_summary_html, gallery_cover_image_url, key_highlights_json, deal_announcement_title, deal_announcement_message, offering_status, offering_visibility, show_on_investbase, internal_name, offering_overview_asset_ids, offering_gallery_paths, created_at, offering_preview_token, offering_investor_preview_json, esign_templates_json, investor_questionnaire_json, funding_instructions_json, offering_overview_class_id, archived) FROM stdin;
\.


--
-- Data for Name: assigning_deal_user; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.assigning_deal_user (deal_id, user_id, user_added_deal) FROM stdin;
\.


--
-- Data for Name: companies; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.companies (id, name, status, created_at, updated_at) FROM stdin;
3f8a9c1e-2b4d-4f6a-8c7e-1d0e9a8b7c6d	Massive Capital	active	2026-06-25 15:39:12.580697+05:30	2026-07-01 15:51:50.941917+05:30
\.


--
-- Data for Name: company_admin_audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.company_admin_audit_logs (id, actor_user_id, target_company_id, action, reason, changes_json, created_at) FROM stdin;
\.


--
-- Data for Name: company_workspace_tab_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.company_workspace_tab_settings (company_id, tab_key, payload, updated_at) FROM stdin;
\.


--
-- Data for Name: contact; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.contact (id, first_name, last_name, email, phone, note, tags, lists, owners, created_by, created_at, status, last_edit_reason, is_portal_user, organization_id, platform_admin_only) FROM stdin;
\.


--
-- Data for Name: contact_email_template; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.contact_email_template (id, organization_id, name, subject, body, attachment, archived, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: deal_investment; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.deal_investment (id, deal_id, offering_id, contact_id, profile_id, status, investor_class, doc_signed_date, commitment_amount, extra_contribution_amounts, document_storage_path, created_at, contact_display_name, investor_role, user_investor_profile_id, fund_approved, fund_approved_commitment_snapshot, fund_approved_by, fund_approved_at, esign_status_json, investor_questionnaire_answers_json, investor_w9_form_json, funding_method) FROM stdin;
\.


--
-- Data for Name: deal_investor_class; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.deal_investor_class (id, deal_id, name, subscription_type, entity_name, start_date, offering_size, raise_amount_distributions, billing_raise_quota, minimum_investment, price_per_unit, status, visibility, advanced_options_json, created_at, updated_at, number_of_units) FROM stdin;
\.


--
-- Data for Name: deal_lp_investor; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.deal_lp_investor (id, deal_id, added_by, contact_member_id, investor_class, send_invitation_mail, created_at, updated_at, profile_id, email, role, committed_amount, user_investor_profile_id, doc_signed_date, esign_status_json) FROM stdin;
\.


--
-- Data for Name: deal_member; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.deal_member (id, deal_id, added_by, contact_member_id, deal_member_role, send_invitation_mail, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: deals; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.deals (id, company_id, created_at) FROM stdin;
\.


--
-- Data for Name: esign_reusable_template; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.esign_reusable_template (id, organization_id, name, dropbox_sign_template_id, dropbox_sign_status, roles, relative_path, original_name, created_by, created_at, updated_at, archived) FROM stdin;
\.


--
-- Data for Name: investment_signatures; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.investment_signatures (id, investment_id, investor_id, signature_request_id, status, sign_url, sent_at, viewed_at, signed_at, completed_at, dropbox_response, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: investor_communication_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.investor_communication_logs (id, template_id, deal_id, sender_id, sender_name, subject, recipient_users, mail_status, sent_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: member_admin_audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.member_admin_audit_logs (id, actor_user_id, target_user_id, action, reason, changes_json, created_at) FROM stdin;
\.


--
-- Data for Name: organization_contact_list; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.organization_contact_list (id, organization_id, name, created_at) FROM stdin;
\.


--
-- Data for Name: organization_contact_tag; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.organization_contact_tag (id, organization_id, name, created_at) FROM stdin;
\.


--
-- Data for Name: platform_signup_notification; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.platform_signup_notification (id, user_id, contact_id, signup_kind, company_name, organization_id, user_email, user_display_name, user_role, created_at) FROM stdin;
\.


--
-- Data for Name: soc_auth_audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.soc_auth_audit_logs (id, event, outcome, http_status, duration_ms, method, path, identifier, client_ip, requested_machine_ip, request_url, user_agent, user_id, created_at) FROM stdin;
8474e745-6b9f-488b-8860-ceb38e60eb52	auth.signin	success	200	489	POST	/api/v1/auth/signin	\N	127.0.0.1	192.168.100.172	http://127.0.0.1:5004/api/v1/auth/signin	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	\N	2026-07-01 15:53:20.572035+05:30
caf5f070-dacb-45b6-8204-c49605d9e483	company.public_branding	success	200	35	GET	/api/v1/public/company-branding/3f8a9c1e-2b4d-4f6a-8c7e-1d0e9a8b7c6d	\N	127.0.0.1	192.168.100.172	http://127.0.0.1:5004/api/v1/public/company-branding/3f8a9c1e-2b4d-4f6a-8c7e-1d0e9a8b7c6d	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	b2c15cb6-1678-4819-9d24-6fdd8d192064	2026-07-01 15:53:20.8027+05:30
7bb23bc9-5afe-4323-aa4a-7c6f259d4e4a	company.public_branding	success	200	93	GET	/api/v1/public/company-branding/3f8a9c1e-2b4d-4f6a-8c7e-1d0e9a8b7c6d	\N	127.0.0.1	192.168.100.172	http://127.0.0.1:5004/api/v1/public/company-branding/3f8a9c1e-2b4d-4f6a-8c7e-1d0e9a8b7c6d	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	b2c15cb6-1678-4819-9d24-6fdd8d192064	2026-07-01 15:53:20.838252+05:30
89a62f77-ea04-4271-a8f5-bee706ef5460	deal.list	success	200	216	GET	/api/v1/deals	\N	127.0.0.1	192.168.100.172	http://127.0.0.1:5004/api/v1/deals?includeParticipantDeals=1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	b2c15cb6-1678-4819-9d24-6fdd8d192064	2026-07-01 15:53:21.071542+05:30
5d8752be-ba47-48ec-af36-7230989e9418	deal.list	success	304	276	GET	/api/v1/deals	\N	127.0.0.1	192.168.100.172	http://127.0.0.1:5004/api/v1/deals?includeParticipantDeals=1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	b2c15cb6-1678-4819-9d24-6fdd8d192064	2026-07-01 15:53:21.420233+05:30
9992a123-8422-4cd9-98e7-54199656fddf	http.get.api.v1.platform.metrics.funding	success	200	1084	GET	/api/v1/platform/metrics/funding	\N	127.0.0.1	192.168.100.172	http://127.0.0.1:5004/api/v1/platform/metrics/funding?period=30d	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	b2c15cb6-1678-4819-9d24-6fdd8d192064	2026-07-01 15:53:21.906027+05:30
78eb9d56-3f72-4a78-8188-ff0abbe21dc0	http.get.api.v1.platform.signup-notifications	success	200	1103	GET	/api/v1/platform/signup-notifications	\N	127.0.0.1	192.168.100.172	http://127.0.0.1:5004/api/v1/platform/signup-notifications	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	b2c15cb6-1678-4819-9d24-6fdd8d192064	2026-07-01 15:53:21.912588+05:30
43229fed-e948-418b-8c80-8b731487c377	http.get.api.v1.platform.metrics.funding	success	304	29	GET	/api/v1/platform/metrics/funding	\N	127.0.0.1	192.168.100.172	http://127.0.0.1:5004/api/v1/platform/metrics/funding?period=30d	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	b2c15cb6-1678-4819-9d24-6fdd8d192064	2026-07-01 15:53:21.987802+05:30
bbeab293-6556-45b7-a2c4-7390fb6a57ba	http.get.api.v1.platform.signup-notifications	success	304	43	GET	/api/v1/platform/signup-notifications	\N	127.0.0.1	192.168.100.172	http://127.0.0.1:5004/api/v1/platform/signup-notifications	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	b2c15cb6-1678-4819-9d24-6fdd8d192064	2026-07-01 15:53:22.005604+05:30
d72ec429-aed1-47ac-a374-de17b6cecb97	http.get.api.v1.platform.metrics.user-activity	success	200	1208	GET	/api/v1/platform/metrics/user-activity	\N	127.0.0.1	192.168.100.172	http://127.0.0.1:5004/api/v1/platform/metrics/user-activity	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	b2c15cb6-1678-4819-9d24-6fdd8d192064	2026-07-01 15:53:22.038216+05:30
d8020020-d6bb-4077-b0d6-3ccc0db8baa2	http.get.api.v1.platform.metrics.user-activity	success	304	39	GET	/api/v1/platform/metrics/user-activity	\N	127.0.0.1	192.168.100.172	http://127.0.0.1:5004/api/v1/platform/metrics/user-activity	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	b2c15cb6-1678-4819-9d24-6fdd8d192064	2026-07-01 15:53:22.115894+05:30
6f6ef484-1885-41ac-9be5-b132a252efbc	http.get.api.v1.platform.metrics	success	200	1417	GET	/api/v1/platform/metrics	\N	127.0.0.1	192.168.100.172	http://127.0.0.1:5004/api/v1/platform/metrics	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	b2c15cb6-1678-4819-9d24-6fdd8d192064	2026-07-01 15:53:22.192891+05:30
ef8d94af-dfff-49e1-b278-683b28c81a90	http.get.api.v1.platform.metrics	success	304	199	GET	/api/v1/platform/metrics	\N	127.0.0.1	192.168.100.172	http://127.0.0.1:5004/api/v1/platform/metrics	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	b2c15cb6-1678-4819-9d24-6fdd8d192064	2026-07-01 15:53:22.410861+05:30
0cb71d0a-62c8-41e8-9e8f-f3729275d09c	company.list	success	200	737	GET	/api/v1/companies	\N	127.0.0.1	192.168.100.172	http://127.0.0.1:5004/api/v1/companies	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	b2c15cb6-1678-4819-9d24-6fdd8d192064	2026-07-01 15:53:40.206163+05:30
83ea1f91-2a74-4efc-b927-23b703520d77	http.post.api.v1.auth.activity.page-view	success	200	439	POST	/api/v1/auth/activity/page-view	\N	127.0.0.1	192.168.100.172	http://127.0.0.1:5004/api/v1/auth/activity/page-view	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	b2c15cb6-1678-4819-9d24-6fdd8d192064	2026-07-01 15:53:40.227178+05:30
726b5a1c-f8f2-444b-a284-9c4fef11a140	company.list	success	304	93	GET	/api/v1/companies	\N	127.0.0.1	192.168.100.172	http://127.0.0.1:5004/api/v1/companies	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	b2c15cb6-1678-4819-9d24-6fdd8d192064	2026-07-01 15:53:40.322248+05:30
c1bd71ef-5948-433f-a50e-30b13f26197d	http.get.api.v1.platform.signup-notifications	success	304	255	GET	/api/v1/platform/signup-notifications	\N	127.0.0.1	192.168.100.172	http://127.0.0.1:5004/api/v1/platform/signup-notifications	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	b2c15cb6-1678-4819-9d24-6fdd8d192064	2026-07-01 16:01:06.371769+05:30
b1668293-fdd8-4519-b4ff-7cf64eefe3cb	deal.list	success	304	319	GET	/api/v1/deals	\N	127.0.0.1	192.168.100.172	http://127.0.0.1:5004/api/v1/deals?includeParticipantDeals=1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	b2c15cb6-1678-4819-9d24-6fdd8d192064	2026-07-01 16:01:06.4523+05:30
86ab7cbf-e1cd-4327-a63a-6cb51d868968	http.post.api.v1.auth.activity.logout	auth_failure	401	2	POST	/api/v1/auth/activity/logout	\N	127.0.0.1	192.168.100.172	http://127.0.0.1:5004/api/v1/auth/activity/logout	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	\N	2026-07-01 17:00:01.429748+05:30
629f85b4-f9e4-4744-8320-8872e4be5be8	http.post.api.v1.auth.logout	success	200	2125	POST	/api/v1/auth/logout	\N	127.0.0.1	192.168.100.172	http://127.0.0.1:5004/api/v1/auth/logout	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	\N	2026-07-01 17:00:03.221042+05:30
0d7fb11c-b42b-49db-aa2b-a0f714b35e9f	auth.signin	success	200	1132	POST	/api/v1/auth/signin	\N	127.0.0.1	192.168.0.14	http://127.0.0.1:5004/api/v1/auth/signin	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	\N	2026-07-02 17:15:27.458312+05:30
eba5897a-b1e4-415f-ad2c-21a897913143	http.get.api.v1.platform.metrics.funding	success	200	800	GET	/api/v1/platform/metrics/funding	\N	127.0.0.1	192.168.0.14	http://127.0.0.1:5004/api/v1/platform/metrics/funding?period=30d	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	b2c15cb6-1678-4819-9d24-6fdd8d192064	2026-07-02 17:15:28.770574+05:30
165c74b1-ba9c-458a-80a4-9cb40c375ca6	company.public_branding	success	200	192	GET	/api/v1/public/company-branding/3f8a9c1e-2b4d-4f6a-8c7e-1d0e9a8b7c6d	\N	127.0.0.1	192.168.0.14	http://127.0.0.1:5004/api/v1/public/company-branding/3f8a9c1e-2b4d-4f6a-8c7e-1d0e9a8b7c6d	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	b2c15cb6-1678-4819-9d24-6fdd8d192064	2026-07-02 17:15:28.909853+05:30
28b885b0-43f0-4c1f-9abb-d77adaaa32f5	http.get.api.v1.platform.metrics.funding	success	304	69	GET	/api/v1/platform/metrics/funding	\N	127.0.0.1	192.168.0.14	http://127.0.0.1:5004/api/v1/platform/metrics/funding?period=30d	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	b2c15cb6-1678-4819-9d24-6fdd8d192064	2026-07-02 17:15:29.043388+05:30
c39e7618-0d3a-4512-a462-7d9db44fd1bd	company.public_branding	success	200	1244	GET	/api/v1/public/company-branding/3f8a9c1e-2b4d-4f6a-8c7e-1d0e9a8b7c6d	\N	127.0.0.1	192.168.0.14	http://127.0.0.1:5004/api/v1/public/company-branding/3f8a9c1e-2b4d-4f6a-8c7e-1d0e9a8b7c6d	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	b2c15cb6-1678-4819-9d24-6fdd8d192064	2026-07-02 17:15:29.111806+05:30
b54d7a79-5f9c-415f-b11c-d6537e36ea24	http.get.api.v1.platform.signup-notifications	success	200	1268	GET	/api/v1/platform/signup-notifications	\N	127.0.0.1	192.168.0.14	http://127.0.0.1:5004/api/v1/platform/signup-notifications	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	b2c15cb6-1678-4819-9d24-6fdd8d192064	2026-07-02 17:15:29.11851+05:30
56376293-1a5d-45ec-88b7-9986837478bc	http.get.api.v1.platform.signup-notifications	success	304	61	GET	/api/v1/platform/signup-notifications	\N	127.0.0.1	192.168.0.14	http://127.0.0.1:5004/api/v1/platform/signup-notifications	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	b2c15cb6-1678-4819-9d24-6fdd8d192064	2026-07-02 17:15:29.330976+05:30
96d3d9ac-58c7-4d6e-8b91-f5940ebcdc19	http.get.api.v1.platform.metrics	success	200	1520	GET	/api/v1/platform/metrics	\N	127.0.0.1	192.168.0.14	http://127.0.0.1:5004/api/v1/platform/metrics	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	b2c15cb6-1678-4819-9d24-6fdd8d192064	2026-07-02 17:15:29.355708+05:30
7f9f0d0b-94a8-400e-abd5-8e6b2adefac9	http.get.api.v1.platform.metrics	success	304	180	GET	/api/v1/platform/metrics	\N	127.0.0.1	192.168.0.14	http://127.0.0.1:5004/api/v1/platform/metrics	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	b2c15cb6-1678-4819-9d24-6fdd8d192064	2026-07-02 17:15:29.616354+05:30
7f723903-36cd-4597-9cb0-4724b511eb79	http.get.api.v1.platform.metrics.user-activity	success	200	1847	GET	/api/v1/platform/metrics/user-activity	\N	127.0.0.1	192.168.0.14	http://127.0.0.1:5004/api/v1/platform/metrics/user-activity	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	b2c15cb6-1678-4819-9d24-6fdd8d192064	2026-07-02 17:15:29.745098+05:30
fdf70540-831b-4eb4-b27d-6df618df4bb3	http.get.api.v1.platform.metrics.user-activity	success	304	36	GET	/api/v1/platform/metrics/user-activity	\N	127.0.0.1	192.168.0.14	http://127.0.0.1:5004/api/v1/platform/metrics/user-activity	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	b2c15cb6-1678-4819-9d24-6fdd8d192064	2026-07-02 17:15:29.847412+05:30
9a71ab3a-35cc-4053-a559-a2a364180c6f	deal.list	success	200	1936	GET	/api/v1/deals	\N	127.0.0.1	192.168.0.14	http://127.0.0.1:5004/api/v1/deals?includeParticipantDeals=1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	b2c15cb6-1678-4819-9d24-6fdd8d192064	2026-07-02 17:15:29.829753+05:30
842b73ae-cb53-4e99-899a-ce6a4ee541a0	deal.list	success	304	142	GET	/api/v1/deals	\N	127.0.0.1	192.168.0.14	http://127.0.0.1:5004/api/v1/deals?includeParticipantDeals=1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	b2c15cb6-1678-4819-9d24-6fdd8d192064	2026-07-02 17:15:30.043239+05:30
5d0dc1b0-0003-4889-be4f-b6f8e21f6938	http.get.api.v1.platform.signup-notifications	success	304	14	GET	/api/v1/platform/signup-notifications	\N	127.0.0.1	192.168.0.14	http://127.0.0.1:5004/api/v1/platform/signup-notifications	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	b2c15cb6-1678-4819-9d24-6fdd8d192064	2026-07-02 17:15:30.357319+05:30
e33a9682-ea80-4f96-853a-0d0d7ac6eacb	deal.list	success	304	89	GET	/api/v1/deals	\N	127.0.0.1	192.168.0.14	http://127.0.0.1:5004/api/v1/deals?includeParticipantDeals=1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	b2c15cb6-1678-4819-9d24-6fdd8d192064	2026-07-02 17:15:30.431412+05:30
bffe67ba-094b-4c19-a45d-5b0ef81f3330	company.list	success	200	121	GET	/api/v1/companies	\N	127.0.0.1	192.168.0.14	http://127.0.0.1:5004/api/v1/companies	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	b2c15cb6-1678-4819-9d24-6fdd8d192064	2026-07-02 17:15:32.424008+05:30
b6b4a89f-3719-4a7d-8f6d-68a7b9a0ac9a	company.list	success	304	88	GET	/api/v1/companies	\N	127.0.0.1	192.168.0.14	http://127.0.0.1:5004/api/v1/companies	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	b2c15cb6-1678-4819-9d24-6fdd8d192064	2026-07-02 17:15:32.567659+05:30
df009b17-f6cf-49e1-b6bd-928597e6edc4	http.post.api.v1.auth.activity.page-view	success	200	72	POST	/api/v1/auth/activity/page-view	\N	127.0.0.1	192.168.0.14	http://127.0.0.1:5004/api/v1/auth/activity/page-view	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	b2c15cb6-1678-4819-9d24-6fdd8d192064	2026-07-02 17:15:32.621411+05:30
\.


--
-- Data for Name: user_auth_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_auth_tokens (id, user_id, token_type, token_hash, expires_at, revoked_at, replaced_by_id, portal_session_id, user_agent, client_ip, created_at) FROM stdin;
f5d1ba7a-ab75-4ce0-aca2-16880b5a1d95	b2c15cb6-1678-4819-9d24-6fdd8d192064	access	cae6eff5b9a4a0ab8326d14cf5b6800f4545d5309a7e67d403f8c3bdd38f62b9	2026-07-02 17:30:26.774+05:30	\N	\N	8f31c21a-214f-4319-a0ad-15a5cb3c68ca	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	127.0.0.1	2026-07-02 17:15:26.785553+05:30
1d89dbe8-c195-4512-99df-6d135a3ed229	b2c15cb6-1678-4819-9d24-6fdd8d192064	refresh	91d8740193491cc63e83398e182716a2c3181abaa4c86d9b017b73b6493794c9	2026-07-09 17:15:26.774+05:30	\N	\N	8f31c21a-214f-4319-a0ad-15a5cb3c68ca	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	127.0.0.1	2026-07-02 17:15:26.888557+05:30
901293ac-f6dc-4e43-a53d-d5679d8f3ea7	b2c15cb6-1678-4819-9d24-6fdd8d192064	access	741efaf60602a66d829bdb8afb883ae33099cadfdeccb1a90e86c14f6b968503	2026-06-26 10:53:31.987+05:30	\N	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	127.0.0.1	2026-06-26 10:38:31.996358+05:30
e341b4f3-3775-4ba3-a124-ed1c4edd6fa4	b2c15cb6-1678-4819-9d24-6fdd8d192064	refresh	89337786de4b96871ed64f2d55ac004aa9176f5bcc58501f98d6b302efaeb400	2026-07-03 10:38:31.987+05:30	\N	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	127.0.0.1	2026-06-26 10:38:32.027627+05:30
7427a0b8-59e2-45ee-a56d-8f55e667468b	b2c15cb6-1678-4819-9d24-6fdd8d192064	access	d8f77d6a7ad88f738a70d74348b09a45e2b5ee1312f6545a30f0e6caefbc8de0	2026-06-26 17:23:22.884+05:30	2026-06-26 17:21:18.417+05:30	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	127.0.0.1	2026-06-26 17:08:22.893515+05:30
bb91050f-9275-4806-836a-8f1655641d09	b2c15cb6-1678-4819-9d24-6fdd8d192064	refresh	ff4bbb40a6b8b761f3f843e4ffc2d57ea37312ddca685db19bd87524a9adb15d	2026-07-03 17:08:22.884+05:30	2026-06-26 17:21:18.423+05:30	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	127.0.0.1	2026-06-26 17:08:22.922679+05:30
887d2d3e-d16a-4d72-aeef-6cf35cb24dcb	b2c15cb6-1678-4819-9d24-6fdd8d192064	access	fae2c37b44be9e34376e68d3da498e3d7b929c6211914b04f4711aea6b7bf514	2026-06-26 17:36:37.249+05:30	\N	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	127.0.0.1	2026-06-26 17:21:37.252122+05:30
beec36ae-2372-4828-a345-6b99eb5b154c	b2c15cb6-1678-4819-9d24-6fdd8d192064	refresh	16438c33088b672e386f9edf5cd35aa02bf563ff804c338990f623e5497bc130	2026-07-03 17:21:37.249+05:30	2026-06-26 17:40:21.352+05:30	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	127.0.0.1	2026-06-26 17:21:37.259344+05:30
28d891ac-0f0c-4166-a9d3-a972396cd934	b2c15cb6-1678-4819-9d24-6fdd8d192064	access	add7ad5ccacecb77fb93721503c3401752a1af038c2fa703e888ca0d20527d2e	2026-07-01 16:08:20.297+05:30	\N	\N	883b63ea-48df-4e2a-8dbd-fcda3da1cb60	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	127.0.0.1	2026-07-01 15:53:20.303511+05:30
0d4a2c92-4d79-4074-a12b-cb7b6bdc25b1	b2c15cb6-1678-4819-9d24-6fdd8d192064	refresh	ace87ef8a469658e74546baebd2d9089dd0e065da135fb21e9a4df204f9bc69d	2026-07-08 15:53:20.297+05:30	2026-07-01 17:00:01.094+05:30	\N	883b63ea-48df-4e2a-8dbd-fcda3da1cb60	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	127.0.0.1	2026-07-01 15:53:20.323334+05:30
\.


--
-- Data for Name: user_beneficiaries; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_beneficiaries (id, user_id, full_name, relationship, tax_id, phone, email, address_query, archived, created_at) FROM stdin;
\.


--
-- Data for Name: user_company_membership; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_company_membership (id, user_id, company_id, role, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: user_investor_profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_investor_profiles (id, user_id, profile_name, profile_type, added_by, investments_count, archived, created_at, last_edit_reason, form_snapshot, distribution_method, ach_routing_number, ach_account_number, ach_bank_address, ach_bank_name, ach_bank_account_type, bank_account_query, check_payee_name, check_mailing_address_id, is_draft) FROM stdin;
\.


--
-- Data for Name: user_page_navigations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_page_navigations (id, user_id, session_id, page_path, page_label, visit_count, updated_at) FROM stdin;
f7dce70b-d574-4209-8546-0ce3a4770eda	b2c15cb6-1678-4819-9d24-6fdd8d192064	883b63ea-48df-4e2a-8dbd-fcda3da1cb60	/customers	Customers	1	2026-07-01 15:53:40.160358+05:30
51f396c4-1b25-4b15-8a36-01b41f0ad31c	b2c15cb6-1678-4819-9d24-6fdd8d192064	8f31c21a-214f-4319-a0ad-15a5cb3c68ca	/customers	Customers	1	2026-07-02 17:15:32.57718+05:30
\.


--
-- Data for Name: user_portal_sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_portal_sessions (id, user_id, login_at, logout_at) FROM stdin;
883b63ea-48df-4e2a-8dbd-fcda3da1cb60	b2c15cb6-1678-4819-9d24-6fdd8d192064	2026-07-01 15:53:20.481119+05:30	\N
8f31c21a-214f-4319-a0ad-15a5cb3c68ca	b2c15cb6-1678-4819-9d24-6fdd8d192064	2026-07-02 17:15:27.292302+05:30	\N
\.


--
-- Data for Name: user_saved_addresses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_saved_addresses (id, user_id, full_name_or_company, country, street1, street2, city, state, zip, check_memo, distribution_note, archived, created_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, username, password_hash, role, user_status, user_signup_completed, organization_id, first_name, last_name, phone, created_at, updated_at, invite_expires_at) FROM stdin;
b2c15cb6-1678-4819-9d24-6fdd8d192064	platform.admin@example.com	platformadmin	$2b$10$QmNT14.W23/q0zAPzlrS.eb.VFJ0T11sXfMtS6o/EEDVA3WGtpEda	platform_admin	active	true	3f8a9c1e-2b4d-4f6a-8c7e-1d0e9a8b7c6d	Platform	Admin		2026-06-26 10:38:03.483343+05:30	2026-07-01 15:51:50.941917+05:30	\N
\.


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE SET; Schema: drizzle; Owner: postgres
--

SELECT pg_catalog.setval('drizzle.__drizzle_migrations_id_seq', 59, true);


--
-- Name: __drizzle_migrations __drizzle_migrations_pkey; Type: CONSTRAINT; Schema: drizzle; Owner: postgres
--

ALTER TABLE ONLY drizzle.__drizzle_migrations
    ADD CONSTRAINT __drizzle_migrations_pkey PRIMARY KEY (id);


--
-- Name: add_deal_form add_deal_form_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.add_deal_form
    ADD CONSTRAINT add_deal_form_pkey PRIMARY KEY (id);


--
-- Name: assigning_deal_user assigning_deal_user_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assigning_deal_user
    ADD CONSTRAINT assigning_deal_user_pkey PRIMARY KEY (deal_id, user_id);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: company_admin_audit_logs company_admin_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_admin_audit_logs
    ADD CONSTRAINT company_admin_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: company_workspace_tab_settings company_workspace_tab_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_workspace_tab_settings
    ADD CONSTRAINT company_workspace_tab_settings_pkey PRIMARY KEY (company_id, tab_key);


--
-- Name: contact_email_template contact_email_template_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_email_template
    ADD CONSTRAINT contact_email_template_pkey PRIMARY KEY (id);


--
-- Name: contact contact_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact
    ADD CONSTRAINT contact_pkey PRIMARY KEY (id);


--
-- Name: deal_investment deal_investment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_investment
    ADD CONSTRAINT deal_investment_pkey PRIMARY KEY (id);


--
-- Name: deal_investor_class deal_investor_class_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_investor_class
    ADD CONSTRAINT deal_investor_class_pkey PRIMARY KEY (id);


--
-- Name: deal_lp_investor deal_lp_investor_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_lp_investor
    ADD CONSTRAINT deal_lp_investor_pkey PRIMARY KEY (id);


--
-- Name: deal_member deal_member_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_member
    ADD CONSTRAINT deal_member_pkey PRIMARY KEY (id);


--
-- Name: deals deals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_pkey PRIMARY KEY (id);


--
-- Name: esign_reusable_template esign_reusable_template_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.esign_reusable_template
    ADD CONSTRAINT esign_reusable_template_pkey PRIMARY KEY (id);


--
-- Name: investment_signatures investment_signatures_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.investment_signatures
    ADD CONSTRAINT investment_signatures_pkey PRIMARY KEY (id);


--
-- Name: investor_communication_logs investor_communication_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.investor_communication_logs
    ADD CONSTRAINT investor_communication_logs_pkey PRIMARY KEY (id);


--
-- Name: member_admin_audit_logs member_admin_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_admin_audit_logs
    ADD CONSTRAINT member_admin_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: organization_contact_list organization_contact_list_org_name_uidx; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_contact_list
    ADD CONSTRAINT organization_contact_list_org_name_uidx UNIQUE (organization_id, name);


--
-- Name: organization_contact_list organization_contact_list_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_contact_list
    ADD CONSTRAINT organization_contact_list_pkey PRIMARY KEY (id);


--
-- Name: organization_contact_tag organization_contact_tag_org_name_uidx; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_contact_tag
    ADD CONSTRAINT organization_contact_tag_org_name_uidx UNIQUE (organization_id, name);


--
-- Name: organization_contact_tag organization_contact_tag_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_contact_tag
    ADD CONSTRAINT organization_contact_tag_pkey PRIMARY KEY (id);


--
-- Name: platform_signup_notification platform_signup_notification_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.platform_signup_notification
    ADD CONSTRAINT platform_signup_notification_pkey PRIMARY KEY (id);


--
-- Name: soc_auth_audit_logs soc_auth_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.soc_auth_audit_logs
    ADD CONSTRAINT soc_auth_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: user_auth_tokens user_auth_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_auth_tokens
    ADD CONSTRAINT user_auth_tokens_pkey PRIMARY KEY (id);


--
-- Name: user_beneficiaries user_beneficiaries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_beneficiaries
    ADD CONSTRAINT user_beneficiaries_pkey PRIMARY KEY (id);


--
-- Name: user_company_membership user_company_membership_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_company_membership
    ADD CONSTRAINT user_company_membership_pkey PRIMARY KEY (id);


--
-- Name: user_investor_profiles user_investor_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_investor_profiles
    ADD CONSTRAINT user_investor_profiles_pkey PRIMARY KEY (id);


--
-- Name: user_page_navigations user_page_navigations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_page_navigations
    ADD CONSTRAINT user_page_navigations_pkey PRIMARY KEY (id);


--
-- Name: user_portal_sessions user_portal_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_portal_sessions
    ADD CONSTRAINT user_portal_sessions_pkey PRIMARY KEY (id);


--
-- Name: user_saved_addresses user_saved_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_saved_addresses
    ADD CONSTRAINT user_saved_addresses_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_unique UNIQUE (username);


--
-- Name: contact_email_template_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX contact_email_template_created_at_idx ON public.contact_email_template USING btree (created_at);


--
-- Name: contact_email_template_created_by_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX contact_email_template_created_by_idx ON public.contact_email_template USING btree (created_by);


--
-- Name: contact_email_template_organization_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX contact_email_template_organization_id_idx ON public.contact_email_template USING btree (organization_id);


--
-- Name: contact_organization_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX contact_organization_id_idx ON public.contact USING btree (organization_id);


--
-- Name: deal_investment_user_investor_profile_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX deal_investment_user_investor_profile_id_idx ON public.deal_investment USING btree (user_investor_profile_id);


--
-- Name: deal_lp_investor_deal_id_contact_member_id_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX deal_lp_investor_deal_id_contact_member_id_uidx ON public.deal_lp_investor USING btree (deal_id, contact_member_id);


--
-- Name: deal_lp_investor_email_lower_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX deal_lp_investor_email_lower_idx ON public.deal_lp_investor USING btree (lower(TRIM(BOTH FROM email))) WHERE (NULLIF(TRIM(BOTH FROM email), ''::text) IS NOT NULL);


--
-- Name: deal_lp_investor_user_investor_profile_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX deal_lp_investor_user_investor_profile_id_idx ON public.deal_lp_investor USING btree (user_investor_profile_id);


--
-- Name: deal_member_deal_id_contact_member_id_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX deal_member_deal_id_contact_member_id_uidx ON public.deal_member USING btree (deal_id, contact_member_id);


--
-- Name: esign_reusable_template_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX esign_reusable_template_created_at_idx ON public.esign_reusable_template USING btree (created_at);


--
-- Name: esign_reusable_template_created_by_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX esign_reusable_template_created_by_idx ON public.esign_reusable_template USING btree (created_by);


--
-- Name: esign_reusable_template_organization_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX esign_reusable_template_organization_id_idx ON public.esign_reusable_template USING btree (organization_id);


--
-- Name: investment_signatures_investment_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX investment_signatures_investment_id_idx ON public.investment_signatures USING btree (investment_id);


--
-- Name: investment_signatures_signature_request_id_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX investment_signatures_signature_request_id_uidx ON public.investment_signatures USING btree (signature_request_id);


--
-- Name: investor_communication_logs_deal_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX investor_communication_logs_deal_id_idx ON public.investor_communication_logs USING btree (deal_id);


--
-- Name: investor_communication_logs_sent_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX investor_communication_logs_sent_at_idx ON public.investor_communication_logs USING btree (sent_at);


--
-- Name: soc_auth_audit_logs_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX soc_auth_audit_logs_created_at_idx ON public.soc_auth_audit_logs USING btree (created_at DESC);


--
-- Name: soc_auth_audit_logs_event_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX soc_auth_audit_logs_event_idx ON public.soc_auth_audit_logs USING btree (event);


--
-- Name: user_auth_tokens_expires_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_auth_tokens_expires_idx ON public.user_auth_tokens USING btree (expires_at);


--
-- Name: user_auth_tokens_hash_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX user_auth_tokens_hash_uidx ON public.user_auth_tokens USING btree (token_hash);


--
-- Name: user_auth_tokens_user_type_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_auth_tokens_user_type_active_idx ON public.user_auth_tokens USING btree (user_id, token_type) WHERE (revoked_at IS NULL);


--
-- Name: user_beneficiaries_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_beneficiaries_user_id_idx ON public.user_beneficiaries USING btree (user_id);


--
-- Name: user_company_membership_user_company_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX user_company_membership_user_company_uidx ON public.user_company_membership USING btree (user_id, company_id);


--
-- Name: user_investor_profiles_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_investor_profiles_user_id_idx ON public.user_investor_profiles USING btree (user_id);


--
-- Name: user_page_navigations_session_path_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX user_page_navigations_session_path_uidx ON public.user_page_navigations USING btree (session_id, page_path);


--
-- Name: user_page_navigations_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_page_navigations_user_idx ON public.user_page_navigations USING btree (user_id);


--
-- Name: user_portal_sessions_user_login_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_portal_sessions_user_login_idx ON public.user_portal_sessions USING btree (user_id, login_at DESC);


--
-- Name: user_saved_addresses_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_saved_addresses_user_id_idx ON public.user_saved_addresses USING btree (user_id);


--
-- Name: add_deal_form add_deal_form_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.add_deal_form
    ADD CONSTRAINT add_deal_form_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- Name: assigning_deal_user assigning_deal_user_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assigning_deal_user
    ADD CONSTRAINT assigning_deal_user_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.add_deal_form(id) ON DELETE CASCADE;


--
-- Name: assigning_deal_user assigning_deal_user_user_added_deal_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assigning_deal_user
    ADD CONSTRAINT assigning_deal_user_user_added_deal_fkey FOREIGN KEY (user_added_deal) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: assigning_deal_user assigning_deal_user_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assigning_deal_user
    ADD CONSTRAINT assigning_deal_user_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: company_admin_audit_logs company_admin_audit_logs_actor_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_admin_audit_logs
    ADD CONSTRAINT company_admin_audit_logs_actor_user_id_users_id_fk FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: company_admin_audit_logs company_admin_audit_logs_target_company_id_companies_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_admin_audit_logs
    ADD CONSTRAINT company_admin_audit_logs_target_company_id_companies_id_fk FOREIGN KEY (target_company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;


--
-- Name: company_workspace_tab_settings company_workspace_tab_settings_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_workspace_tab_settings
    ADD CONSTRAINT company_workspace_tab_settings_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: contact contact_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact
    ADD CONSTRAINT contact_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: contact_email_template contact_email_template_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_email_template
    ADD CONSTRAINT contact_email_template_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: contact_email_template contact_email_template_organization_id_companies_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_email_template
    ADD CONSTRAINT contact_email_template_organization_id_companies_id_fk FOREIGN KEY (organization_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- Name: contact contact_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact
    ADD CONSTRAINT contact_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- Name: deal_investment deal_investment_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_investment
    ADD CONSTRAINT deal_investment_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.add_deal_form(id) ON DELETE CASCADE;


--
-- Name: deal_investment deal_investment_user_investor_profile_id_user_investor_profiles; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_investment
    ADD CONSTRAINT deal_investment_user_investor_profile_id_user_investor_profiles FOREIGN KEY (user_investor_profile_id) REFERENCES public.user_investor_profiles(id) ON DELETE SET NULL;


--
-- Name: deal_investor_class deal_investor_class_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_investor_class
    ADD CONSTRAINT deal_investor_class_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.add_deal_form(id) ON DELETE CASCADE;


--
-- Name: deal_lp_investor deal_lp_investor_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_lp_investor
    ADD CONSTRAINT deal_lp_investor_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: deal_lp_investor deal_lp_investor_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_lp_investor
    ADD CONSTRAINT deal_lp_investor_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.add_deal_form(id) ON DELETE CASCADE;


--
-- Name: deal_lp_investor deal_lp_investor_user_investor_profile_id_user_investor_profile; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_lp_investor
    ADD CONSTRAINT deal_lp_investor_user_investor_profile_id_user_investor_profile FOREIGN KEY (user_investor_profile_id) REFERENCES public.user_investor_profiles(id) ON DELETE SET NULL;


--
-- Name: deal_member deal_member_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_member
    ADD CONSTRAINT deal_member_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: deal_member deal_member_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_member
    ADD CONSTRAINT deal_member_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.add_deal_form(id) ON DELETE CASCADE;


--
-- Name: deals deals_company_id_companies_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_company_id_companies_id_fk FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: esign_reusable_template esign_reusable_template_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.esign_reusable_template
    ADD CONSTRAINT esign_reusable_template_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: esign_reusable_template esign_reusable_template_organization_id_companies_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.esign_reusable_template
    ADD CONSTRAINT esign_reusable_template_organization_id_companies_id_fk FOREIGN KEY (organization_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- Name: investment_signatures investment_signatures_investment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.investment_signatures
    ADD CONSTRAINT investment_signatures_investment_id_fkey FOREIGN KEY (investment_id) REFERENCES public.deal_investment(id) ON DELETE CASCADE;


--
-- Name: investor_communication_logs investor_communication_logs_deal_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.investor_communication_logs
    ADD CONSTRAINT investor_communication_logs_deal_id_fk FOREIGN KEY (deal_id) REFERENCES public.add_deal_form(id) ON DELETE CASCADE;


--
-- Name: investor_communication_logs investor_communication_logs_sender_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.investor_communication_logs
    ADD CONSTRAINT investor_communication_logs_sender_id_fk FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: investor_communication_logs investor_communication_logs_template_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.investor_communication_logs
    ADD CONSTRAINT investor_communication_logs_template_id_fk FOREIGN KEY (template_id) REFERENCES public.contact_email_template(id) ON DELETE SET NULL;


--
-- Name: member_admin_audit_logs member_admin_audit_logs_actor_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_admin_audit_logs
    ADD CONSTRAINT member_admin_audit_logs_actor_user_id_users_id_fk FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: member_admin_audit_logs member_admin_audit_logs_target_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_admin_audit_logs
    ADD CONSTRAINT member_admin_audit_logs_target_user_id_users_id_fk FOREIGN KEY (target_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: organization_contact_list organization_contact_list_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_contact_list
    ADD CONSTRAINT organization_contact_list_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: organization_contact_tag organization_contact_tag_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_contact_tag
    ADD CONSTRAINT organization_contact_tag_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: platform_signup_notification platform_signup_notification_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.platform_signup_notification
    ADD CONSTRAINT platform_signup_notification_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contact(id) ON DELETE SET NULL;


--
-- Name: platform_signup_notification platform_signup_notification_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.platform_signup_notification
    ADD CONSTRAINT platform_signup_notification_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- Name: platform_signup_notification platform_signup_notification_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.platform_signup_notification
    ADD CONSTRAINT platform_signup_notification_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_auth_tokens user_auth_tokens_portal_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_auth_tokens
    ADD CONSTRAINT user_auth_tokens_portal_session_id_fkey FOREIGN KEY (portal_session_id) REFERENCES public.user_portal_sessions(id) ON DELETE SET NULL;


--
-- Name: user_auth_tokens user_auth_tokens_replaced_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_auth_tokens
    ADD CONSTRAINT user_auth_tokens_replaced_by_id_fkey FOREIGN KEY (replaced_by_id) REFERENCES public.user_auth_tokens(id) ON DELETE SET NULL;


--
-- Name: user_auth_tokens user_auth_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_auth_tokens
    ADD CONSTRAINT user_auth_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_beneficiaries user_beneficiaries_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_beneficiaries
    ADD CONSTRAINT user_beneficiaries_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_company_membership user_company_membership_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_company_membership
    ADD CONSTRAINT user_company_membership_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: user_company_membership user_company_membership_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_company_membership
    ADD CONSTRAINT user_company_membership_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_investor_profiles user_investor_profiles_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_investor_profiles
    ADD CONSTRAINT user_investor_profiles_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_page_navigations user_page_navigations_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_page_navigations
    ADD CONSTRAINT user_page_navigations_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.user_portal_sessions(id) ON DELETE CASCADE;


--
-- Name: user_page_navigations user_page_navigations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_page_navigations
    ADD CONSTRAINT user_page_navigations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_portal_sessions user_portal_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_portal_sessions
    ADD CONSTRAINT user_portal_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_saved_addresses user_saved_addresses_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_saved_addresses
    ADD CONSTRAINT user_saved_addresses_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict cybryiCdpeeKWE3POwRJLzmTmMDXTnBkm3vCHoasCWAg6rxdkEaXxuCax28vJS9

