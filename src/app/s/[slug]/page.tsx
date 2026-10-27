import { LoginFrame } from "@/components/login/LoginFrame";
import { SignInForm } from "@/components/login/SignInForm";
import { getSchoolIdentityById } from "@/lib/school";
import { findSchoolBySlug, schoolLoginPath } from "@/lib/school-slug";

export default async function SchoolSignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;
  const school = await findSchoolBySlug(slug);
  const identity = school ? await getSchoolIdentityById(school.id) : null;

  if (!school) {
    return (
      <LoginFrame>
        <div>
          <h2 className="text-lg font-semibold text-navy">Sign in</h2>
          <p className="mt-2 text-sm text-[#7b8490]">
            This sign-in link is not active. Use the private link your school
            sent you, or contact your school administrator.
          </p>
        </div>
      </LoginFrame>
    );
  }

  return (
    <LoginFrame
      schoolName={identity?.name || school.name}
      logoUrl={identity?.logoUrl}
      homeHref={schoolLoginPath(school.slug || slug)}
    >
      <div>
        <h2 id="login-heading" className="text-lg font-semibold text-navy short-h:text-base">
          Welcome back
        </h2>
        <p className="mt-0.5 text-sm text-[#7b8490]">
          Sign in to {school.name}. Ask your administrator if you need an
          account.
        </p>
        <div className="mt-3 short-h:mt-2.5">
          <SignInForm
            schoolSlug={school.slug || slug}
            authError={
              error === "pending"
                ? "Your account is waiting for an administrator to approve it."
                : error === "1"
                  ? "That email or password is not recognized for this school."
                  : undefined
            }
          />
        </div>
      </div>
    </LoginFrame>
  );
}
