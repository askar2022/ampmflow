import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, homePath, isPlatformAdmin } from "@/lib/auth";
import { APP_NAME, APP_SUBTITLE } from "@/lib/school";
import { AddSchoolSignIn } from "@/components/landing/AddSchoolSignIn";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  if (session) {
    if (session.role === "ADMINISTRATOR" && (await isPlatformAdmin(session))) {
      redirect("/platform");
    }
    redirect(homePath(session.role));
  }
  const { error } = await searchParams;

  return (
    <div className="min-h-dvh bg-[#f3f4f6] px-3 py-4 sm:px-4 sm:py-8">
      <div className="mx-auto w-full max-w-5xl">
        <div className="overflow-hidden rounded-2xl border border-[#e8e8ea] bg-white shadow-[0_16px_48px_rgba(15,23,42,0.08)] sm:rounded-[24px]">
          <img
            src="/landingimage.png"
            alt=""
            className="h-44 w-full object-cover object-[70%_center] sm:h-72 sm:object-center md:h-96"
          />
        </div>

        <div className="mx-auto mt-6 max-w-3xl text-center">
          <h1 className="text-[26px] font-semibold leading-none tracking-tight text-navy sm:text-[32px]">
            {APP_NAME}
          </h1>
          <p className="mt-2 text-sm font-medium text-[#4b5563]">{APP_SUBTITLE}</p>
        </div>

        <div className="mx-auto mt-6 grid max-w-3xl gap-4 sm:grid-cols-2">
          <section className="rounded-[20px] border border-[#e8e8ea] bg-white p-6 shadow-[0_16px_48px_rgba(15,23,42,0.08)]">
            <h2 className="text-lg font-semibold text-navy">Already at a school</h2>
            <p className="mt-2 text-sm leading-6 text-[#4b5563]">
              Use the private sign-in link your school gave you, or sign in
              here. Ask your school administrator if you need an account.
            </p>
            <Link
              href="/login"
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-[8px] bg-navy px-4 py-2.5 text-[16px] font-semibold text-white hover:bg-navy-deep"
            >
              Sign in
            </Link>
          </section>

          <section className="rounded-[20px] border border-[#e8e8ea] bg-white p-6 shadow-[0_16px_48px_rgba(15,23,42,0.08)]">
            <h2 className="text-lg font-semibold text-navy">Talk to AMPM Flow</h2>
            <p className="mt-2 text-sm leading-6 text-[#4b5563]">
              Send a message to the AMPM Flow administrator. Schools cannot
              add themselves.
            </p>
            <Link
              href="/contact"
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-[8px] border border-navy px-4 py-2.5 text-[16px] font-semibold text-navy hover:bg-navy hover:text-white"
            >
              Contact us
            </Link>
          </section>
        </div>

        <section className="mx-auto mt-4 max-w-3xl rounded-[20px] border border-[#e8e8ea] bg-white p-6 shadow-[0_16px_48px_rgba(15,23,42,0.08)]">
          <h2 className="text-lg font-semibold text-navy">
            AMPM Flow administrator
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#4b5563]">
            Sign in here to add a school and create its first admin. Schools
            cannot add themselves.
          </p>
          <AddSchoolSignIn
            error={
              error === "pending"
                ? "This account is waiting for approval."
                : error === "admin"
                  ? "This sign-in is only for the AMPM Flow administrator."
                  : error === "1" || error === "db"
                    ? "That email or password is not recognized."
                    : undefined
            }
          />
        </section>
      </div>
    </div>
  );
}
