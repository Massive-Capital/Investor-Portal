--
-- PostgreSQL database dump
--

\restrict ZwxvZDJ7OfbSOqQOJ9z2SZ9bMdm3TZnJcjqJm30vmE6pkeseOKB3kihAZFPVIW1

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
    CONSTRAINT add_deal_form_deal_stage_check CHECK ((deal_stage = ANY (ARRAY['raising_capital'::text, 'asset_managing'::text, 'liquidated'::text])))
);


ALTER TABLE public.add_deal_form OWNER TO postgres;

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
\.


--
-- Data for Name: add_deal_form; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.add_deal_form (id, deal_name, deal_type, deal_stage, sec_type, close_date, owning_entity_name, funds_required_before_gp_sign, auto_send_funding_instructions, property_name, country, address_line_1, address_line_2, city, state, zip_code, images, created_at, updated_at, asset_image_path) FROM stdin;
be396466-64a3-4dab-91e5-e9499e54f858	Deal name 1	flexible_fund	raising_capital	506_b	2026-03-28	Deal name llc	t	f	property 1	US	\N	\N	Bengaluru	\N	\N	{}	2026-03-29 14:42:09.988301	2026-03-29 14:42:09.988301	deal-assets/dealname1_1774775529803.svg
85649863-15d4-4b7e-8988-5982a32f982c	Deal Name 2	exchange_1031	asset_managing	regulation_crowdfunding	2026-04-23	Deal Name LLC 2	t	t	Property one	GB	\N	\N	ww	\N	\N	{}	2026-03-29 15:36:15.210333	2026-03-29 15:36:15.210333	deal-assets/dealname2_1774778775029.svg
463ba02d-4bf0-4391-b232-5628906beeea	Deal Name3	exchange_1031	raising_capital	506_c	2026-04-30	Deal Name LLC 3	t	t	Property 1	US	\N	\N	City	\N	\N	{}	2026-03-29 15:52:05.020046	2026-03-29 15:52:05.020046	deal-assets/logo_7603f839-aec5-4f02-85eb-9aaa13e7392c_1774779724578.png
\.


--
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
\.


--
-- Data for Name: company_admin_audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.company_admin_audit_logs (id, actor_user_id, target_company_id, action, reason, changes_json, created_at) FROM stdin;
1a7b2747-8cf1-4cb1-ad9b-2ae3fb35123b	b2c15cb6-1678-4819-9d24-6fdd8d192064	67e4cb39-ba18-471d-8f48-5f250ee8cc96	company_edit	Reason	{"name": {"to": "Acme", "from": "Acme Capital"}}	2026-03-30 08:52:24.189184+05:30
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
74adfdaa-2bbd-4a5a-ba85-e943ac6845e5	b2c15cb6-1678-4819-9d24-6fdd8d192064	7f86eaae-42de-4e52-ac85-e5fddaf15279	member_edit	qqqqq	{"userStatus": {"to": "inactive", "from": "active"}}	2026-03-29 01:26:38.600274+05:30
15680fc2-d798-4aaa-8aab-8abafbe831e3	b2c15cb6-1678-4819-9d24-6fdd8d192064	c13c4bb4-7be3-4b45-b8fe-80be1e5b3895	member_suspend	qqq	{"userStatus": {"to": "inactive", "from": "active"}}	2026-03-29 10:34:33.936067+05:30
74b37bf6-c0e5-44fa-a155-02b9d115392c	b2c15cb6-1678-4819-9d24-6fdd8d192064	a97892d9-6f8b-4e09-99ce-fe213ef634c3	member_suspend	Reason	{"userStatus": {"to": "inactive", "from": "active"}}	2026-03-29 19:05:59.652546+05:30
1a965d5a-ff60-45a4-abf2-d601c4cc24e1	b2c15cb6-1678-4819-9d24-6fdd8d192064	a97892d9-6f8b-4e09-99ce-fe213ef634c3	member_edit	Reson	{"userStatus": {"to": "active", "from": "inactive"}}	2026-03-29 19:06:15.9672+05:30
\.


--
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
\.


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE SET; Schema: drizzle; Owner: postgres
--

SELECT pg_catalog.setval('drizzle.__drizzle_migrations_id_seq', 5, true);


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
-- PostgreSQL database dump complete
--

\unrestrict ZwxvZDJ7OfbSOqQOJ9z2SZ9bMdm3TZnJcjqJm30vmE6pkeseOKB3kihAZFPVIW1

