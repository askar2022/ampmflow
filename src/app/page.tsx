import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, homePath } from "@/lib/auth";
import { APP_NAME, APP_SUBTITLE } from "@/lib/school";

export default async function Home() {
  const session = await getSession();
  if (session) redirect(homePath(session.role));

  return (
    <div className="min-h-dvh bg-[#f3f4f6] px-4 py-6 sm:py-8">
      <div className="mx-auto w-full max-w-5xl">
        <div className="overflow-hidden rounded-[24px] border border-[#e8e8ea] bg-white shadow-[0_16px_48px_rgba(15,23,42,0.08)]">
          <img
            src="/landingimage.png"
            alt=""
            className="h-56 w-full object-cover object-center sm:h-72 md:h-96"
          />
        </div>

        <div className="mx-auto mt-6 max-w-3xl text-center">
          <h1 className="text-[32px] font-semibold leading-none tracking-tight text-navy">
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
            <h2 className="text-lg font-semibold text-navy">Interested school</h2>
            <p className="mt-2 text-sm leading-6 text-[#4b5563]">
              Contact us to get started. We review each request and set up the
              school. You get a private sign-in link when it is ready.
            </p>
            <Link
              href="/contact"
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-[8px] border border-navy px-4 py-2.5 text-[16px] font-semibold text-navy hover:bg-navy hover:text-white"
            >
              Contact us
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
