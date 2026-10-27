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
