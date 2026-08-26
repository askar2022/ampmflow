import { loginAction } from "@/app/actions/auth";
import { createFirstAccount } from "@/app/actions/setup";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  let needsSetup = false;
  let schoolName = "Your school";

  if (isDatabaseConfigured()) {
    try {
      const [users, school] = await Promise.all([
        prisma.user.count(),
        prisma.school.findFirst({ select: { name: true } }),
      ]);
      needsSetup = users === 0;
      if (school?.name) schoolName = school.name;
    } catch {
      needsSetup = true;
    }
  }

  const message =
    error === "db"
      ? "The app is not connected to the database yet. In Vercel, set DATABASE_URL to the Supabase Postgres URI (it starts with postgresql://)."
      : error === "setup"
        ? "School name, your name, email, and password are required."
        : error
          ? "That email or password is not recognized."
          : "";

  return (
    <div className="flex min-h-full items-center justify-center px-6 py-16">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-line bg-card shadow-xl md:grid-cols-2">
        <div className="bg-navy p-10 text-white">
          <p className="text-xs uppercase tracking-[0.24em] text-gold">
            {schoolName}
          </p>
          <h1 className="mt-3 font-serif text-4xl leading-tight">
            Bus & Dismissal Tracker
          </h1>
          <p className="mt-4 text-white/80">
            One place for every student’s AM plan and PM dismissal plan. Today’s
            exceptions expire automatically, so tomorrow’s list returns to the
            permanent assignment.
          </p>
        </div>
        <div className="p-10">
          {needsSetup ? (
            <>
              <h2 className="font-serif text-2xl">Create the first account</h2>
              <p className="mt-1 text-sm text-muted">
                No users are in the database yet. Create your school and the
                transportation coordinator. You can add teachers, reception, and
                other staff after you sign in.
              </p>
              {message ? (
                <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red">
                  {message}
                </p>
              ) : null}
              <form action={createFirstAccount} className="mt-6 space-y-4">
                <label className="block text-sm font-medium">
                  School name
                  <input
                    name="schoolName"
                    required
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
                Use the email and password created for your staff account.
              </p>
              {message ? (
                <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red">
                  {message}
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
