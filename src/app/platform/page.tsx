import { redirect } from "next/navigation";
import { getSession, isPlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logoutAction } from "@/app/actions/auth";
import { createSchoolForDemo } from "@/app/actions/users";
import { loadPendingInquiries } from "@/lib/inquiries";
import { APP_NAME, APP_SUBTITLE } from "@/lib/school";
import { ensureSchoolSlugs, schoolLoginUrl } from "@/lib/school-slug";

export default async function PlatformSchoolsPage() {
  const session = await getSession();
  if (!session) redirect("/");
  if (!(await isPlatformAdmin(session))) redirect("/");

  await ensureSchoolSlugs().catch(() => undefined);
  const inquiries = await loadPendingInquiries();
  const schools = await prisma.school
    .findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    })
    .catch(async () => {
      const rows = await prisma.school.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      });
      return rows.map((row) => ({ ...row, slug: null as string | null }));
    });

  return (
    <div className="min-h-dvh bg-[#f3f4f6] px-3 py-4 sm:px-4 sm:py-8">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[26px] font-semibold tracking-tight text-navy sm:text-[32px]">
              {APP_NAME}
            </h1>
            <p className="mt-1 text-sm text-[#4b5563]">{APP_SUBTITLE}</p>
          </div>
          <form action={logoutAction}>
            <input type="hidden" name="next" value="landing" />
            <button className="rounded-full px-3 py-1.5 text-sm text-navy/70 hover:bg-white hover:text-navy">
              Sign out
            </button>
          </form>
        </div>

        <section className="rounded-[20px] border border-[#e8e8ea] bg-white p-6 shadow-[0_16px_48px_rgba(15,23,42,0.08)]">
          <h2 className="text-lg font-semibold text-navy">Add a school</h2>
          <p className="mt-2 text-sm leading-6 text-[#4b5563]">
            This page is only for the AMPM Flow administrator. It is not a
            school desk. Create the school and its first admin. That admin
            then adds local staff on Users.
          </p>
          <form action={createSchoolForDemo} className="mt-5 grid gap-3 sm:grid-cols-2">
            <input
              name="schoolName"
              required
              placeholder="School name"
              className="w-full rounded-xl border border-line px-3 py-2"
            />
            <input
              name="slug"
              placeholder="Private link name (aim-academy)"
              className="w-full rounded-xl border border-line px-3 py-2"
            />
            <input
              name="name"
              required
              placeholder="Admin name"
              className="w-full rounded-xl border border-line px-3 py-2"
            />
            <input
              name="email"
              type="email"
              required
              placeholder="Admin email"
              className="w-full rounded-xl border border-line px-3 py-2"
            />
            <input
              name="password"
              type="password"
              required
              minLength={8}
              placeholder="Temporary password (8+ characters)"
              className="w-full rounded-xl border border-line px-3 py-2 sm:col-span-2"
            />
            <button className="rounded-xl bg-navy px-4 py-2.5 font-semibold text-white sm:col-span-2">
              Create school and first admin
            </button>
          </form>
        </section>

        {inquiries.length ? (
          <section className="rounded-[20px] border border-[#e8e8ea] bg-white p-6 shadow-[0_16px_48px_rgba(15,23,42,0.08)]">
            <h2 className="text-lg font-semibold text-navy">School requests</h2>
            <p className="mt-2 text-sm text-[#4b5563]">
              These schools contacted AMPM Flow. They are not active until you
              set them up.
            </p>
            <ul className="mt-4 divide-y divide-line">
              {inquiries.map((row) => (
                <li key={row.id} className="py-3 text-sm">
                  <div className="font-medium">{row.schoolName}</div>
                  <div className="text-[#4b5563]">
                    {row.name} · {row.email}
                  </div>
                  {row.note ? <div className="mt-1 text-[#4b5563]">{row.note}</div> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="rounded-[20px] border border-[#e8e8ea] bg-white p-6 shadow-[0_16px_48px_rgba(15,23,42,0.08)]">
          <h2 className="text-lg font-semibold text-navy">Schools on AMPM Flow</h2>
          <ul className="mt-4 divide-y divide-line">
            {schools.map((row) => (
              <li key={row.id} className="py-3">
                <div className="font-medium text-navy">{row.name}</div>
                {row.slug ? (
                  <div className="mt-1 text-sm text-[#4b5563]">
                    {schoolLoginUrl(row.slug)}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
