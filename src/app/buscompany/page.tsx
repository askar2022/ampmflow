import { LoginFrame } from "@/components/login/LoginFrame";
import { SignInForm } from "@/components/login/SignInForm";

export default async function BusCompanyLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reset?: string }>;
}) {
  const { error, reset } = await searchParams;

  return (
    <LoginFrame homeHref="/buscompany">
      <div>
        <h2
          id="login-heading"
          className="text-lg font-semibold text-navy short-h:text-base"
        >
          Welcome back
        </h2>
        <p className="mt-0.5 text-sm text-[#7b8490]">
          Sign in with the account your administrator created. Ask them if you
          need an account.
        </p>
        <div className="mt-3 short-h:mt-2.5">
          <SignInForm
            intent="company"
            helpText="Need an account? Ask your administrator."
            authError={
              error === "pending"
                ? "Your account is waiting for an administrator to approve it."
                : error === "staff"
                  ? "School staff use their school sign-in link."
                  : error === "1" || error === "db"
                    ? "That email or password is not recognized."
                    : undefined
            }
            notice={
              reset === "1"
                ? "Your password is updated. Sign in with the new one."
                : undefined
            }
          />
        </div>
      </div>
    </LoginFrame>
  );
}
