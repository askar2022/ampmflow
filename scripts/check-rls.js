require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

// Prefer direct connection for admin checks when pooler is unreachable.
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

const prisma = new PrismaClient();

async function main() {
  const tables = await prisma.$queryRawUnsafe(`
    SELECT c.relname AS table_name,
           c.relrowsecurity AS rls_enabled,
           c.relforcerowsecurity AS rls_forced
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
    ORDER BY c.relname
  `);

  const grants = await prisma.$queryRawUnsafe(`
    SELECT table_name, grantee, privilege_type
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND grantee IN ('anon', 'authenticated', 'public')
    ORDER BY table_name, grantee, privilege_type
  `);

  const policies = await prisma.$queryRawUnsafe(`
    SELECT schemaname, tablename, policyname, roles::text, cmd
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname
  `);

  const open = tables.filter((row) => !row.rls_enabled).map((row) => row.table_name);
  const locked = tables.filter((row) => row.rls_enabled).map((row) => row.table_name);

  console.log(
    JSON.stringify(
      {
        total: tables.length,
        rls_on: locked,
        rls_off: open,
        grants,
        policies,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(String(error.message || error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
