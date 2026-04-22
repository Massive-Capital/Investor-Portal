--
-- PostgreSQL database dump
--

\restrict 0jowSEQErxQu3JoVGogZxPi7MegSdgIWjQOBAOTE32FsQEGKzFrjDdYIeSCELnf

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

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
    offering_investor_preview_json text,
    CONSTRAINT add_deal_form_deal_stage_check CHECK ((deal_stage = ANY (ARRAY['draft'::text, 'Draft'::text, 'raising_capital'::text, 'capital_raising'::text, 'asset_managing'::text, 'managing_asset'::text, 'liquidated'::text])))
);


ALTER TABLE public.add_deal_form OWNER TO postgres;

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
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying NOT NULL
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
    organization_id uuid
);


ALTER TABLE public.contact OWNER TO postgres;

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
    investor_role text DEFAULT ''::text NOT NULL
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
    committed_amount text DEFAULT ''::text NOT NULL
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
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_investor_profiles OWNER TO postgres;

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
-- Name: __drizzle_migrations id; Type: DEFAULT; Schema: drizzle; Owner: postgres
--

ALTER TABLE ONLY drizzle.__drizzle_migrations ALTER COLUMN id SET DEFAULT nextval('drizzle.__drizzle_migrations_id_seq'::regclass);


--
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
22	76656b7b82dde3faae9703d99a1f69f0e2efbc700e367bb887f5f2e5241022f4	1890700000000
23	c2180f3f1750866aa7ba52cd3378d2b59296cfe4659526c781ea9c277d145c00	1890800000000
24	74df743a4a27cdfeac3bd2315fa106fa45a2d0a791c18d6efc799411c99175cc	1890900000000
25	63c30599021314b4687d8a9dedb262b1b004ce944a0f875aeed0aa46f01be357	1891000000000
26	4eec8209a4b05ca9d54731498fef3952d4d88f85023988f71aa9f79a2562b6ad	1891100000000
\.


--
-- Data for Name: add_deal_form; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.add_deal_form (id, deal_name, deal_type, deal_stage, sec_type, close_date, owning_entity_name, funds_required_before_gp_sign, auto_send_funding_instructions, property_name, country, address_line_1, address_line_2, city, state, zip_code, images, created_at, updated_at, asset_image_path, organization_id, investor_summary_html, gallery_cover_image_url, key_highlights_json, deal_announcement_title, deal_announcement_message, offering_status, offering_visibility, show_on_investbase, internal_name, offering_overview_asset_ids, offering_gallery_paths, offering_preview_token, offering_investor_preview_json) FROM stdin;
d9747637-1acb-4e22-b177-1b9c051c820f	Testing the deal	direct_syndication	raising_capital	506_b	2026-05-31	Entity name	f	t	Brigade Theme Park	US	1st cross Norway	\N	Aberdeen	WA	89999	{}	2026-04-21 05:56:26.752742	2026-04-21 05:56:26.752742	deal-assets/d9747637-1acb-4e22-b177-1b9c051c820f/untitled_3a2d364d-5049-46d3-8aa0-ddc35daad23d_1776731289600.jpg;deal-assets/d9747637-1acb-4e22-b177-1b9c051c820f/untitled_62c4eb2b-6700-4015-8270-8c902b085231_1776731289798.jpg	\N	<p>Brigade Group is a major real estate developer based in <strong>Bengaluru</strong>, known for residential, commercial, and hospitality projects.</p><p>Their properties include apartments, villas, office spaces, and retail developments across key Indian cities.</p><p>They focus on modern design, integrated townships, and quality construction standards.</p>	\N	\N	\N	\N	draft_hidden	show_on_dashboard	f		[]	["deal-assets/d9747637-1acb-4e22-b177-1b9c051c820f/untitled_3a2d364d-5049-46d3-8aa0-ddc35daad23d_1776731289600.jpg","deal-assets/d9747637-1acb-4e22-b177-1b9c051c820f/untitled_62c4eb2b-6700-4015-8270-8c902b085231_1776731289798.jpg"]	vN7eOnYEudnqRKOI.ohKRe1lvLCXWVUVRggBZ9A.ts2re8QX5bSpolcP2RPNTgeRUEo8ERSWVIJVBbWPM_KdUw--	{"v":1,"visibility":{"make_announcement":true,"overview":true,"offering_information":true,"gallery":true,"summary":true,"documents":true,"assets":true,"key_highlights":true,"funding_instructions":true},"sections":[{"id":"section-1776732092292","sectionLabel":"Offering","documentLabel":"Offering","visibility":"Offering page","sharedWithScope":"offering_page","requireLpReview":false,"dateAdded":"21-Apr-2026","nestedDocuments":[{"id":"section-1776732092292-nest-0","name":"Investor_Portal_13Apr2026_17Apr2026.pdf","url":"/uploads/deal-assets/d9747637-1acb-4e22-b177-1b9c051c820f/investor-portal-13apr2026-17apr2026_07dc09ea-c503-41f4-b5b1-cb8b9afc00e3_1776732094769.pdf","dateAdded":"21-Apr-2026","lpDisplaySectionId":"section-1776732092292"}]}]}
af91786a-9d9d-4c40-9db1-34713d519cf6	Tech Venture Series A	fund	raising_capital	506_c	2026-04-30	Entity Name	f	t	Brigade	US	Street address line 1	Street address line 1	Abbeville	AL	99000	{}	2026-04-21 16:46:06.054732	2026-04-21 16:46:06.054732	deal-assets/af91786a-9d9d-4c40-9db1-34713d519cf6/untitled_364eb24d-3a4c-413c-8cc0-42bf0672483d_1776770194542.jpg;deal-assets/af91786a-9d9d-4c40-9db1-34713d519cf6/untitled_0a95ea86-5f11-4133-91cb-613a47a21af8_1776770195457.jpg	593aa380-ce63-498c-8002-7ad6fb4dde26	\N	\N	\N	\N	\N	draft_hidden	show_on_dashboard	f		[]	["deal-assets/af91786a-9d9d-4c40-9db1-34713d519cf6/untitled_364eb24d-3a4c-413c-8cc0-42bf0672483d_1776770194542.jpg","deal-assets/af91786a-9d9d-4c40-9db1-34713d519cf6/untitled_0a95ea86-5f11-4133-91cb-613a47a21af8_1776770195457.jpg"]	qgUBKr1UPNrWsoPb.A2PWVYo3TYmhrY1wwKSGuQ.vCGvGsGPTTl2ymIf0ceJHduDHWqdXWepn20o70t4KlCpFY5i	{"v":1,"visibility":{"make_announcement":true,"overview":true,"offering_information":true,"gallery":true,"summary":true,"documents":true,"assets":true,"key_highlights":true,"funding_instructions":true},"sections":[]}
f1e672e6-049b-43f1-924d-521412272e3a	Check Deal	fund	liquidated	506_b	2026-05-06	Entity names	f	t	hellos	US	sssss	1st cross	Abbeville	AL	23456	{}	2026-04-22 08:51:37.431495	2026-04-22 08:51:37.431495	deal-assets/f1e672e6-049b-43f1-924d-521412272e3a/untitled_4fcc704e-d46d-4ed3-8ca2-c1918b46dd9b_1776828155931.jpg;deal-assets/f1e672e6-049b-43f1-924d-521412272e3a/untitled_adcc0917-216a-4d05-b7b3-94bc55617faf_1776828159114.jpg	593aa380-ce63-498c-8002-7ad6fb4dde26	\N	\N	\N	\N	\N	draft_hidden	show_on_dashboard	f		[]	["deal-assets/f1e672e6-049b-43f1-924d-521412272e3a/untitled_4fcc704e-d46d-4ed3-8ca2-c1918b46dd9b_1776828155931.jpg","deal-assets/f1e672e6-049b-43f1-924d-521412272e3a/untitled_adcc0917-216a-4d05-b7b3-94bc55617faf_1776828159114.jpg"]	Izl-B9g8CJc_WKwE.VBsPY6-yzOnJk623P0TeWQ.4L86CitMfXxSxCIRflrz-r1bx1cx9kYdDIZi11XyqjGp2lsn	{"v":1,"visibility":{"make_announcement":true,"overview":true,"offering_information":true,"gallery":true,"summary":true,"documents":true,"assets":true,"key_highlights":true,"funding_instructions":true},"sections":[]}
9845af28-435f-446d-8045-f4b64145199d	Checking the deal	direct_syndication	raising_capital	506_b	2026-04-30	hey	f	t	Tech Avenu	US	1st crsoo norway	1st crsoo norway	Abbeville	AL	78787	{}	2026-04-21 06:14:12.11044	2026-04-21 06:14:12.11044	deal-assets/9845af28-435f-446d-8045-f4b64145199d/ip-img_ecd1d4e0-900f-4587-89ba-a0ca050ee38b_1776732317020.jpg;deal-assets/9845af28-435f-446d-8045-f4b64145199d/ip-img_b39848dd-1c4e-45d7-8cdf-32967fcf9ff7_1776732322730.jpg;deal-assets/9845af28-435f-446d-8045-f4b64145199d/ip-img_caf664aa-1029-446e-b957-67739e02c2fa_1776732323006.jpg	593aa380-ce63-498c-8002-7ad6fb4dde26	An exclusive investment opportunity combining strategic location, strong fundamentals, and consistent return potential.	\N	\N	\N	\N	draft_hidden	show_on_dashboard	f		[]	["deal-assets/9845af28-435f-446d-8045-f4b64145199d/ip-img_ecd1d4e0-900f-4587-89ba-a0ca050ee38b_1776732317020.jpg","deal-assets/9845af28-435f-446d-8045-f4b64145199d/ip-img_b39848dd-1c4e-45d7-8cdf-32967fcf9ff7_1776732322730.jpg","deal-assets/9845af28-435f-446d-8045-f4b64145199d/ip-img_caf664aa-1029-446e-b957-67739e02c2fa_1776732323006.jpg"]	dCKPEqgCLV5PzEwT.M7PtNN0Bgdj66Q_3TfPNTg.8Yyxl0RrnMXwo0NXBUmu6UBD8VSIoTxOCQ3yM06xDLgVipsq	{"v":1,"visibility":{"make_announcement":true,"overview":true,"offering_information":true,"gallery":true,"summary":true,"documents":true,"assets":true,"key_highlights":true,"funding_instructions":true},"sections":[{"id":"section-1776741126299","sectionLabel":"document one","documentLabel":"document one","visibility":"LP Investor","sharedWithScope":"lp_investor","requireLpReview":false,"dateAdded":"21-Apr-2026","nestedDocuments":[{"id":"section-1776741126299-nest-0","name":"Investor_Portal_13Apr2026_17Apr2026.pdf","url":"/uploads/deal-assets/9845af28-435f-446d-8045-f4b64145199d/investor-portal-13apr2026-17apr2026_25d86b9e-130c-4d7a-9825-ba10fe0dc3c0_1776741127056.pdf","dateAdded":"21-Apr-2026","lpDisplaySectionId":"section-1776741126299"}]}]}
\.


--
-- Data for Name: assigning_deal_user; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.assigning_deal_user (deal_id, user_id, user_added_deal) FROM stdin;
d9747637-1acb-4e22-b177-1b9c051c820f	96a69107-79db-4b5b-8b2b-56f07e1e9c0a	b2c15cb6-1678-4819-9d24-6fdd8d192064
9845af28-435f-446d-8045-f4b64145199d	3123f66e-8317-41c2-bd4c-7b07244ef133	3123f66e-8317-41c2-bd4c-7b07244ef133
9845af28-435f-446d-8045-f4b64145199d	f150bdf7-722e-4f30-b12c-31847b0ff1d4	f150bdf7-722e-4f30-b12c-31847b0ff1d4
9845af28-435f-446d-8045-f4b64145199d	9bd64ab6-f37a-448e-bcba-022523c40221	9bd64ab6-f37a-448e-bcba-022523c40221
\.


--
-- Data for Name: companies; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.companies (id, name, created_at, updated_at, status) FROM stdin;
380a60f3-6ebf-43d4-9949-f4ee012eb426	Massive	2026-04-21 05:50:47.105537+05:30	2026-04-21 05:50:47.105537+05:30	active
af6822c5-3a6d-4ce4-8b1a-7b9baf481698	Beetle	2026-04-21 05:50:47.105537+05:30	2026-04-21 05:50:47.105537+05:30	active
593aa380-ce63-498c-8002-7ad6fb4dde26	Company Q	2026-04-21 05:59:16.07688+05:30	2026-04-21 05:59:16.07688+05:30	active
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

COPY public.contact (id, first_name, last_name, email, phone, note, tags, lists, owners, created_by, created_at, status, last_edit_reason, is_portal_user, organization_id) FROM stdin;
3ab910a1-b343-4e76-a285-77fc1268be7d	Jordan	Lee	jordan@gmail.com	6757465465		[]	[]	["Thulasi V"]	bcacd044-32b1-451e-bfe9-313a67276197	2026-04-21 06:16:04.993774+05:30	active	\N	t	593aa380-ce63-498c-8002-7ad6fb4dde26
3c6a3517-dda4-4611-90ac-702f398f4eba	investor	c	investorc@gmail.com	9876543210		[]	[]	["nick j"]	96a69107-79db-4b5b-8b2b-56f07e1e9c0a	2026-04-21 06:07:15.551867+05:30	active	\N	t	593aa380-ce63-498c-8002-7ad6fb4dde26
39df6d85-3234-41fc-ad4a-d0ed329a0894	investor	d	investord@gmail.com	5765715647		[]	[]	["Thulasi V"]	bcacd044-32b1-451e-bfe9-313a67276197	2026-04-22 09:20:51.638608+05:30	active	\N	t	593aa380-ce63-498c-8002-7ad6fb4dde26
\.


--
-- Data for Name: deal_investment; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.deal_investment (id, deal_id, offering_id, contact_id, profile_id, status, investor_class, doc_signed_date, commitment_amount, extra_contribution_amounts, document_storage_path, created_at, contact_display_name, investor_role) FROM stdin;
91867664-849a-4e45-b6fa-ec09ed4e8d2a	9845af28-435f-446d-8045-f4b64145199d		39df6d85-3234-41fc-ad4a-d0ed329a0894	individual		Class A - Limited Partners	\N	11480.5	[]	\N	2026-04-22 11:08:54.559986+05:30		lp_investors
e169dda6-bd69-4981-90cd-1c4d4acf6766	d9747637-1acb-4e22-b177-1b9c051c820f	primary	96a69107-79db-4b5b-8b2b-56f07e1e9c0a		Draft (hidden to investors)	Class A - Limited Partners	\N	0	[]	\N	2026-04-21 06:11:52.543514+05:30	nick j	Lead Sponsor
00e21db6-6c1e-437c-b771-281c2896cbdf	9845af28-435f-446d-8045-f4b64145199d	primary	3ab910a1-b343-4e76-a285-77fc1268be7d		Coming soon (no new investments allowed)	Class A - Limited Partners	\N	0	[]	\N	2026-04-21 08:42:34.503216+05:30	Jordan Lee	Lead Sponsor
e903bee8-fe99-4058-9063-66a2db45fb0c	9845af28-435f-446d-8045-f4b64145199d		3c6a3517-dda4-4611-90ac-702f398f4eba	individual		Class A - Limited Partners	\N	70	[]	\N	2026-04-21 08:47:11.242586+05:30		lp_investors
\.


--
-- Data for Name: deal_investor_class; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.deal_investor_class (id, deal_id, name, subscription_type, entity_name, start_date, offering_size, minimum_investment, price_per_unit, status, visibility, created_at, updated_at, raise_amount_distributions, billing_raise_quota, advanced_options_json) FROM stdin;
39ec0323-72d8-4a5c-a703-8e91b97233c4	d9747637-1acb-4e22-b177-1b9c051c820f	Class A - Limited Partners	lp		2026-05-31	$45,000	$75,000	$500	closed		2026-04-21 06:09:06.208049+05:30	2026-04-21 06:09:06.208049+05:30	$6,000		{"investmentType":"equity","classPreferredReturnType":"","entityLegalOwnershipPct":"0%","entityLegalOwnershipFrozen":false,"distributionSharePct":"0%","distributionShareFrozen":false,"maximumInvestment":"$25,000","targetIrr":"","assetTags":["All"],"waitlistStatus":"off","hurdles":[]}
a190200c-858f-4c54-8933-8d55133f3753	9845af28-435f-446d-8045-f4b64145199d	Class A - Limited Partners	lp		2026-05-31	$12,000	$50,000		closed		2026-04-21 08:41:29.361465+05:30	2026-04-21 08:41:29.361465+05:30	$1,234		{"investmentType":"equity","classPreferredReturnType":"","entityLegalOwnershipPct":"0%","entityLegalOwnershipFrozen":false,"distributionSharePct":"0%","distributionShareFrozen":false,"maximumInvestment":"","targetIrr":"","assetTags":["All"],"waitlistStatus":"off","hurdles":[]}
\.


--
-- Data for Name: deal_lp_investor; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.deal_lp_investor (id, deal_id, added_by, contact_member_id, investor_class, send_invitation_mail, created_at, updated_at, profile_id, email, role, committed_amount) FROM stdin;
98679992-14b3-41cb-8309-bcc40a313fb1	9845af28-435f-446d-8045-f4b64145199d	3123f66e-8317-41c2-bd4c-7b07244ef133	3c6a3517-dda4-4611-90ac-702f398f4eba	Class A - Limited Partners	yes	2026-04-21 08:45:28.059628+05:30	2026-04-22 08:38:33.127+05:30	individual	investorc@gmail.com	lp_investors	32110
eeb1bd2c-0f8f-461d-a229-48eb5847e0ef	9845af28-435f-446d-8045-f4b64145199d	bcacd044-32b1-451e-bfe9-313a67276197	39df6d85-3234-41fc-ad4a-d0ed329a0894	Class A - Limited Partners	yes	2026-04-22 09:21:04.753303+05:30	2026-04-22 16:12:22.306+05:30	individual	investord@gmail.com	lp_investors	11480.5
\.


--
-- Data for Name: deal_member; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.deal_member (id, deal_id, added_by, contact_member_id, deal_member_role, send_invitation_mail, created_at, updated_at) FROM stdin;
bb6e317c-6bc9-4118-9400-2e595db7c194	d9747637-1acb-4e22-b177-1b9c051c820f	b2c15cb6-1678-4819-9d24-6fdd8d192064	96a69107-79db-4b5b-8b2b-56f07e1e9c0a	Lead Sponsor	yes	2026-04-21 06:11:52.572022+05:30	2026-04-21 06:12:17.981+05:30
c1c855a4-14fb-4e82-9cd2-f09f05e830f2	9845af28-435f-446d-8045-f4b64145199d	bcacd044-32b1-451e-bfe9-313a67276197	3ab910a1-b343-4e76-a285-77fc1268be7d	Lead Sponsor	yes	2026-04-21 08:42:34.593239+05:30	2026-04-21 08:42:38.535+05:30
\.


--
-- Data for Name: deals; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.deals (id, company_id, created_at) FROM stdin;
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
-- Data for Name: user_beneficiaries; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_beneficiaries (id, user_id, full_name, relationship, tax_id, phone, email, address_query, archived, created_at) FROM stdin;
\.


--
-- Data for Name: user_investor_profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_investor_profiles (id, user_id, profile_name, profile_type, added_by, investments_count, archived, created_at) FROM stdin;
\.


--
-- Data for Name: user_saved_addresses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_saved_addresses (id, user_id, full_name_or_company, country, street1, street2, city, state, zip, check_memo, distribution_note, archived, created_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, username, password_hash, role, user_status, user_signup_completed, organization_id, first_name, last_name, phone, created_at, updated_at, company_name, invite_expires_at) FROM stdin;
b2c15cb6-1678-4819-9d24-6fdd8d192064	platform.admin@example.com	platformadmin	$2b$10$i6AuCoVjx3XxI32s8hRia.d1flK87VWianJ2VFr5l7Mloa1sTPeMe	platform_admin	active	true	\N	Platform	Admin		2026-03-28 19:32:33.541251+05:30	2026-03-28 19:32:33.541251+05:30	Massive Capital	\N
f006a063-9c3e-4de9-a5c3-b6afa50782a5	sanjay@massive.capital	Sanjay	$2b$10$XjsErn6s3L6mvYS8g78c6OWcZl1qS.NVNK27hoUT0cQU.U45Oe/4.	company_admin	active	true	380a60f3-6ebf-43d4-9949-f4ee012eb426	Sanjay	Aggarwal	6417811933	2026-03-31 00:12:12.951993+05:30	2026-03-31 00:12:12.951993+05:30	Massive	\N
2f1b05e2-3cdc-4d2a-90a1-dfddaac4b1c5	mikeb@maximum-service.com	Bahian	$2b$10$YPmluYml/h6GpxPKIUTHq.C.3FqQ.Xz32203agYdHHws2xTnz2/zq	company_admin	active	true	af6822c5-3a6d-4ce4-8b1a-7b9baf481698	Michael	Bailey	13463132823	2026-03-31 00:22:33.10401+05:30	2026-03-31 00:22:33.10401+05:30	Beetle	\N
bcacd044-32b1-451e-bfe9-313a67276197	thulasiv557@gmail.com	Thulasi	$2b$10$mEaAd7c50y9u/ujpMctUOO/LXufn/ZAZS0/9fuuJenjBkTXcV5XDW	company_admin	active	true	593aa380-ce63-498c-8002-7ad6fb4dde26	Thulasi	V	9812345678	2026-04-21 06:00:48.422415+05:30	2026-04-21 06:02:05.272+05:30	Company Q	\N
96a69107-79db-4b5b-8b2b-56f07e1e9c0a	nick@q.com	nick	$2b$10$7PvCgMtYozyjS3iPMBmt2Om4SpwdaFk.9stiuYP23UXmSYljiUtx2	platform_user	active	true	593aa380-ce63-498c-8002-7ad6fb4dde26	nick	j	5646545354	2026-04-21 06:03:11.807768+05:30	2026-04-21 06:05:11.245+05:30	Company Q	\N
3123f66e-8317-41c2-bd4c-7b07244ef133	jordan@gmail.com	Jordan	$2b$10$EJ8rmJ5lQPl03yT9BrrtA.DPZ6BxtSNlNKOjg3Kanpm7NocSKd/.W	deal_participant	active	true	593aa380-ce63-498c-8002-7ad6fb4dde26	Jordan	Lee	6757465465	2026-04-21 08:44:37.632772+05:30	2026-04-21 08:44:37.632772+05:30	Company Q	\N
f150bdf7-722e-4f30-b12c-31847b0ff1d4	investorc@gmail.com	investorc	$2b$10$TlORvYDf6JaMjl4GpCSAPuiP0kKQ3whc5y9P6jjeOfoT0pcDfnteC	deal_participant	active	true	593aa380-ce63-498c-8002-7ad6fb4dde26	investor	c	9876543210	2026-04-21 08:46:47.881048+05:30	2026-04-21 08:46:47.881048+05:30	Company Q	\N
9bd64ab6-f37a-448e-bcba-022523c40221	investord@gmail.com	investor	$2b$10$9REVvgQwBZ0X/MKT0E/6yuT1wf0599CJZWjo6mfdoxU5DFm9kzMmG	deal_participant	active	true	593aa380-ce63-498c-8002-7ad6fb4dde26	investor	d	5765715647	2026-04-22 10:29:54.32729+05:30	2026-04-22 10:29:54.32729+05:30	Company Q	\N
\.


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE SET; Schema: drizzle; Owner: postgres
--

SELECT pg_catalog.setval('drizzle.__drizzle_migrations_id_seq', 26, true);


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
-- Name: user_beneficiaries user_beneficiaries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_beneficiaries
    ADD CONSTRAINT user_beneficiaries_pkey PRIMARY KEY (id);


--
-- Name: user_investor_profiles user_investor_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_investor_profiles
    ADD CONSTRAINT user_investor_profiles_pkey PRIMARY KEY (id);


--
-- Name: user_saved_addresses user_saved_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_saved_addresses
    ADD CONSTRAINT user_saved_addresses_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: contact_organization_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX contact_organization_id_idx ON public.contact USING btree (organization_id);


--
-- Name: deal_lp_investor_deal_id_contact_member_id_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX deal_lp_investor_deal_id_contact_member_id_uidx ON public.deal_lp_investor USING btree (deal_id, contact_member_id);


--
-- Name: deal_lp_investor_email_lower_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX deal_lp_investor_email_lower_idx ON public.deal_lp_investor USING btree (lower(TRIM(BOTH FROM email))) WHERE (NULLIF(TRIM(BOTH FROM email), ''::text) IS NOT NULL);


--
-- Name: deal_member_deal_id_contact_member_id_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX deal_member_deal_id_contact_member_id_uidx ON public.deal_member USING btree (deal_id, contact_member_id);


--
-- Name: user_beneficiaries_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_beneficiaries_user_id_idx ON public.user_beneficiaries USING btree (user_id);


--
-- Name: user_investor_profiles_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_investor_profiles_user_id_idx ON public.user_investor_profiles USING btree (user_id);


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
-- Name: user_beneficiaries user_beneficiaries_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_beneficiaries
    ADD CONSTRAINT user_beneficiaries_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_investor_profiles user_investor_profiles_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_investor_profiles
    ADD CONSTRAINT user_investor_profiles_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


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

\unrestrict 0jowSEQErxQu3JoVGogZxPi7MegSdgIWjQOBAOTE32FsQEGKzFrjDdYIeSCELnf

