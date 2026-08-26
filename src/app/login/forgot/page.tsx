import Link from "next/link";
import { LoginFrame } from "@/components/login/LoginFrame";

export default function ForgotPasswordPage() {
  return (
    <LoginFrame>
      <div className="text-left">
        <h2 className="text-lg font-semibold text-navy short-h:text-base">
          Forgot password
        </h2>
        <p className="mt-2 text-sm leading-6 text-ink">
          Ask your transportation coordinator to reset your staff password in
          Users.
        </p>
        <Link
          href="/login"
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-[8px] bg-navy px-4 py-2.5 text-[16px] font-semibold text-white hover:bg-navy-deep"
        >
          Back to Sign in
        </Link>
      </div>
    </LoginFrame>
  );
}
