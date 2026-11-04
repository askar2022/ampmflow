import Link from "next/link";
import { completePasswordReset } from "@/app/actions/auth";
import { LoginFrame } from "@/components/login/LoginFrame";
import { fieldClass, SubmitButton } from "@/components/login/SignInForm";
import { readPasswordResetToken } from "@/lib/password-reset";
import { isPlatformAdminEmail } from "@/lib/platform";
import { getSchoolIdentityById } from "@/lib/school";
import { findSchoolBySlug, schoolLoginPath } from "@/lib/school-slug";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{
    token?: string;
    school?: string;
    error?: string;
    company?: string;
  }>;
}) {
  const { token = "", school: slug, error, company } = await searchParams;
  const fromCompany = company === "1";
  const payload = token ? await readPasswordResetToken(token) : null;
  const platform = Boolean(payload && isPlatformAdminEmail(payload.email));
  const school =
    !platform && !fromCompany && slug ? await findSchoolBySlug(slug) : null;
  const identity = school ? await getSchoolIdentityById(school.id) : null;
  const signIn = fromCompany
    ? "/buscompany"
    : school
      ? schoolLoginPath(school.slug || slug || "")
      : "/login";
  const expired = !payload || error === "expired";

  return (
    <LoginFrame
      schoolName={platform || fromCompany ? null : identity?.name || school?.name}
      logoUrl={platform || fromCompany ? null : identity?.logoUrl}
      homeHref={platform ? "/" : signIn}
    >
      <div className="text-left">
        <h2 className="text-lg font-semibold text-navy short-h:text-base">
          Choose a new password
        </h2>
        {expired ? (
          <>
            <p className="mt-2 text-sm leading-6 text-ink">
              This reset link is missing or expired. Ask for a new one.
            </p>
            <Link
              href={
                fromCompany
                  ? "/login/forgot?company=1"
                  : platform || !slug
                    ? "/login/forgot"
                    : `/login/forgot?school=${encodeURIComponent(slug)}`
              }
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-[8px] bg-navy px-4 py-2.5 text-[16px] font-semibold text-white"
            >
              Send a new reset email
            </Link>
          </>
        ) : (
          <form action={completePasswordReset} className="mt-4 space-y-3">
            <input type="hidden" name="token" value={token} />
            {platform || !slug ? null : (
              <input type="hidden" name="schoolSlug" value={slug} />
            )}
            {fromCompany ? <input type="hidden" name="company" value="1" /> : null}
            <label
              className="block text-left text-sm font-semibold text-navy"
              htmlFor="new-password"
            >
              New password
              <input
                id="new-password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="8 or more characters"
                className={fieldClass}
              />
            </label>
            <label
              className="block text-left text-sm font-semibold text-navy"
              htmlFor="confirm-password"
            >
              Type it again
              <input
                id="confirm-password"
                name="confirm"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Type the same password"
                className={fieldClass}
              />
            </label>
            {error === "short" ? (
              <p className="text-sm text-red">Use at least 8 characters.</p>
            ) : null}
            {error === "match" ? (
              <p className="text-sm text-red">Those two passwords do not match.</p>
            ) : null}
            <SubmitButton pendingLabel="Saving…">Save new password</SubmitButton>
          </form>
        )}
        <Link
          href={platform ? "/" : signIn}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center text-sm font-semibold text-navy"
        >
          Back to Sign in
        </Link>
      </div>
    </LoginFrame>
  );
}
