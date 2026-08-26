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

  const message =
    db.reason === "missing" || error === "db"
      ? "Vercel still does not have a working DATABASE_URL. Add the Supabase Postgres URI (it must start with postgresql://), then redeploy. The Project URL and anon key are not enough."
      : db.reason === "unreachable"
        ? "DATABASE_URL is set, but the app cannot reach Supabase. Use the Database connection string, include the database password, and set the variable for Production."
        : error === "setup"
          ? "School name, your name, email, and password are required."
          : error
            ? "That email or password is not recognized."
            : "";

  return (
    <div className="flex min-h-full items-center justify-center px-6 py-16">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-line bg-card shadow-xl md:grid-cols-2">
        <div className="bg-navy p-10 text-white">
          <BrandMark light size={72} />
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
                <li>Open Supabase → Project Settings → Database.</li>
                <li>Copy <strong>Connection string → URI</strong>.</li>
                <li>Replace the password placeholder with your database password.</li>
                <li>
                  In Vercel → Settings → Environment Variables, add{" "}
                  <strong>DATABASE_URL</strong> for Production. The value must
                  start with <code>postgresql://</code>.
                </li>
                <li>Also add <strong>SESSION_SECRET</strong> (any long secret).</li>
                <li>Redeploy, then refresh this page.</li>
              </ol>
              <p className="mt-4 text-sm text-muted">
                Do not use https://iardxvlhuapmlmqqrtgr.supabase.co or the anon
                key as DATABASE_URL.
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
