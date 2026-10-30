import Link from "next/link";
import { requestPasswordReset } from "@/app/actions/auth";
import { LoginFrame } from "@/components/login/LoginFrame";
import { fieldClass, SubmitButton } from "@/components/login/SignInForm";
import { getSchoolIdentityById } from "@/lib/school";
import { findSchoolBySlug, schoolLoginPath } from "@/lib/school-slug";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ school?: string; sent?: string; error?: string }>;
}) {
  const { school: slug, sent, error } = await searchParams;
  const school = slug ? await findSchoolBySlug(slug) : null;
  const identity = school ? await getSchoolIdentityById(school.id) : null;
  const signIn = school ? schoolLoginPath(school.slug || slug || "") : "/login";

  return (
    <LoginFrame
      schoolName={identity?.name || school?.name}
      logoUrl={identity?.logoUrl}
      homeHref={signIn}
    >
      <div className="text-left">
        <h2 className="text-lg font-semibold text-navy short-h:text-base">
          Forgot password
        </h2>
        {sent === "1" ? (
          <p className="mt-2 text-sm leading-6 text-ink">
            If that email is an AMPM Flow login, we sent a reset link. Open
            that email on your phone and choose a new password. Check spam if
            you do not see it.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm leading-6 text-ink">
              Type the email you use to sign in. We will send a reset link to
              that address only. It does not go to the whole school.
            </p>
            <form action={requestPasswordReset} className="mt-4 space-y-3">
              {school ? (
                <input
                  type="hidden"
                  name="schoolSlug"
                  value={school.slug || slug}
                />
              ) : null}
              <label
                className="block text-left text-sm font-semibold text-navy"
                htmlFor="reset-email"
              >
                Email
                <input
                  id="reset-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="username"
                  placeholder="Enter your email"
                  className={fieldClass}
                />
              </label>
              {error ? <p className="text-sm text-red">{error}</p> : null}
              <SubmitButton pendingLabel="Sending…">Send reset email</SubmitButton>
            </form>
          </>
        )}
        <p className="mt-4 text-sm leading-6 text-[#4b5563]">
          Forgot which email Metro or another school uses? Sign in on the main
          AMPM Flow page as the administrator and look under Schools.
        </p>
        <Link
          href={signIn}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-[8px] border border-line px-4 py-2.5 text-[16px] font-semibold text-navy"
        >
          Back to Sign in
        </Link>
      </div>
    </LoginFrame>
  );
}
