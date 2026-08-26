import Link from "next/link";
import { getSchoolIdentity } from "@/lib/school";
import { checkDatabase } from "@/lib/prisma";
import { LoginFrame } from "@/components/login/LoginFrame";

export default async function ForgotPasswordPage() {
  const db = await checkDatabase();
  const school = db.ok ? await getSchoolIdentity() : null;

  return (
    <LoginFrame school={school}>
      <div className="text-left">
        <h2 className="text-xl font-semibold text-navy">Forgot password</h2>
        <p className="mt-3 text-sm leading-6 text-ink">
          Ask your transportation coordinator to reset your staff password in
          Users.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex w-full items-center justify-center rounded-[8px] bg-navy px-4 py-2.5 text-[16px] font-semibold text-white hover:bg-navy-deep"
        >
          Back to Sign in
        </Link>
      </div>
    </LoginFrame>
  );
}
