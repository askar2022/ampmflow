import { checkDatabase, prisma } from "@/lib/prisma";
import { LoginFrame } from "@/components/login/LoginFrame";
import { SignInForm } from "@/components/login/SignInForm";
import { SetupForm } from "@/components/login/SetupForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; requested?: string }>;
}) {
  const { error, requested } = await searchParams;
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
    <LoginFrame variant={needsSetup ? "signup" : "signin"}>
      {!db.ok ? (
        <div className="text-left">
          <h2 className="text-lg font-semibold text-navy short-h:text-base">
            Connect the database
          </h2>
          <p className="mt-2 text-sm text-red">{dbMessage}</p>
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
          <h2 className="text-lg font-semibold text-navy short-h:text-base">
            Create account
          </h2>
          <p className="mt-0.5 text-sm text-[#7b8490]">
            Create your AMPM Flow administrator account.
          </p>
          <div className="mt-3 short-h:mt-2.5">
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
          <h2 id="login-heading" className="text-lg font-semibold text-navy short-h:text-base">
            Welcome back
          </h2>
          <p className="mt-0.5 text-sm text-[#7b8490]">
            Sign in to manage today’s transportation.
          </p>
          <div className="mt-3 short-h:mt-2.5">
            <SignInForm
              authError={
                error === "pending"
                  ? "Your account is waiting for an administrator to approve it."
                  : error === "1"
                    ? "That email or password is not recognized."
                    : undefined
              }
              notice={
                requested === "1"
                  ? "Your request was sent. An administrator must approve it before you can sign in."
                  : undefined
              }
            />
          </div>
        </div>
      )}
    </LoginFrame>
  );
}
