import { redirect } from "next/navigation";
import { canManageUsers, getSession, isPlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSchoolForDemo } from "@/app/actions/users";
import { updateSchoolIdentity } from "@/app/actions/school";
import { loadPendingInquiries } from "@/lib/inquiries";
import { ensureSchoolSlugs, schoolLoginUrl, schoolSlugForId } from "@/lib/school-slug";

export default async function SchoolsPage() {
  const session = await getSession();
  if (!session || !canManageUsers(session.role)) redirect("/dashboard");
  const platform = await isPlatformAdmin(session);
  await ensureSchoolSlugs().catch(() => undefined);
  const schoolSlug = await schoolSlugForId(session.schoolId);
  const school = await prisma.school
    .findUnique({
      where: { id: session.schoolId },
      select: { name: true, logoUrl: true },
    })
    .catch(async () =>
      prisma.school.findUnique({
        where: { id: session.schoolId },
        select: { name: true },
      }),
    );
  const inquiries = platform ? await loadPendingInquiries() : [];
  const schools = platform
    ? await prisma.school.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, slug: true },
      }).catch(async () => {
        const rows = await prisma.school.findMany({
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        });
        return rows.map((row) => ({ ...row, slug: null as string | null }));
      })
    : [];

  return (
    <div className="space-y-6">
      <section>
        <h1 className="font-serif text-4xl">Schools</h1>
        <p className="mt-1 text-muted">
          {platform
            ? "Add a school and create its first admin here. That admin then adds local staff on Users."
            : "This is your school landing. Name, logo, and the private sign-in link live here."}
        </p>
      </section>
      <form
        action={updateSchoolIdentity}
        className="rounded-2xl border border-line bg-card p-6"
      >
        <h2 className="text-2xl font-semibold tracking-tight text-navy">
          Your school landing
        </h2>
        <p className="mt-1 text-sm text-muted">
          This name and logo appear on your private sign-in page and in the
          header.
        </p>
        {schoolSlug ? (
          <p className="mt-2 text-sm font-semibold text-navy">
            Private sign-in: {schoolLoginUrl(schoolSlug)}
          </p>
        ) : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            name="schoolName"
            required
            defaultValue={school?.name ?? ""}
            placeholder="School name"
            className="w-full rounded-xl border border-line px-3 py-2"
          />
          <input
            name="logoUrl"
            defaultValue={
              school && "logoUrl" in school ? String(school.logoUrl ?? "") : ""
            }
            placeholder="Logo URL (optional)"
            className="w-full rounded-xl border border-line px-3 py-2"
          />
        </div>
        <button className="mt-3 rounded-xl bg-teal px-4 py-2 font-semibold text-white hover:bg-teal-deep">
          Save school landing
        </button>
      </form>
      {platform ? (
        <div className="space-y-6">
          {inquiries.length ? (
            <section className="rounded-2xl border border-line bg-card p-6">
              <h2 className="text-2xl font-semibold tracking-tight text-navy">
                School requests
              </h2>
              <p className="mt-1 text-sm text-muted">
                These schools contacted AMPM Flow. They are not active until
                you set them up below.
              </p>
              <ul className="mt-4 divide-y divide-line">
                {inquiries.map((row) => (
                  <li key={row.id} className="py-3 text-sm">
                    <div className="font-medium">{row.schoolName}</div>
                    <div className="text-muted">
                      {row.name} · {row.email}
                    </div>
                    {row.note ? <div className="mt-1 text-muted">{row.note}</div> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <form
            action={createSchoolForDemo}
            className="rounded-2xl border border-line bg-card p-6"
          >
            <h2 className="text-2xl font-semibold tracking-tight text-navy">
              Add a school
            </h2>
            <p className="mt-1 text-sm text-muted">
              Create the school, its first admin, and a private sign-in landing.
              That admin then adds local admins and staff.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
            </div>
            <button className="mt-3 rounded-xl bg-navy px-4 py-2 font-semibold text-white">
              Create school and first admin
            </button>
          </form>
          {schools.length ? (
            <section className="rounded-2xl border border-line bg-card p-6">
              <h2 className="text-2xl font-semibold tracking-tight text-navy">
                Schools on AMPM Flow
              </h2>
              <ul className="mt-4 divide-y divide-line">
                {schools.map((row) => (
                  <li key={row.id} className="py-3">
                    <div className="font-medium text-navy">{row.name}</div>
                    {row.slug ? (
                      <div className="mt-1 text-sm text-muted">
                        {schoolLoginUrl(row.slug)}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
