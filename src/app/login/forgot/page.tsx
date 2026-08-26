import Link from "next/link";
import { getSchoolIdentity } from "@/lib/school";
import { checkDatabase } from "@/lib/prisma";
import { LoginFrame } from "@/components/login/LoginFrame";

export default async function ForgotPasswordPage() {
  const db = await checkDatabase();
  const school = db.ok ? await getSchoolIdentity() : null;

  return (
    <LoginFrame school={school}>
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-navy">
          Forgot password
        </h2>
        <p className="mt-3 text-sm leading-6 text-ink">
          Ask your transportation coordinator or administrator to reset your
          staff password in Users. AMPM Flow does not email a reset link from
          this screen.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-teal px-4 py-2.5 text-[16px] font-semibold text-white hover:bg-teal-deep"
        >
          Back to Sign in
        </Link>
      </div>
    </LoginFrame>
  );
}
