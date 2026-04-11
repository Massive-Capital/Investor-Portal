-- Seed companies from pg_dump COPY (dev/staging). Idempotent: existing ids are skipped.
INSERT INTO public.companies (id, name, created_at, updated_at, status) VALUES
  (
    '1c57fcf7-1cd8-4e3a-a7bb-1f14ba3ef09e'::uuid,
    'Test',
    '2026-03-28 22:13:05.693866+05:30'::timestamptz,
    '2026-03-29 00:33:47.358+05:30'::timestamptz,
    'active'
  ),
  (
    '10fcad37-bf26-4187-b16e-1a070bd84377'::uuid,
    'Testing',
    '2026-03-29 10:36:22.603757+05:30'::timestamptz,
    '2026-03-29 10:36:22.603757+05:30'::timestamptz,
    'active'
  ),
  (
    '3d281cb8-089f-4a63-bcb0-bcc39d0b88c2'::uuid,
    'Demo Company',
    '2026-03-29 12:42:58.245999+05:30'::timestamptz,
    '2026-03-29 12:42:58.245999+05:30'::timestamptz,
    'active'
  ),
  (
    '0c66fb18-fe7d-4010-b6b7-cfdcb24c5792'::uuid,
    'Company1',
    '2026-03-29 18:27:59.544209+05:30'::timestamptz,
    '2026-03-29 18:27:59.544209+05:30'::timestamptz,
    'active'
  ),
  (
    '2bd2ae86-d61b-411a-8a6e-95d3cbf6b0b6'::uuid,
    'wqe',
    '2026-03-29 19:42:40.35639+05:30'::timestamptz,
    '2026-03-29 19:42:40.35639+05:30'::timestamptz,
    'active'
  ),
  (
    '5e7de556-ce13-46c7-a217-160e322c49f2'::uuid,
    'Demo',
    '2026-03-30 08:46:14.837764+05:30'::timestamptz,
    '2026-03-30 08:46:14.837764+05:30'::timestamptz,
    'active'
  ),
  (
    '67e4cb39-ba18-471d-8f48-5f250ee8cc96'::uuid,
    'Acme',
    '2026-03-29 09:57:43.023875+05:30'::timestamptz,
    '2026-03-30 08:52:24.186+05:30'::timestamptz,
    'active'
  ),
  (
    '7308587d-1d76-4448-9d0b-bd155e5bd281'::uuid,
    'Company01',
    '2026-03-30 08:55:28.659947+05:30'::timestamptz,
    '2026-03-30 08:55:28.659947+05:30'::timestamptz,
    'active'
  ),
  (
    '380a60f3-6ebf-43d4-9949-f4ee012eb426'::uuid,
    'Massive',
    '2026-03-31 00:12:12.94893+05:30'::timestamptz,
    '2026-03-31 00:12:12.94893+05:30'::timestamptz,
    'active'
  ),
  (
    'af6822c5-3a6d-4ce4-8b1a-7b9baf481698'::uuid,
    'Beetle',
    '2026-03-31 00:22:33.099847+05:30'::timestamptz,
    '2026-03-31 00:22:33.099847+05:30'::timestamptz,
    'active'
  )
ON CONFLICT (id) DO NOTHING;
