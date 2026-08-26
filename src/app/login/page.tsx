import { checkDatabase, prisma } from "@/lib/prisma";
import { getSchoolIdentity } from "@/lib/school";
import { LoginFrame } from "@/components/login/LoginFrame";
import { SignInForm } from "@/components/login/SignInForm";
import { SetupForm } from "@/components/login/SetupForm";

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
  const school = db.ok ? await getSchoolIdentity() : null;

  const usedDirectHost = db.host.startsWith("db.") || db.port === "5432";
  const dbMessage =
    db.reason === "http"
      ? "DATABASE_URL is the website URL (https://…). Replace it with the Postgres URI that starts with postgresql://."
      : db.reason === "placeholder"
        ? "DATABASE_URL still contains [YOUR-PASSWORD]. Put your real database password in that spot, with no brackets."
        : db.reason === "missing"
          ? "Vercel still does not have a working DATABASE_URL. Add the Supabase Postgres URI (it must start with postgresql://), then redeploy."
          : db.reason === "unreachable"
            ? usedDirectHost
              ? `Vercel has DATABASE_URL, but it cannot reach ${db.host}:${db.port}. Use the pooler URI on port 6543.`
              : `Vercel has DATABASE_URL (${db.host || "unknown host"}${db.port ? `:${db.port}` : ""}), but login to Postgres failed.`
            : "";

  return (
    <LoginFrame school={school}>
      {!db.ok ? (
        <div className="text-left">
          <h2 className="text-xl font-semibold text-navy">Connect the database</h2>
          <p className="mt-3 text-sm text-red">{dbMessage}</p>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-ink">
            <li>Open Supabase → Connect at the top of the project.</li>
            <li>
              Copy the <strong>Transaction pooler</strong> URI (port{" "}
              <code>6543</code>).
            </li>
            <li>Replace the password placeholder with your database password.</li>
            <li>
              In Vercel, set <strong>DATABASE_URL</strong> for Production.
            </li>
            <li>Redeploy, then refresh this page.</li>
          </ol>
        </div>
      ) : needsSetup ? (
        <div>
          <h2 className="text-xl font-semibold text-navy">Create the first account</h2>
          <p className="mt-1 text-sm text-muted">
            Create your school and transportation coordinator.
          </p>
          <div className="mt-6">
            <SetupForm
              error={
                error === "setup"
                  ? "School name, your name, email, and password are required."
                  : undefined
              }
            />
          </div>
        </div>
      ) : (
        <div>
          <h2 className="text-xl font-semibold text-navy">Welcome back</h2>
          <p className="mt-1 text-sm text-[#7b8490]">
            Sign in to manage today’s transportation.
          </p>
          <div className="mt-6">
            <SignInForm
              authError={
                error === "1"
                  ? "That email or password is not recognized."
                  : undefined
              }
            />
          </div>
        </div>
      )}
    </LoginFrame>
  );
}
