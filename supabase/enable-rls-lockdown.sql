-- AMPM Flow / Supabase security lockdown
-- Paste into: Supabase → SQL Editor → Run
-- Project: https://iardxvlhuapmlmqqrtgr.supabase.co
--
-- Why: Supabase warns when public tables have RLS off. AMPM Flow talks to
-- Postgres only through Prisma (server DATABASE_URL). It does not use the
-- anon key or PostgREST. Turning RLS on with no public policies blocks
-- browser/API access while Prisma keeps working.

-- 1) Enable RLS on every public table (safe to re-run).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname NOT LIKE 'pg_%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',
      r.table_name
    );
  END LOOP;
END $$;

-- 2) Remove API roles from reading or changing app data.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

-- 3) Quick check: every table should show rls_enabled = true.
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY c.relname;
