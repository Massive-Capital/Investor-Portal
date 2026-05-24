--
-- PostgreSQL database dump
--

\restrict IwLcP5ERgITFRVbGE37VQXdVDaNyrJho9dxNXZmvNoQR1CnYM8iJtkHsRRUutCf

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

-- Started on 2026-04-15 10:08:30

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
-- TOC entry 5051 (class 0 OID 0)
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
    last_edit_reason text,
    is_portal_user boolean DEFAULT false NOT NULL,
    company_id uuid,
    organization_id uuid
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    profile_id text DEFAULT ''::text NOT NULL,
    email text,
    role text
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
-- TOC entry 5031 (class 0 OID 59691)
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
15	4b5a83c79f661e29d2c8b0b53de841ba6a7edb7e1c658443c898de951568de3d	1890000000000
16	5004f2a861c20fdcf7e5c4404ea027576b77bc377711543202db78a3860beb94	1890100000000
17	f22ad9543848c3a4208288052be50f608ef4fd8c753fb035e6b95aa3c0d9f43a	1890200000000
18	3ffe9fcee6154d4f0ba9ec339cebf8edd89998fc7fbc3af363396aef25733d50	1890300000000
19	e48563c18a1c2468df3a5a839bce6f49f6d25e7db6a4689e1d00f1ed1704b925	1890400000000
20	c1771dddf1cf1880762b5cb2fdb704c007d0623764b99cded2bb7cc5cef3606f	1890500000000
21	a77da002b1442521da4daa806ebf3a97d3aef7839724375ba4293444c4853b62	1890600000000
\.


--
-- TOC entry 5033 (class 0 OID 59697)
-- Dependencies: 220
-- Data for Name: add_deal_form; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.add_deal_form (id, deal_name, deal_type, deal_stage, sec_type, close_date, owning_entity_name, funds_required_before_gp_sign, auto_send_funding_instructions, property_name, country, address_line_1, address_line_2, city, state, zip_code, images, created_at, updated_at, asset_image_path, organization_id, investor_summary_html, gallery_cover_image_url, key_highlights_json, deal_announcement_title, deal_announcement_message, offering_status, offering_visibility, show_on_investbase, internal_name, offering_overview_asset_ids, offering_gallery_paths, offering_preview_token) FROM stdin;
13984f94-33b4-4123-a698-51d76cd6c0c3	Green Tech Park Fund	direct_syndication	raising_capital	506_c	2026-04-30	Entity Name	f	t	Embassy Tech Village	US	789 Broadway	\N	New York City	NY	10003	{}	2026-04-15 00:05:16.68516	2026-04-15 00:05:16.68516	deal-assets/ip-img_298bb5a3-20f1-4194-babd-2de7fa6940fb_1776191983268.jpg;deal-assets/ip-img_f6ead593-6e44-449c-addc-88b60140a270_1776191983442.jpg	a8521699-83c3-4d4b-b836-4f696fe8bf2a	\N	\N	\N	\N	\N	draft_hidden	only_visible_with_link	f		[]	["deal-assets/ip-img_298bb5a3-20f1-4194-babd-2de7fa6940fb_1776191983268.jpg","deal-assets/ip-img_f6ead593-6e44-449c-addc-88b60140a270_1776191983442.jpg"]	Ne-vcVa2aDhXmywd.-HPs3a832gs--uVJqkm2Nw.QjxxF3LF7Mr1SMyerSbZpTLL1uZCQwGuaZKxuElBB95VLB6E
a0a23400-2f8f-4c73-8a41-8ce69ba0c67d	Tech Venture Series A	direct_syndication	raising_capital	506_b	2026-05-07	entity	t	t	Beach lake	US	1st cross	\N	Anchorage Municipality	AK	89766	{}	2026-04-15 01:18:43.900595	2026-04-15 01:18:43.900595	deal-assets/untitled_466c881d-eb99-4a51-8c25-cfd41803a8c2_1776196196185.jpg;deal-assets/untitled_205599aa-5146-472d-b422-40487f370e77_1776196196236.jpg	0ef75629-c032-4d0a-9f85-2b7547c30300	\N	\N	\N	\N	\N	draft_hidden	only_visible_with_link	f		[]	["deal-assets/untitled_466c881d-eb99-4a51-8c25-cfd41803a8c2_1776196196185.jpg","deal-assets/untitled_205599aa-5146-472d-b422-40487f370e77_1776196196236.jpg"]	IdPTvjmNfgaVKECY.HtqHAusi27kRpJytFBvIhg.exgjekr2QuU2gYNniVPU4xfiAkOwUGYJ8jXucPXrCTsKtbss
\.


--
-- TOC entry 5034 (class 0 OID 59715)
-- Dependencies: 221
-- Data for Name: assigning_deal_user; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.assigning_deal_user (deal_id, user_id, user_added_deal) FROM stdin;
13984f94-33b4-4123-a698-51d76cd6c0c3	27d6b21f-c27c-46df-a31c-0d59a288025f	27d6b21f-c27c-46df-a31c-0d59a288025f
13984f94-33b4-4123-a698-51d76cd6c0c3	27b191e2-7122-46aa-aaa5-b8f40ac8bdb4	27b191e2-7122-46aa-aaa5-b8f40ac8bdb4
13984f94-33b4-4123-a698-51d76cd6c0c3	3740fa4c-2e36-4592-8d4a-b7b86461260e	3740fa4c-2e36-4592-8d4a-b7b86461260e
a0a23400-2f8f-4c73-8a41-8ce69ba0c67d	19b9af0b-72cf-4a22-812f-01bb20e30b1e	19b9af0b-72cf-4a22-812f-01bb20e30b1e
a0a23400-2f8f-4c73-8a41-8ce69ba0c67d	3740fa4c-2e36-4592-8d4a-b7b86461260e	19b9af0b-72cf-4a22-812f-01bb20e30b1e
\.


--
-- TOC entry 5035 (class 0 OID 59718)
-- Dependencies: 222
-- Data for Name: companies; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.companies (id, name, created_at, updated_at, status) FROM stdin;
a8521699-83c3-4d4b-b836-4f696fe8bf2a	Company A	2026-04-15 00:03:11.05591+05:30	2026-04-15 00:03:11.05591+05:30	active
0ef75629-c032-4d0a-9f85-2b7547c30300	Company B	2026-04-15 00:03:22.285339+05:30	2026-04-15 00:03:22.285339+05:30	active
\.


--
-- TOC entry 5036 (class 0 OID 59725)
-- Dependencies: 223
-- Data for Name: company_admin_audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.company_admin_audit_logs (id, actor_user_id, target_company_id, action, reason, changes_json, created_at) FROM stdin;
\.


--
-- TOC entry 5037 (class 0 OID 59732)
-- Dependencies: 224
-- Data for Name: company_workspace_tab_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.company_workspace_tab_settings (company_id, tab_key, payload, updated_at) FROM stdin;
\.


--
-- TOC entry 5038 (class 0 OID 59739)
-- Dependencies: 225
-- Data for Name: contact; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.contact (id, first_name, last_name, email, phone, note, tags, lists, owners, created_by, created_at, status, last_edit_reason, is_portal_user, company_id, organization_id) FROM stdin;
e5bc72fe-b672-4729-b906-77005bfcad66	nick	mike	nickMike@gmail.com	5765715647		[]	[]	["thulasi v"]	42e7c185-b84c-4109-89a6-6a32712fe461	2026-04-15 00:10:05.998013+05:30	active	\N	t	\N	a8521699-83c3-4d4b-b836-4f696fe8bf2a
d2bc0677-371a-43cd-9327-79de63ea6026	John	Doe	john@doe.com	8675764755		[]	[]	["thulasi v"]	42e7c185-b84c-4109-89a6-6a32712fe461	2026-04-15 01:01:47.41424+05:30	active	\N	t	\N	a8521699-83c3-4d4b-b836-4f696fe8bf2a
7bf730f0-4f12-46ed-9cd3-dc64759a6b3a	Investor	A	investora@gmail.com	86757575445		[]	[]	["thulasi v"]	42e7c185-b84c-4109-89a6-6a32712fe461	2026-04-15 00:14:04.746081+05:30	active	\N	t	\N	a8521699-83c3-4d4b-b836-4f696fe8bf2a
43509992-884f-4206-a8c0-2293e08dcab9	Investor	A	investora@gmail.com	86757575445		[]	[]	["tom jerry"]	2de5371e-23a4-4a89-91e8-40a06eeab253	2026-04-15 01:26:32.629905+05:30	active	\N	t	\N	0ef75629-c032-4d0a-9f85-2b7547c30300
2d6c1816-1985-4222-a950-9e74be6371f7	sophia	turner	sophia.turner@gmail.com	66757656757		[]	[]	["lucas baker"]	030ff848-f81f-4e0b-bd84-6264f3e427ce	2026-04-15 01:30:02.999068+05:30	active	\N	t	\N	0ef75629-c032-4d0a-9f85-2b7547c30300
\.


--
-- TOC entry 5039 (class 0 OID 59752)
-- Dependencies: 226
-- Data for Name: deal_investment; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.deal_investment (id, deal_id, offering_id, contact_id, profile_id, status, investor_class, doc_signed_date, commitment_amount, extra_contribution_amounts, document_storage_path, created_at, contact_display_name, investor_role) FROM stdin;
25a44042-8968-49e8-b20a-ec60e7da3014	13984f94-33b4-4123-a698-51d76cd6c0c3	primary	e5bc72fe-b672-4729-b906-77005bfcad66		Draft (hidden to investors)	Class A - Limited Partners	\N	0	[]	\N	2026-04-15 00:12:02.732895+05:30	nick mike	Lead Sponsor
00fce5d0-0e22-4380-aeda-46824668acc3	13984f94-33b4-4123-a698-51d76cd6c0c3	primary	d2bc0677-371a-43cd-9327-79de63ea6026		Draft (hidden to investors)	Class A - Limited Partners	\N	0	[]	\N	2026-04-15 01:01:59.753283+05:30	John Doe	Co-sponsor
2bf6de99-ace7-491d-a129-6fa82cd0aa96	13984f94-33b4-4123-a698-51d76cd6c0c3		7bf730f0-4f12-46ed-9cd3-dc64759a6b3a	individual		Class A - Limited Partners	\N	5000	[]	\N	2026-04-15 01:13:32.794575+05:30		lp_investors
50c65c76-297a-4a24-ab51-14f7cf4f7f16	a0a23400-2f8f-4c73-8a41-8ce69ba0c67d	primary	2d6c1816-1985-4222-a950-9e74be6371f7		Draft (hidden to investors)	Class A - Limited Partners	\N	0	[]	\N	2026-04-15 01:31:00.937471+05:30	sophia turner	admin sponsor
ed861572-b365-4b59-9307-0092f0c77dd2	a0a23400-2f8f-4c73-8a41-8ce69ba0c67d		43509992-884f-4206-a8c0-2293e08dcab9	individual		Class A - Limited Partners	\N	800	[]	\N	2026-04-15 01:44:28.033535+05:30		lp_investors
\.


--
-- TOC entry 5040 (class 0 OID 59768)
-- Dependencies: 227
-- Data for Name: deal_investor_class; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.deal_investor_class (id, deal_id, name, subscription_type, entity_name, start_date, offering_size, minimum_investment, price_per_unit, status, visibility, created_at, updated_at, raise_amount_distributions, billing_raise_quota, advanced_options_json) FROM stdin;
f9dd9459-0d0b-42ab-bbc0-69f9bb48789d	13984f94-33b4-4123-a698-51d76cd6c0c3	Class A - Limited Partners	lp		2026-04-30	$100,000	$10,000		closed		2026-04-15 00:11:53.224528+05:30	2026-04-15 00:11:53.224528+05:30	$1,000		{"investmentType":"equity","classPreferredReturnType":"","entityLegalOwnershipPct":"0%","entityLegalOwnershipFrozen":false,"distributionSharePct":"0%","distributionShareFrozen":false,"maximumInvestment":"","targetIrr":"","assetTags":["All"],"waitlistStatus":"off","hurdles":[]}
ebb249f9-16e9-4ecf-80dd-936fcc971083	a0a23400-2f8f-4c73-8a41-8ce69ba0c67d	Class A - Limited Partners	lp		2026-04-30	$25,000	$2,500		closed		2026-04-15 01:30:45.888272+05:30	2026-04-15 01:30:45.888272+05:30	$1,000		{"investmentType":"equity","classPreferredReturnType":"","entityLegalOwnershipPct":"0%","entityLegalOwnershipFrozen":false,"distributionSharePct":"0%","distributionShareFrozen":false,"maximumInvestment":"","targetIrr":"","assetTags":["All"],"waitlistStatus":"off","hurdles":[]}
\.


--
-- TOC entry 5041 (class 0 OID 59788)
-- Dependencies: 228
-- Data for Name: deal_lp_investor; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.deal_lp_investor (id, deal_id, added_by, contact_member_id, investor_class, send_invitation_mail, created_at, updated_at, profile_id, email, role) FROM stdin;
9eb8e0cc-51e0-4f95-ac11-ed0213fe1adf	a0a23400-2f8f-4c73-8a41-8ce69ba0c67d	19b9af0b-72cf-4a22-812f-01bb20e30b1e	43509992-884f-4206-a8c0-2293e08dcab9	Class A - Limited Partners	yes	2026-04-15 01:42:34.837198+05:30	2026-04-15 01:44:28.027+05:30	individual	investora@gmail.com	lp_investors
2b1ce20d-b511-4984-becd-de0b66688a19	13984f94-33b4-4123-a698-51d76cd6c0c3	27d6b21f-c27c-46df-a31c-0d59a288025f	7bf730f0-4f12-46ed-9cd3-dc64759a6b3a	Class A - Limited Partners	yes	2026-04-15 01:10:29.624288+05:30	2026-04-15 01:13:32.784+05:30	individual	investora@gmail.com	lp_investors
\.


--
-- TOC entry 5042 (class 0 OID 59799)
-- Dependencies: 229
-- Data for Name: deal_member; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.deal_member (id, deal_id, added_by, contact_member_id, deal_member_role, send_invitation_mail, created_at, updated_at) FROM stdin;
06808e40-5f3e-47ce-836c-b7d957e17e07	13984f94-33b4-4123-a698-51d76cd6c0c3	42e7c185-b84c-4109-89a6-6a32712fe461	d2bc0677-371a-43cd-9327-79de63ea6026	Co-sponsor	yes	2026-04-15 01:01:59.763131+05:30	2026-04-15 01:02:35.738+05:30
f57703a2-3e74-406d-ab31-2e7a73bf046c	a0a23400-2f8f-4c73-8a41-8ce69ba0c67d	030ff848-f81f-4e0b-bd84-6264f3e427ce	2d6c1816-1985-4222-a950-9e74be6371f7	admin sponsor	yes	2026-04-15 01:31:00.940886+05:30	2026-04-15 01:31:05.423+05:30
d9b188db-6f9a-4a21-9661-8065f9a82f18	13984f94-33b4-4123-a698-51d76cd6c0c3	42e7c185-b84c-4109-89a6-6a32712fe461	e5bc72fe-b672-4729-b906-77005bfcad66	Lead Sponsor	yes	2026-04-15 00:12:02.746692+05:30	2026-04-15 00:13:16.289+05:30
\.


--
-- TOC entry 5043 (class 0 OID 59810)
-- Dependencies: 230
-- Data for Name: deals; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.deals (id, company_id, created_at) FROM stdin;
\.


--
-- TOC entry 5044 (class 0 OID 59815)
-- Dependencies: 231
-- Data for Name: member_admin_audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.member_admin_audit_logs (id, actor_user_id, target_user_id, action, reason, changes_json, created_at) FROM stdin;
da1628f7-2cbf-4411-b9fe-1d1a7d511109	405e3919-cb89-4b2d-a28e-b7b9d0fe3867	2de5371e-23a4-4a89-91e8-40a06eeab253	member_edit	change	{"role": {"to": "company_user", "from": "platform_user"}}	2026-04-15 01:28:08.573104+05:30
\.


--
-- TOC entry 5045 (class 0 OID 59822)
-- Dependencies: 232
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, username, password_hash, role, user_status, user_signup_completed, organization_id, first_name, last_name, phone, created_at, updated_at, company_name, invite_expires_at) FROM stdin;
405e3919-cb89-4b2d-a28e-b7b9d0fe3867	platform.admin@example.com	platformadmin	$2b$10$i6AuCoVjx3XxI32s8hRia.d1flK87VWianJ2VFr5l7Mloa1sTPeMe	platform_admin	active	true	\N	Platform	Admin		2026-04-15 00:01:21.873378+05:30	2026-04-15 00:01:21.873378+05:30	Massive Capital	\N
42e7c185-b84c-4109-89a6-6a32712fe461	thulasi.v@qualesce.com	thulasi	$2b$10$ha4BY2zGlmRxtFMo0z/uR.SaPV1KcLyM.Fs4gxy2DmS.G/8/R5dWS	company_admin	active	true	a8521699-83c3-4d4b-b836-4f696fe8bf2a	thulasi	v	9876543210	2026-04-15 00:03:42.323186+05:30	2026-04-15 00:04:42.95+05:30	Company A	\N
27d6b21f-c27c-46df-a31c-0d59a288025f	nickmike@gmail.com	nick	$2b$10$ymKDLtve3gJZmv7ElqyXu.Cf9HnP.l60jYz1n/Z7OdE8IV0UXtSTa	deal_participant	active	true	a8521699-83c3-4d4b-b836-4f696fe8bf2a	nick	mike	5765715647	2026-04-15 00:24:06.328498+05:30	2026-04-15 00:24:06.328498+05:30	Company A	\N
27b191e2-7122-46aa-aaa5-b8f40ac8bdb4	john@doe.com	john	$2b$10$09g3e.FZ.zcFVLZ7KcdYAum6FxQpEel35.1UQu5TLD7JjywdclR.q	deal_participant	active	true	a8521699-83c3-4d4b-b836-4f696fe8bf2a	John	Doe	8675764755	2026-04-15 01:04:02.413368+05:30	2026-04-15 01:04:02.413368+05:30	Company A	\N
3740fa4c-2e36-4592-8d4a-b7b86461260e	investora@gmail.com	investor	$2b$10$BH8Nt4RooVVlNS63lQjXCetqk5Hp7TCmUUMi9nsN0Rwczymsy6lpu	deal_participant	active	true	a8521699-83c3-4d4b-b836-4f696fe8bf2a	Investor	A	86757575445	2026-04-15 01:12:32.875697+05:30	2026-04-15 01:12:32.875697+05:30	Company A	\N
030ff848-f81f-4e0b-bd84-6264f3e427ce	lucas@gmail.com	lucas	$2b$10$S6SF39zgud0MN4G2p6JVNOKmnUGHZyqSgb7NKSkxS5CZq5wH5uBQu	company_admin	active	true	0ef75629-c032-4d0a-9f85-2b7547c30300	lucas	baker	123456757	2026-04-15 01:17:05.783703+05:30	2026-04-15 01:18:27.288+05:30	Company B	\N
2de5371e-23a4-4a89-91e8-40a06eeab253	tom@gmail.com	tom	$2b$10$hFGQ.KebJu44Eqp6E2ssG.orxguKp3aMV2WlTwJzz14aENmANtIsK	company_user	active	true	0ef75629-c032-4d0a-9f85-2b7547c30300	tom	jerry	9876543210	2026-04-15 01:20:28.731183+05:30	2026-04-15 01:28:08.571+05:30	Company B	\N
19b9af0b-72cf-4a22-812f-01bb20e30b1e	sophia.turner@gmail.com	sophia	$2b$10$cEBknQxmzv5mNerenOkbVOJNAu9qTEc47XcpzLXkWfsNCzFJYH5oq	deal_participant	active	true	0ef75629-c032-4d0a-9f85-2b7547c30300	sophia	turner	66757656757	2026-04-15 01:33:23.103098+05:30	2026-04-15 01:33:23.103098+05:30	Company B	\N
\.


--
-- TOC entry 5052 (class 0 OID 0)
-- Dependencies: 219
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE SET; Schema: drizzle; Owner: postgres
--

SELECT pg_catalog.setval('drizzle.__drizzle_migrations_id_seq', 21, true);


--
-- TOC entry 4833 (class 2606 OID 59839)
-- Name: __drizzle_migrations __drizzle_migrations_pkey; Type: CONSTRAINT; Schema: drizzle; Owner: postgres
--

ALTER TABLE ONLY drizzle.__drizzle_migrations
    ADD CONSTRAINT __drizzle_migrations_pkey PRIMARY KEY (id);


--
-- TOC entry 4835 (class 2606 OID 59841)
-- Name: add_deal_form add_deal_form_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.add_deal_form
    ADD CONSTRAINT add_deal_form_pkey PRIMARY KEY (id);


--
-- TOC entry 4837 (class 2606 OID 59843)
-- Name: assigning_deal_user assigning_deal_user_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assigning_deal_user
    ADD CONSTRAINT assigning_deal_user_pkey PRIMARY KEY (deal_id, user_id);


--
-- TOC entry 4839 (class 2606 OID 59845)
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- TOC entry 4841 (class 2606 OID 59847)
-- Name: company_admin_audit_logs company_admin_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_admin_audit_logs
    ADD CONSTRAINT company_admin_audit_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 4843 (class 2606 OID 59849)
-- Name: company_workspace_tab_settings company_workspace_tab_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_workspace_tab_settings
    ADD CONSTRAINT company_workspace_tab_settings_pkey PRIMARY KEY (company_id, tab_key);


--
-- TOC entry 4846 (class 2606 OID 59851)
-- Name: contact contact_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact
    ADD CONSTRAINT contact_pkey PRIMARY KEY (id);


--
-- TOC entry 4848 (class 2606 OID 59853)
-- Name: deal_investment deal_investment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_investment
    ADD CONSTRAINT deal_investment_pkey PRIMARY KEY (id);


--
-- TOC entry 4850 (class 2606 OID 59855)
-- Name: deal_investor_class deal_investor_class_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_investor_class
    ADD CONSTRAINT deal_investor_class_pkey PRIMARY KEY (id);


--
-- TOC entry 4853 (class 2606 OID 59857)
-- Name: deal_lp_investor deal_lp_investor_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_lp_investor
    ADD CONSTRAINT deal_lp_investor_pkey PRIMARY KEY (id);


--
-- TOC entry 4856 (class 2606 OID 59859)
-- Name: deal_member deal_member_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_member
    ADD CONSTRAINT deal_member_pkey PRIMARY KEY (id);


--
-- TOC entry 4858 (class 2606 OID 59861)
-- Name: deals deals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_pkey PRIMARY KEY (id);


--
-- TOC entry 4860 (class 2606 OID 59863)
-- Name: member_admin_audit_logs member_admin_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_admin_audit_logs
    ADD CONSTRAINT member_admin_audit_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 4862 (class 2606 OID 59865)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 4864 (class 2606 OID 59867)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 4866 (class 2606 OID 59869)
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- TOC entry 4844 (class 1259 OID 60129)
-- Name: contact_organization_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX contact_organization_id_idx ON public.contact USING btree (organization_id);


--
-- TOC entry 4851 (class 1259 OID 59870)
-- Name: deal_lp_investor_deal_id_contact_member_id_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX deal_lp_investor_deal_id_contact_member_id_uidx ON public.deal_lp_investor USING btree (deal_id, contact_member_id);


--
-- TOC entry 4854 (class 1259 OID 59871)
-- Name: deal_member_deal_id_contact_member_id_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX deal_member_deal_id_contact_member_id_uidx ON public.deal_member USING btree (deal_id, contact_member_id);


--
-- TOC entry 4867 (class 2606 OID 59872)
-- Name: add_deal_form add_deal_form_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.add_deal_form
    ADD CONSTRAINT add_deal_form_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- TOC entry 4868 (class 2606 OID 59877)
-- Name: assigning_deal_user assigning_deal_user_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assigning_deal_user
    ADD CONSTRAINT assigning_deal_user_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.add_deal_form(id) ON DELETE CASCADE;


--
-- TOC entry 4869 (class 2606 OID 59882)
-- Name: assigning_deal_user assigning_deal_user_user_added_deal_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assigning_deal_user
    ADD CONSTRAINT assigning_deal_user_user_added_deal_fkey FOREIGN KEY (user_added_deal) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 4870 (class 2606 OID 59887)
-- Name: assigning_deal_user assigning_deal_user_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assigning_deal_user
    ADD CONSTRAINT assigning_deal_user_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4871 (class 2606 OID 59892)
-- Name: company_admin_audit_logs company_admin_audit_logs_actor_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_admin_audit_logs
    ADD CONSTRAINT company_admin_audit_logs_actor_user_id_users_id_fk FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 4872 (class 2606 OID 59897)
-- Name: company_admin_audit_logs company_admin_audit_logs_target_company_id_companies_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_admin_audit_logs
    ADD CONSTRAINT company_admin_audit_logs_target_company_id_companies_id_fk FOREIGN KEY (target_company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;


--
-- TOC entry 4873 (class 2606 OID 59902)
-- Name: company_workspace_tab_settings company_workspace_tab_settings_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_workspace_tab_settings
    ADD CONSTRAINT company_workspace_tab_settings_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- TOC entry 4874 (class 2606 OID 59907)
-- Name: contact contact_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact
    ADD CONSTRAINT contact_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 4875 (class 2606 OID 60124)
-- Name: contact contact_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact
    ADD CONSTRAINT contact_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- TOC entry 4876 (class 2606 OID 59912)
-- Name: deal_investment deal_investment_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_investment
    ADD CONSTRAINT deal_investment_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.add_deal_form(id) ON DELETE CASCADE;


--
-- TOC entry 4877 (class 2606 OID 59917)
-- Name: deal_investor_class deal_investor_class_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_investor_class
    ADD CONSTRAINT deal_investor_class_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.add_deal_form(id) ON DELETE CASCADE;


--
-- TOC entry 4878 (class 2606 OID 59922)
-- Name: deal_lp_investor deal_lp_investor_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_lp_investor
    ADD CONSTRAINT deal_lp_investor_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 4879 (class 2606 OID 59927)
-- Name: deal_lp_investor deal_lp_investor_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_lp_investor
    ADD CONSTRAINT deal_lp_investor_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.add_deal_form(id) ON DELETE CASCADE;


--
-- TOC entry 4880 (class 2606 OID 59932)
-- Name: deal_member deal_member_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_member
    ADD CONSTRAINT deal_member_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 4881 (class 2606 OID 59937)
-- Name: deal_member deal_member_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_member
    ADD CONSTRAINT deal_member_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.add_deal_form(id) ON DELETE CASCADE;


--
-- TOC entry 4882 (class 2606 OID 59942)
-- Name: deals deals_company_id_companies_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_company_id_companies_id_fk FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- TOC entry 4883 (class 2606 OID 59947)
-- Name: member_admin_audit_logs member_admin_audit_logs_actor_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_admin_audit_logs
    ADD CONSTRAINT member_admin_audit_logs_actor_user_id_users_id_fk FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 4884 (class 2606 OID 59952)
-- Name: member_admin_audit_logs member_admin_audit_logs_target_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_admin_audit_logs
    ADD CONSTRAINT member_admin_audit_logs_target_user_id_users_id_fk FOREIGN KEY (target_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4885 (class 2606 OID 60150)
-- Name: users users_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.companies(id) ON DELETE SET NULL;


-- Completed on 2026-04-15 10:08:32

--
-- PostgreSQL database dump complete
--

\unrestrict IwLcP5ERgITFRVbGE37VQXdVDaNyrJho9dxNXZmvNoQR1CnYM8iJtkHsRRUutCf

