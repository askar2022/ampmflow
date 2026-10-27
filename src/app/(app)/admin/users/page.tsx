import { redirect } from "next/navigation";
import { canManageUsers, getSession, isPlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  approveUser,
  createSchoolForDemo,
  createUser,
  rejectUser,
  resetUserPassword,
} from "@/app/actions/users";
import { updateSchoolIdentity } from "@/app/actions/school";
import { roleLabel } from "@/lib/format";
import { loadPendingInquiries } from "@/lib/inquiries";
import { ensureSchoolSlugs, schoolLoginUrl, schoolSlugForId } from "@/lib/school-slug";
import { PENDING_ROLE } from "@/lib/types";
import { AddUserFields } from "./AddUserFields";
import { UserRemoveButton } from "./UserRemoveButton";

export default async function UsersPage() {
  const session = await getSession();
  if (!session || !canManageUsers(session.role)) redirect("/dashboard");
  const platform = await isPlatformAdmin(session);
  const users = await prisma.user.findMany({
    where: platform ? undefined : { schoolId: session.schoolId },
    include: { teacher: true, school: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  const teachers = await prisma.teacher.findMany({
    where: { schoolId: session.schoolId },
    include: { classroom: true },
    orderBy: { name: "asc" },
  });
  const pending = users.filter((user) => user.role === PENDING_ROLE);
  const staff = users.filter(
    (user) => user.role !== PENDING_ROLE && user.schoolId === session.schoolId,
  );
  await ensureSchoolSlugs().catch(() => undefined);
  const inquiries = platform ? await loadPendingInquiries() : [];
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

  return (
    <div className="space-y-6">
      <form
        action={updateSchoolIdentity}
        className="rounded-2xl border border-line bg-card p-6"
      >
        <h2 className="text-2xl font-semibold tracking-tight text-navy">
          School identity
        </h2>
        <p className="mt-1 text-sm text-muted">
          This name and logo appear on your private sign-in page and in the
          header. Do not use a logo from another school.
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
          Save school identity
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
                These schools contacted us. They are not active until you set
                them up below. This list is only for you.
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
              Set up a school
            </h2>
            <p className="mt-1 text-sm text-muted">
              Review first, then create the school, branding, and a private
              sign-in link. This emails the admin that link. A public request
              does not turn a school on.
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
              Set up school and email the private link
            </button>
          </form>
        </div>
      ) : null}
      {pending.length ? (
        <section>
          <h2 className="text-2xl font-semibold tracking-tight text-navy">
            Waiting for approval
          </h2>
          <p className="mt-1 text-sm text-muted">
            These people requested an account. They cannot sign in until you
            approve them and choose a role.
            {platform
              ? " New schools stay locked until you approve the first admin."
              : ""}
          </p>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-card">
            <ul className="divide-y divide-line">
              {pending.map((user) => (
                <li
                  key={user.id}
                  className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-end sm:justify-between"
                >
                  <div>
                    <div className="font-medium">{user.name}</div>
                    <div className="text-sm text-muted">
                      {user.email}
                      {platform ? ` · ${user.school.name}` : ""}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <form action={approveUser} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="id" value={user.id} />
                      <label className="text-sm">
                        <span className="sr-only">Role for {user.name}</span>
                        <select
                          name="role"
                          required
                          className="rounded-xl border border-line px-3 py-2"
                          defaultValue={
                            platform && user.schoolId !== session.schoolId
                              ? "ADMINISTRATOR"
                              : "TEACHER"
                          }
                        >
                          <option value="TEACHER">Teacher</option>
                          <option value="FRONT_DESK">Reception</option>
                          <option value="COORDINATOR">Bus Coordinator</option>
                          <option value="ADMINISTRATOR">Admin</option>
                          <option value="BUS_COMPANY">Bus Company</option>
                          <option value="BUS_ASSISTANT">Bus Assistant</option>
                        </select>
                      </label>
                      <button className="rounded-xl bg-navy px-4 py-2 font-semibold text-white">
                        Approve
                      </button>
                    </form>
                    <form action={rejectUser}>
                      <input type="hidden" name="id" value={user.id} />
                      <button className="rounded-xl px-4 py-2 text-sm font-semibold text-red">
                        Reject
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
      <section>
        <h1 className="font-serif text-4xl">Users</h1>
        <p className="mt-1 text-muted">
          Add staff for this school only. Type a temporary password, tell that
          person, and they sign in at the regular login page. AMPM Flow does
          not email a password. If login fails, set a new password here.
        </p>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-paper text-muted">
                <tr>
                <th className="px-4 py-3">Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th className="px-4">Remove</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((user) => (
                <tr key={user.id} className="border-t border-line">
                  <td className="px-4 py-3">
                    <div className="font-medium">{user.name}</div>
                  </td>
                  <td className="text-muted">{user.email}</td>
                  <td>{roleLabel(user.role)}</td>
                  <td>{user.active ? "Active" : "Removed"}</td>
                  <td className="px-4 py-3">
                    {user.id !== session.id ? (
                      <UserRemoveButton id={user.id} active={user.active} />
                    ) : (
                      <span className="text-xs text-muted">You</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <form action={createUser} className="rounded-2xl border border-line bg-card p-6">
        <h2 className="font-serif text-2xl">Add staff for this school</h2>
        <p className="mt-1 text-sm text-muted">
          This is how Front Desk, teachers, and other staff get an account for
          this school only. They sign in at the regular login page. They cannot
          open a new school. Write down the temporary password and give it to
          that person — AMPM Flow does not send it. For Bus Coordinator,
          Reception, Admin, or Bus Company, leave class blank. Only a Teacher
          login needs a class.
        </p>
        <div className="mt-4 space-y-3">
          <input name="name" required placeholder="Name" className="w-full rounded-xl border border-line px-3 py-2" />
          <input name="email" type="email" required placeholder="Email" className="w-full rounded-xl border border-line px-3 py-2" />
          <AddUserFields
            teachers={teachers.map((teacher) => ({
              id: teacher.id,
              name: teacher.name,
              classroom: teacher.classroom?.name ?? "",
            }))}
          />
          <input name="password" type="password" required placeholder="Temporary password" className="w-full rounded-xl border border-line px-3 py-2" />
          <button className="rounded-xl bg-navy px-4 py-2 font-semibold text-white">
            Create account
          </button>
        </div>
      </form>
    </div>
  );
}
