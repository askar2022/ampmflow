import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, homePath } from "@/lib/auth";
import { APP_NAME, APP_SUBTITLE } from "@/lib/school";

export default async function Home() {
  const session = await getSession();
  if (session) redirect(homePath(session.role));

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#f3f4f6] px-4 py-8">
      <div className="w-full max-w-3xl">
        <div className="text-center">
          <img
            src="/front_image.png"
            alt=""
            className="mx-auto h-auto w-[140px] object-contain mix-blend-multiply"
          />
          <h1 className="mt-2 text-[32px] font-semibold leading-none tracking-tight text-navy">
            {APP_NAME}
          </h1>
          <p className="mt-2 text-sm font-medium text-[#4b5563]">{APP_SUBTITLE}</p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <section className="rounded-[20px] border border-[#e8e8ea] bg-white p-6 shadow-[0_16px_48px_rgba(15,23,42,0.08)]">
            <h2 className="text-lg font-semibold text-navy">Already at a school</h2>
            <p className="mt-2 text-sm leading-6 text-[#4b5563]">
              Sign in to your school. You only see your own school. Need an
              account? Ask your administrator, or join your school.
            </p>
            <Link
              href="/login"
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-[8px] bg-navy px-4 py-2.5 text-[16px] font-semibold text-white hover:bg-navy-deep"
            >
              Sign in
            </Link>
            <p className="mt-3 text-center text-sm text-navy">
              Need an account?{" "}
              <Link href="/login/create" className="font-medium text-teal hover:text-teal-deep">
                Join your school
              </Link>
            </p>
          </section>

          <section className="rounded-[20px] border border-[#e8e8ea] bg-white p-6 shadow-[0_16px_48px_rgba(15,23,42,0.08)]">
            <h2 className="text-lg font-semibold text-navy">New school</h2>
            <p className="mt-2 text-sm leading-6 text-[#4b5563]">
              Request a separate school. You cannot sign in until AMPM Flow
              approves you. Existing staff do not use this form.
            </p>
            <Link
              href="/schools"
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-[8px] border border-navy px-4 py-2.5 text-[16px] font-semibold text-navy hover:bg-navy hover:text-white"
            >
              Request your school
            </Link>
          </section>
        </div>

        <p className="mt-6 text-center text-sm leading-6 text-[#6b7280]">
          School administrators create staff accounts under Users, or approve
          people who join their school. Regular staff never open a new school.
        </p>
      </div>
    </div>
  );
}
