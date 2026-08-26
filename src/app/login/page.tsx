import { loginAction } from "@/app/actions/auth";
import { createFirstAccount } from "@/app/actions/setup";
import { BrandMark, SCHOOL_NAME } from "@/components/BrandMark";
import { checkDatabase, prisma } from "@/lib/prisma";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const db = await checkDatabase();
  let userCount = 0;
  if (db.ok) {
    try {
      userCount = await prisma.user.count();
    } catch {
      userCount = 0;
    }
  }
  const needsSetup = db.ok && userCount === 0;

  const usedDirectHost = db.host.startsWith("db.") || db.port === "5432";
  const message =
    db.reason === "http"
      ? "DATABASE_URL is the website URL (https://…). Replace it with the Postgres URI that starts with postgresql://."
      : db.reason === "placeholder"
        ? "DATABASE_URL still contains [YOUR-PASSWORD]. Put your real database password in that spot, with no brackets."
        : db.reason === "missing" || error === "db"
          ? "Vercel still does not have a working DATABASE_URL. Add the Supabase Postgres URI (it must start with postgresql://), then redeploy. The Project URL and anon key are not enough."
          : db.reason === "unreachable"
            ? usedDirectHost
              ? `Vercel has DATABASE_URL, but it cannot reach ${db.host}:${db.port}. That is the direct database host. Vercel needs the pooler URI on port 6543.`
              : `Vercel has DATABASE_URL (${db.host || "unknown host"}${db.port ? `:${db.port}` : ""}), but login to Postgres failed. The password is usually wrong, or a special character in the password is not URL-encoded.`
            : error === "setup"
              ? "School name, your name, email, and password are required."
              : error
                ? "That email or password is not recognized."
                : "";

  return (
    <div className="flex min-h-full items-center justify-center px-6 py-16">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-line bg-card shadow-xl md:grid-cols-2">
        <div className="flex flex-col items-center bg-navy p-10 text-center text-white">
          <BrandMark light size={96} />
          <p className="mt-6 text-white/80">
            One place for every student’s AM plan and PM dismissal plan. Today’s
            exceptions expire automatically, so tomorrow’s list returns to the
            permanent assignment.
          </p>
        </div>
        <div className="p-10">
          {!db.ok ? (
            <>
              <h2 className="font-serif text-2xl">Connect the database</h2>
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red">
                {message}
              </p>
              <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-ink">
                <li>
                  In Supabase open <strong>Project Settings → Database</strong>.
                </li>
                <li>
                  Under Connection string, choose <strong>URI</strong> and{" "}
                  <strong>Transaction pooler</strong> (port{" "}
                  <code>6543</code>), not the direct connection (port{" "}
                  <code>5432</code>).
                </li>
                <li>
                  Replace <code>[YOUR-PASSWORD]</code> with the database
                  password. If the password has <code>@</code>, <code>#</code>,
                  or <code>%</code>, encode it (<code>@</code> becomes{" "}
                  <code>%40</code>).
                </li>
                <li>
                  In Vercel, edit <strong>DATABASE_URL</strong> for Production
                  to that one line. It must start with{" "}
                  <code>postgresql://</code> and include{" "}
                  <code>pooler.supabase.com:6543</code>.
                </li>
                <li>Save, Redeploy, then refresh this page.</li>
              </ol>
              <p className="mt-4 text-sm text-muted">
                Example shape (your real password in the middle, no brackets):
                <br />
                <code className="break-all text-xs">
                  postgresql://postgres.iardxvlhuapmlmqqrtgr:PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require
                </code>
              </p>
            </>
          ) : needsSetup ? (
            <>
              <h2 className="font-serif text-2xl">Create the first account</h2>
              <p className="mt-1 text-sm text-muted">
                Create the Sankofa Prep coordinator account. Add teachers and
                other staff after you sign in.
              </p>
              {error === "setup" ? (
                <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red">
                  School name, your name, email, and password are required.
                </p>
              ) : null}
              <form action={createFirstAccount} className="mt-6 space-y-4">
                <label className="block text-sm font-medium">
                  School name
                  <input
                    name="schoolName"
                    required
                    defaultValue={SCHOOL_NAME}
                    className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2"
                  />
                </label>
                <label className="block text-sm font-medium">
                  Your name
                  <input
                    name="name"
                    required
                    className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2"
                  />
                </label>
                <label className="block text-sm font-medium">
                  Email
                  <input
                    name="email"
                    type="email"
                    required
                    className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2"
                  />
                </label>
                <label className="block text-sm font-medium">
                  Password
                  <input
                    name="password"
                    type="password"
                    required
                    minLength={8}
                    className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2"
                  />
                </label>
                <button className="w-full rounded-xl bg-navy px-4 py-2.5 font-semibold text-white hover:bg-navy-deep">
                  Create account and continue
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="font-serif text-2xl">Sign in</h2>
              <p className="mt-1 text-sm text-muted">
                Use the email and password for your staff account.
              </p>
              {error && error !== "db" ? (
                <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red">
                  That email or password is not recognized.
                </p>
              ) : null}
              <form action={loginAction} className="mt-6 space-y-4">
                <label className="block text-sm font-medium">
                  Email
                  <input
                    name="email"
                    type="email"
                    required
                    autoComplete="username"
                    className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2"
                  />
                </label>
                <label className="block text-sm font-medium">
                  Password
                  <input
                    name="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2"
                  />
                </label>
                <button className="w-full rounded-xl bg-navy px-4 py-2.5 font-semibold text-white hover:bg-navy-deep">
                  Open tracker
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
