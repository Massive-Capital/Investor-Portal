--
-- PostgreSQL database dump
--

\restrict Q3jzxdZk5f0aNLXpxrFy5mZ9yPJ2Lb20VvEm7iPir1Qh0R6eTenjZlG5pI0EnZO

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

-- Started on 2026-04-11 12:02:11

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
-- TOC entry 6 (class 2615 OID 59690)
-- Name: drizzle; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA drizzle;


ALTER SCHEMA drizzle OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 218 (class 1259 OID 59691)
-- Name: __drizzle_migrations; Type: TABLE; Schema: drizzle; Owner: postgres
--

CREATE TABLE drizzle.__drizzle_migrations (
    id integer NOT NULL,
    hash text NOT NULL,
    created_at bigint
);


ALTER TABLE drizzle.__drizzle_migrations OWNER TO postgres;

--
-- TOC entry 219 (class 1259 OID 59696)
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
-- TOC entry 5046 (class 0 OID 0)
-- Dependencies: 219
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: drizzle; Owner: postgres
--

ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNED BY drizzle.__drizzle_migrations.id;


--
-- TOC entry 220 (class 1259 OID 59697)
-- Name: add_deal_form; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.add_deal_form (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deal_name text NOT NULL,
    deal_type text,
    deal_stage text NOT NULL,
    sec_type text NOT NULL,
    close_date date,
    owning_entity_name text NOT NULL,
    funds_required_before_gp_sign boolean DEFAULT false,
    auto_send_funding_instructions boolean DEFAULT false,
    property_name text NOT NULL,
    country text,
    address_line_1 text,
    address_line_2 text,
    city text,
    state text,
    zip_code text,
    images text[] DEFAULT ARRAY[]::text[],
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    asset_image_path text,
    organization_id uuid,
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
    offering_preview_token text,
    CONSTRAINT add_deal_form_deal_stage_check CHECK ((deal_stage = ANY (ARRAY['draft'::text, 'Draft'::text, 'raising_capital'::text, 'capital_raising'::text, 'asset_managing'::text, 'managing_asset'::text, 'liquidated'::text])))
);


ALTER TABLE public.add_deal_form OWNER TO postgres;

--
-- TOC entry 221 (class 1259 OID 59715)
-- Name: assigning_deal_user; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.assigning_deal_user (
    deal_id uuid NOT NULL,
    user_id uuid NOT NULL,
    user_added_deal uuid
);


ALTER TABLE public.assigning_deal_user OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 59718)
-- Name: companies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.companies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying NOT NULL
);


ALTER TABLE public.companies OWNER TO postgres;

--
-- TOC entry 223 (class 1259 OID 59725)
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
-- TOC entry 224 (class 1259 OID 59732)
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
-- TOC entry 225 (class 1259 OID 59739)
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
    last_edit_reason text
);


ALTER TABLE public.contact OWNER TO postgres;

--
-- TOC entry 226 (class 1259 OID 59752)
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
    investor_role text DEFAULT ''::text NOT NULL
);


ALTER TABLE public.deal_investment OWNER TO postgres;

--
-- TOC entry 227 (class 1259 OID 59768)
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
    minimum_investment text DEFAULT ''::text NOT NULL,
    price_per_unit text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    visibility text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    raise_amount_distributions text DEFAULT ''::text NOT NULL,
    billing_raise_quota text DEFAULT ''::text NOT NULL,
    advanced_options_json text DEFAULT '{}'::text NOT NULL
);


ALTER TABLE public.deal_investor_class OWNER TO postgres;

--
-- TOC entry 228 (class 1259 OID 59788)
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.deal_lp_investor OWNER TO postgres;

--
-- TOC entry 229 (class 1259 OID 59799)
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
-- TOC entry 230 (class 1259 OID 59810)
-- Name: deals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.deals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.deals OWNER TO postgres;

--
-- TOC entry 231 (class 1259 OID 59815)
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
-- TOC entry 232 (class 1259 OID 59822)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    username character varying(100) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(50) DEFAULT 'user'::character varying NOT NULL,
    user_status character varying(50) DEFAULT 'active'::character varying NOT NULL,
    user_signup_completed character varying(10) DEFAULT 'true'::character varying NOT NULL,
    organization_id uuid,
    first_name character varying(100) DEFAULT ''::character varying NOT NULL,
    last_name character varying(100) DEFAULT ''::character varying NOT NULL,
    phone character varying(32) DEFAULT ''::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    company_name character varying(255) DEFAULT ''::character varying NOT NULL,
    invite_expires_at timestamp with time zone
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 4748 (class 2604 OID 59837)
-- Name: __drizzle_migrations id; Type: DEFAULT; Schema: drizzle; Owner: postgres
--

ALTER TABLE ONLY drizzle.__drizzle_migrations ALTER COLUMN id SET DEFAULT nextval('drizzle.__drizzle_migrations_id_seq'::regclass);


--
-- TOC entry 5026 (class 0 OID 59691)
-- Dependencies: 218
-- Data for Name: __drizzle_migrations; Type: TABLE DATA; Schema: drizzle; Owner: postgres
--

COPY drizzle.__drizzle_migrations (id, hash, created_at) FROM stdin;
1	35fb3b45c7a7c5d0f23ee8ba4f8c217a3bd3a02ab17bda72bbe942eb57126a17	1774699093272
2	f34822bf9dadd654084c28804a0a1f600240f1560ad284c0331fe16df138abe7	1774708226298
3	8572168a0e5090b1551e12a6c73f238451403e758ea3f9b33fdc4cf519a3541b	1774718789394
4	fd6e56a346f0a90bcbf3e53404c15762c3795252970586f3609f640dbd30e344	1774720000000
5	42f6bc2cdbeedb3b0eacb9d86a59169d08a09575b51d92a7d2f1903080e3e8a0	1774721000000
6	53d39e9cd5c2e901336136c5701afc1e1d25a3d2deeb4d4bf618745cafd29222	1776000000000
7	a4a2110ca6bf5225ac7b8ffc414fc3cc6e914c20ec9de4c36646b8ad7269b878	1776100000000
8	e94a0bc9c4ca61f850fcfd962f8eb628bd56c944ff220d7f42e239b0a8f2eb66	1776200000000
9	bf0c601f880098d8158bbf8b53c6f5c208aeb9f5388d4e23f2c7f47e7ae53564	1776300000000
10	edd0406dc6c31d6e87a27dd35f10fd2c61fe4b0353b2159379a79ea5992c6bf2	1776400000000
11	8f341fc2dc10326d65e05772b139a01c2111cc6352ffa9d3f2ce70cbc7672aa8	1776500000000
12	0cd25b55c63a4ec1f82380103f4e4f49acbdd27738c60bd9fbe305ba7f5143d3	1776600000000
13	645c2d08a5cc5e50492edb30b3b43f3fdc56e926ac9901a71ce65b2259b4da1d	1776700000000
14	2b4abd9fea418c51cffa93d88dd399d2d46c25e5ac22b90ad6bdcc98853426f5	1776800000000
\.


--
-- TOC entry 5028 (class 0 OID 59697)
-- Dependencies: 220
-- Data for Name: add_deal_form; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.add_deal_form (id, deal_name, deal_type, deal_stage, sec_type, close_date, owning_entity_name, funds_required_before_gp_sign, auto_send_funding_instructions, property_name, country, address_line_1, address_line_2, city, state, zip_code, images, created_at, updated_at, asset_image_path, organization_id, investor_summary_html, gallery_cover_image_url, key_highlights_json, deal_announcement_title, deal_announcement_message, offering_status, offering_visibility, show_on_investbase, internal_name, offering_overview_asset_ids, offering_gallery_paths, offering_preview_token) FROM stdin;
\.


--
-- TOC entry 5029 (class 0 OID 59715)
-- Dependencies: 221
-- Data for Name: assigning_deal_user; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.assigning_deal_user (deal_id, user_id, user_added_deal) FROM stdin;
\.


--
-- TOC entry 5030 (class 0 OID 59718)
-- Dependencies: 222
-- Data for Name: companies; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.companies (id, name, created_at, updated_at, status) FROM stdin;
1c57fcf7-1cd8-4e3a-a7bb-1f14ba3ef09e	Test	2026-03-28 22:13:05.693866+05:30	2026-03-29 00:33:47.358+05:30	active
10fcad37-bf26-4187-b16e-1a070bd84377	Testing	2026-03-29 10:36:22.603757+05:30	2026-03-29 10:36:22.603757+05:30	active
3d281cb8-089f-4a63-bcb0-bcc39d0b88c2	Demo Company	2026-03-29 12:42:58.245999+05:30	2026-03-29 12:42:58.245999+05:30	active
0c66fb18-fe7d-4010-b6b7-cfdcb24c5792	Company1	2026-03-29 18:27:59.544209+05:30	2026-03-29 18:27:59.544209+05:30	active
2bd2ae86-d61b-411a-8a6e-95d3cbf6b0b6	wqe	2026-03-29 19:42:40.35639+05:30	2026-03-29 19:42:40.35639+05:30	active
5e7de556-ce13-46c7-a217-160e322c49f2	Demo	2026-03-30 08:46:14.837764+05:30	2026-03-30 08:46:14.837764+05:30	active
67e4cb39-ba18-471d-8f48-5f250ee8cc96	Acme	2026-03-29 09:57:43.023875+05:30	2026-03-30 08:52:24.186+05:30	active
7308587d-1d76-4448-9d0b-bd155e5bd281	Company01	2026-03-30 08:55:28.659947+05:30	2026-03-30 08:55:28.659947+05:30	active
380a60f3-6ebf-43d4-9949-f4ee012eb426	Massive	2026-03-31 00:12:12.94893+05:30	2026-03-31 00:12:12.94893+05:30	active
af6822c5-3a6d-4ce4-8b1a-7b9baf481698	Beetle	2026-03-31 00:22:33.099847+05:30	2026-03-31 00:22:33.099847+05:30	active
\.


--
-- TOC entry 5031 (class 0 OID 59725)
-- Dependencies: 223
-- Data for Name: company_admin_audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.company_admin_audit_logs (id, actor_user_id, target_company_id, action, reason, changes_json, created_at) FROM stdin;
\.


--
-- TOC entry 5032 (class 0 OID 59732)
-- Dependencies: 224
-- Data for Name: company_workspace_tab_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.company_workspace_tab_settings (company_id, tab_key, payload, updated_at) FROM stdin;
\.


--
-- TOC entry 5033 (class 0 OID 59739)
-- Dependencies: 225
-- Data for Name: contact; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.contact (id, first_name, last_name, email, phone, note, tags, lists, owners, created_by, created_at, status, last_edit_reason) FROM stdin;
\.


--
-- TOC entry 5034 (class 0 OID 59752)
-- Dependencies: 226
-- Data for Name: deal_investment; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.deal_investment (id, deal_id, offering_id, contact_id, profile_id, status, investor_class, doc_signed_date, commitment_amount, extra_contribution_amounts, document_storage_path, created_at, contact_display_name, investor_role) FROM stdin;
\.


--
-- TOC entry 5035 (class 0 OID 59768)
-- Dependencies: 227
-- Data for Name: deal_investor_class; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.deal_investor_class (id, deal_id, name, subscription_type, entity_name, start_date, offering_size, minimum_investment, price_per_unit, status, visibility, created_at, updated_at, raise_amount_distributions, billing_raise_quota, advanced_options_json) FROM stdin;
\.


--
-- TOC entry 5036 (class 0 OID 59788)
-- Dependencies: 228
-- Data for Name: deal_lp_investor; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.deal_lp_investor (id, deal_id, added_by, contact_member_id, investor_class, send_invitation_mail, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5037 (class 0 OID 59799)
-- Dependencies: 229
-- Data for Name: deal_member; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.deal_member (id, deal_id, added_by, contact_member_id, deal_member_role, send_invitation_mail, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5038 (class 0 OID 59810)
-- Dependencies: 230
-- Data for Name: deals; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.deals (id, company_id, created_at) FROM stdin;
\.


--
-- TOC entry 5039 (class 0 OID 59815)
-- Dependencies: 231
-- Data for Name: member_admin_audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.member_admin_audit_logs (id, actor_user_id, target_user_id, action, reason, changes_json, created_at) FROM stdin;
\.


--
-- TOC entry 5040 (class 0 OID 59822)
-- Dependencies: 232
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, username, password_hash, role, user_status, user_signup_completed, organization_id, first_name, last_name, phone, created_at, updated_at, company_name, invite_expires_at) FROM stdin;
b2c15cb6-1678-4819-9d24-6fdd8d192064	platform.admin@example.com	platformadmin	$2b$10$i6AuCoVjx3XxI32s8hRia.d1flK87VWianJ2VFr5l7Mloa1sTPeMe	platform_admin	active	true	\N	Platform	Admin		2026-03-28 19:32:33.541251+05:30	2026-03-28 19:32:33.541251+05:30	Massive Capital	\N
7f86eaae-42de-4e52-ac85-e5fddaf15279	test@gmail	sdfsdfdsfsd	$2b$10$EqY7489iNdQ1LuiPAcNxK.syZBxeh8L5T7u611IzMBEGUCRAYcpOa	platform_user	inactive	true	\N	werwe	werwe	wewe	2026-03-28 15:01:11.958608+05:30	2026-03-29 01:26:38.598+05:30	fsdf	\N
c13c4bb4-7be3-4b45-b8fe-80be1e5b3895	test@example.com	newuser	$2b$10$sKSk9FwOMSlNaagngMMpj.VtppBtNYWI22DXIJxXLcQqjA//8jlmK	company_admin	inactive	true	67e4cb39-ba18-471d-8f48-5f250ee8cc96	New	User	0000000000	2026-03-29 09:57:43.063487+05:30	2026-03-29 10:34:33.928+05:30	Acme Capital	\N
b47faf8a-69f8-4dc0-8470-e8da7384384a	test1@example.com	username	$2b$10$b8S5jfA4mOSJbLHCOSKXi.RC1LxLcNAcWA5zexXCpHFojT9PEmfgq	platform_user	active	true	67e4cb39-ba18-471d-8f48-5f250ee8cc96	New	User	0000000000	2026-03-29 10:39:12.341682+05:30	2026-03-29 10:39:12.341682+05:30	Acme Capital	\N
be0b60db-41c1-4256-a911-a62a5e30b4c1	q@gmail.com	invited_6b260132f629074ea93f691e	$2b$10$b8S5jfA4mOSJbLHCOSKXi.RC1LxLcNAcWA5zexXCpHFojT9PEmfgq	company_user	active	false	67e4cb39-ba18-471d-8f48-5f250ee8cc96				2026-03-29 09:59:36.317594+05:30	2026-03-29 09:59:36.317594+05:30	Acme Capital	2026-04-05 09:59:36+05:30
6fe72aa1-9c44-4d8e-9c27-7fba9625e67e	1@gmail.com	testuser	$2b$10$TvoMWozdaWwn7pwSYGL9buLRjudKZRfpitXKgCabNWJE4Qn63TuvW	company_user	active	true	67e4cb39-ba18-471d-8f48-5f250ee8cc96	User	Test	12345678	2026-03-29 10:22:36.427249+05:30	2026-03-29 10:41:19.116+05:30	Acme Capital	\N
394c0c31-1ade-430d-8588-d2e349d328ca	testing@gmail.com	invited_c2ef88d3594f0f3016913b2b	$2b$10$b8S5jfA4mOSJbLHCOSKXi.RC1LxLcNAcWA5zexXCpHFojT9PEmfgq	company_user	active	false	67e4cb39-ba18-471d-8f48-5f250ee8cc96				2026-03-29 10:33:18.076008+05:30	2026-03-29 10:33:18.076008+05:30	Acme Capital	2026-04-05 10:33:17+05:30
3f48abc6-4a1c-4f61-824b-5d8a2f3a065f	testingone@gmail.com	testing	$2b$10$Fh6.pvt48e4r7rXALV/n7ODSZCl8mplha9etb0Em0TN.Iakkhjrga	company_admin	active	true	3d281cb8-089f-4a63-bcb0-bcc39d0b88c2	testing	one	1234567890	2026-03-29 12:42:58.274363+05:30	2026-03-29 12:42:58.274363+05:30	Demo Company	\N
f4c9b4c9-220c-4a01-9a72-b74485faec2a	ww@gmail.com	invited_7f09c3cc066299daa7257984	$2b$10$GSPYCwPxetXaPSFlMGKb4.E/GjAW3onV3WaKPlsSalxROd50VuKhG	platform_user	active	false	3d281cb8-089f-4a63-bcb0-bcc39d0b88c2				2026-03-29 18:20:01.639602+05:30	2026-03-29 18:20:01.639602+05:30	Demo Company	2026-04-05 18:20:01+05:30
a97892d9-6f8b-4e09-99ce-fe213ef634c3	company@gmeil.com	q	$2b$10$eF5caKgIZb.g21IBFQVBd.r1qqYPAEIujmx8PTTX3vyJ.UOUcew2K	company_admin	active	true	0c66fb18-fe7d-4010-b6b7-cfdcb24c5792	11	11	1111111111	2026-03-29 18:27:59.593292+05:30	2026-03-29 19:06:15.966+05:30	Company1	\N
1e8d463c-5ccb-42d9-bc9b-7e819ede4edf	qwqw@gmail.com	qeqe	$2b$10$QkihYeKobXlxT/mmiwbhzeUSzdZTjLFRbLUhU5J.fY8gMAIMBYY56	company_admin	active	true	2bd2ae86-d61b-411a-8a6e-95d3cbf6b0b6	werwer	werwe	1231243242342	2026-03-29 19:42:40.362217+05:30	2026-03-29 19:42:40.362217+05:30	wqe	\N
e7d39aa2-b005-4ea9-838e-84c1083caa3a	test@gmail.com	invited_c5daf9493ab4d7da27a030fc	$2b$10$aIi/R.hMhyHagjTC.dsdVe4dTyR8dRpjQNaqqq0Q2.vqPSLoXBVrm	company_admin	active	false	3d281cb8-089f-4a63-bcb0-bcc39d0b88c2				2026-03-29 09:50:04.595323+05:30	2026-03-29 19:56:29.112+05:30	Demo Company	2026-04-05 19:56:29+05:30
ca9fc267-aa0b-4867-a1b9-cbc35591adb0	qq@gmail.com	invited_9b3bca4c7e0e6c6ee74bb98c	$2b$10$G7Zzig2x2ld9mhdfBxYB0eZPVTbi50sdPTKPhAfkDHKsIlqxS9Tn2	company_admin	active	false	0c66fb18-fe7d-4010-b6b7-cfdcb24c5792				2026-03-29 19:56:48.373439+05:30	2026-03-29 19:56:48.373439+05:30	Company1	2026-04-05 19:56:48+05:30
e37d3560-8937-42e8-a1f1-4b8389c97e7c	testqqq@gmail.com	invited_ce655ce199f35b8dd1d9b842	$2b$10$MLWc31uiArC.ZxNqD8XVueH1iYwfrgjb3aKsb8N8hH2a/qDSR5cLu	company_admin	active	false	10fcad37-bf26-4187-b16e-1a070bd84377				2026-03-29 19:59:47.259331+05:30	2026-03-29 19:59:47.259331+05:30	Testing	2026-04-05 19:59:47+05:30
8112df9a-60e9-41cb-adb5-1b5917a79942	hi@gmail.com	qqq	$2b$10$2.m2jwOnFtH17.H6xtEBGe3aDbHgXYUyvZe7iJvc9/B71nBChF87u	company_user	active	true	3d281cb8-089f-4a63-bcb0-bcc39d0b88c2	qw	qwe	12345678890	2026-03-30 08:25:18.56943+05:30	2026-03-30 08:28:53.967+05:30	Demo Company	\N
fb3353a4-bc59-406e-8041-c5a47bee264e	chinmayee.s@qualesce.com	Chinmayee	$2b$10$bUluWCg1avsJFHeLl.1L0e/vL6xTa/ZuM3NOVG6zcx2/Y/KDL6suq	company_admin	active	true	10fcad37-bf26-4187-b16e-1a070bd84377	Chinmayee	S	1234567890	2026-03-30 08:38:53.119742+05:30	2026-03-30 08:41:57.965+05:30	Testing	\N
37cc6eac-1262-40cc-a96e-6659d00ef43d	test@demo.com	UserOne	$2b$10$aIlTmH1U7bNLo5jbYDjk3uaA2IeA04uPUMCzPbRj2Oyuz1uHBTPGS	company_admin	active	true	7308587d-1d76-4448-9d0b-bd155e5bd281	USer	One	123456667	2026-03-30 08:55:28.693762+05:30	2026-03-30 08:55:28.693762+05:30	Company01	\N
f006a063-9c3e-4de9-a5c3-b6afa50782a5	sanjay@massive.capital	Sanjay	$2b$10$XjsErn6s3L6mvYS8g78c6OWcZl1qS.NVNK27hoUT0cQU.U45Oe/4.	company_admin	active	true	380a60f3-6ebf-43d4-9949-f4ee012eb426	Sanjay	Aggarwal	6417811933	2026-03-31 00:12:12.951993+05:30	2026-03-31 00:12:12.951993+05:30	Massive	\N
2f1b05e2-3cdc-4d2a-90a1-dfddaac4b1c5	mikeb@maximum-service.com	Bahian	$2b$10$YPmluYml/h6GpxPKIUTHq.C.3FqQ.Xz32203agYdHHws2xTnz2/zq	company_admin	active	true	af6822c5-3a6d-4ce4-8b1a-7b9baf481698	Michael	Bailey	13463132823	2026-03-31 00:22:33.10401+05:30	2026-03-31 00:22:33.10401+05:30	Beetle	\N
\.


--
-- TOC entry 5047 (class 0 OID 0)
-- Dependencies: 219
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE SET; Schema: drizzle; Owner: postgres
--

SELECT pg_catalog.setval('drizzle.__drizzle_migrations_id_seq', 14, true);


--
-- TOC entry 4831 (class 2606 OID 59839)
-- Name: __drizzle_migrations __drizzle_migrations_pkey; Type: CONSTRAINT; Schema: drizzle; Owner: postgres
--

ALTER TABLE ONLY drizzle.__drizzle_migrations
    ADD CONSTRAINT __drizzle_migrations_pkey PRIMARY KEY (id);


--
-- TOC entry 4833 (class 2606 OID 59841)
-- Name: add_deal_form add_deal_form_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.add_deal_form
    ADD CONSTRAINT add_deal_form_pkey PRIMARY KEY (id);


--
-- TOC entry 4835 (class 2606 OID 59843)
-- Name: assigning_deal_user assigning_deal_user_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assigning_deal_user
    ADD CONSTRAINT assigning_deal_user_pkey PRIMARY KEY (deal_id, user_id);


--
-- TOC entry 4837 (class 2606 OID 59845)
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- TOC entry 4839 (class 2606 OID 59847)
-- Name: company_admin_audit_logs company_admin_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_admin_audit_logs
    ADD CONSTRAINT company_admin_audit_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 4841 (class 2606 OID 59849)
-- Name: company_workspace_tab_settings company_workspace_tab_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_workspace_tab_settings
    ADD CONSTRAINT company_workspace_tab_settings_pkey PRIMARY KEY (company_id, tab_key);


--
-- TOC entry 4843 (class 2606 OID 59851)
-- Name: contact contact_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact
    ADD CONSTRAINT contact_pkey PRIMARY KEY (id);


--
-- TOC entry 4845 (class 2606 OID 59853)
-- Name: deal_investment deal_investment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_investment
    ADD CONSTRAINT deal_investment_pkey PRIMARY KEY (id);


--
-- TOC entry 4847 (class 2606 OID 59855)
-- Name: deal_investor_class deal_investor_class_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_investor_class
    ADD CONSTRAINT deal_investor_class_pkey PRIMARY KEY (id);


--
-- TOC entry 4850 (class 2606 OID 59857)
-- Name: deal_lp_investor deal_lp_investor_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_lp_investor
    ADD CONSTRAINT deal_lp_investor_pkey PRIMARY KEY (id);


--
-- TOC entry 4853 (class 2606 OID 59859)
-- Name: deal_member deal_member_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_member
    ADD CONSTRAINT deal_member_pkey PRIMARY KEY (id);


--
-- TOC entry 4855 (class 2606 OID 59861)
-- Name: deals deals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_pkey PRIMARY KEY (id);


--
-- TOC entry 4857 (class 2606 OID 59863)
-- Name: member_admin_audit_logs member_admin_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_admin_audit_logs
    ADD CONSTRAINT member_admin_audit_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 4859 (class 2606 OID 59865)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 4861 (class 2606 OID 59867)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 4863 (class 2606 OID 59869)
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- TOC entry 4848 (class 1259 OID 59870)
-- Name: deal_lp_investor_deal_id_contact_member_id_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX deal_lp_investor_deal_id_contact_member_id_uidx ON public.deal_lp_investor USING btree (deal_id, contact_member_id);


--
-- TOC entry 4851 (class 1259 OID 59871)
-- Name: deal_member_deal_id_contact_member_id_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX deal_member_deal_id_contact_member_id_uidx ON public.deal_member USING btree (deal_id, contact_member_id);


--
-- TOC entry 4864 (class 2606 OID 59872)
-- Name: add_deal_form add_deal_form_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.add_deal_form
    ADD CONSTRAINT add_deal_form_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- TOC entry 4865 (class 2606 OID 59877)
-- Name: assigning_deal_user assigning_deal_user_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assigning_deal_user
    ADD CONSTRAINT assigning_deal_user_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.add_deal_form(id) ON DELETE CASCADE;


--
-- TOC entry 4866 (class 2606 OID 59882)
-- Name: assigning_deal_user assigning_deal_user_user_added_deal_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assigning_deal_user
    ADD CONSTRAINT assigning_deal_user_user_added_deal_fkey FOREIGN KEY (user_added_deal) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 4867 (class 2606 OID 59887)
-- Name: assigning_deal_user assigning_deal_user_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assigning_deal_user
    ADD CONSTRAINT assigning_deal_user_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4868 (class 2606 OID 59892)
-- Name: company_admin_audit_logs company_admin_audit_logs_actor_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_admin_audit_logs
    ADD CONSTRAINT company_admin_audit_logs_actor_user_id_users_id_fk FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 4869 (class 2606 OID 59897)
-- Name: company_admin_audit_logs company_admin_audit_logs_target_company_id_companies_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_admin_audit_logs
    ADD CONSTRAINT company_admin_audit_logs_target_company_id_companies_id_fk FOREIGN KEY (target_company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;


--
-- TOC entry 4870 (class 2606 OID 59902)
-- Name: company_workspace_tab_settings company_workspace_tab_settings_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_workspace_tab_settings
    ADD CONSTRAINT company_workspace_tab_settings_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- TOC entry 4871 (class 2606 OID 59907)
-- Name: contact contact_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact
    ADD CONSTRAINT contact_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 4872 (class 2606 OID 59912)
-- Name: deal_investment deal_investment_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_investment
    ADD CONSTRAINT deal_investment_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.add_deal_form(id) ON DELETE CASCADE;


--
-- TOC entry 4873 (class 2606 OID 59917)
-- Name: deal_investor_class deal_investor_class_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_investor_class
    ADD CONSTRAINT deal_investor_class_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.add_deal_form(id) ON DELETE CASCADE;


--
-- TOC entry 4874 (class 2606 OID 59922)
-- Name: deal_lp_investor deal_lp_investor_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_lp_investor
    ADD CONSTRAINT deal_lp_investor_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 4875 (class 2606 OID 59927)
-- Name: deal_lp_investor deal_lp_investor_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_lp_investor
    ADD CONSTRAINT deal_lp_investor_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.add_deal_form(id) ON DELETE CASCADE;


--
-- TOC entry 4876 (class 2606 OID 59932)
-- Name: deal_member deal_member_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_member
    ADD CONSTRAINT deal_member_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 4877 (class 2606 OID 59937)
-- Name: deal_member deal_member_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_member
    ADD CONSTRAINT deal_member_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.add_deal_form(id) ON DELETE CASCADE;


--
-- TOC entry 4878 (class 2606 OID 59942)
-- Name: deals deals_company_id_companies_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_company_id_companies_id_fk FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- TOC entry 4879 (class 2606 OID 59947)
-- Name: member_admin_audit_logs member_admin_audit_logs_actor_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_admin_audit_logs
    ADD CONSTRAINT member_admin_audit_logs_actor_user_id_users_id_fk FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 4880 (class 2606 OID 59952)
-- Name: member_admin_audit_logs member_admin_audit_logs_target_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_admin_audit_logs
    ADD CONSTRAINT member_admin_audit_logs_target_user_id_users_id_fk FOREIGN KEY (target_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


-- Completed on 2026-04-11 12:02:12

--
-- PostgreSQL database dump complete
--

\unrestrict Q3jzxdZk5f0aNLXpxrFy5mZ9yPJ2Lb20VvEm7iPir1Qh0R6eTenjZlG5pI0EnZO

