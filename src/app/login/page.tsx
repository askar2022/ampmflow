import { loginAction } from "@/app/actions/auth";

const accounts = [
  ["Transportation Coordinator", "coordinator@riverside.edu"],
  ["School Administrator", "admin@riverside.edu"],
  ["Teacher (Room 202)", "evasquez@riverside.edu"],
  ["Front Desk", "frontdesk@riverside.edu"],
  ["Bus Company", "dispatch@citytransit.example"],
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-full items-center justify-center px-6 py-16">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-line bg-card shadow-xl md:grid-cols-2">
        <div className="bg-navy p-10 text-white">
          <p className="text-xs uppercase tracking-[0.24em] text-gold">
            Riverside Elementary
          </p>
          <h1 className="mt-3 font-serif text-4xl leading-tight">
            Bus & Dismissal Tracker
          </h1>
          <p className="mt-4 text-white/80">
            One place for every student’s AM plan and PM dismissal plan. Today’s
            exceptions expire automatically, so tomorrow’s list returns to the
            permanent assignment.
          </p>
          <ul className="mt-8 space-y-2 text-sm text-white/75">
            <li>Today-only changes never replace the regular plan</li>
            <li>Teachers see a read-only classroom list before dismissal</li>
            <li>Every change is stored in the audit history</li>
          </ul>
        </div>
        <div className="p-10">
          <h2 className="font-serif text-2xl">Sign in</h2>
          <p className="mt-1 text-sm text-muted">
            Demo password for every account:{" "}
            <span className="font-semibold text-ink">Riverside!2026</span>
          </p>
          {error ? (
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
                defaultValue="coordinator@riverside.edu"
                className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2"
              />
            </label>
            <label className="block text-sm font-medium">
              Password
              <input
                name="password"
                type="password"
                required
                defaultValue="Riverside!2026"
                className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2"
              />
            </label>
            <button className="w-full rounded-xl bg-navy px-4 py-2.5 font-semibold text-white hover:bg-navy-deep">
              Open tracker
            </button>
          </form>
          <div className="mt-8 text-sm">
            <p className="font-semibold text-ink">Demo accounts</p>
            <ul className="mt-2 space-y-1 text-muted">
              {accounts.map(([role, email]) => (
                <li key={email}>
                  <span className="text-ink">{role}:</span> {email}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
