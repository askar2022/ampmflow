import { redirect } from "next/navigation";
import { canManageUsers, getSession, isPlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  approveUser,
  createUser,
  rejectUser,
  resetUserPassword,
  toggleUser,
} from "@/app/actions/users";
import { updateSchoolIdentity } from "@/app/actions/school";
import { roleLabel } from "@/lib/format";
import { PENDING_ROLE } from "@/lib/types";
import { AddUserFields } from "./AddUserFields";

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
    <div className="grid gap-6 lg:grid-cols-2">
      <form
        action={updateSchoolIdentity}
        className="rounded-2xl border border-line bg-card p-6 lg:col-span-2"
      >
        <h2 className="text-2xl font-semibold tracking-tight text-navy">
          School identity
        </h2>
        <p className="mt-1 text-sm text-muted">
          This name and logo appear on sign-in and in the header. Do not use a
          logo from another school.
        </p>
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
      {pending.length ? (
        <section className="lg:col-span-2">
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
          <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-card">
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
          The system does not email a password or a verification link. Type a
          temporary password, tell that person, and they sign in on the login
          page. If login fails, set a new password here and try again.
        </p>
        <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-paper text-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th>Role</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {staff.map((user) => (
                <tr key={user.id} className="border-t border-line">
                  <td className="px-4 py-3">
                    <div className="font-medium">{user.name}</div>
                    <div className="text-muted">{user.email}</div>
                  </td>
                  <td>{roleLabel(user.role)}</td>
                  <td>{user.active ? "Active" : "Disabled"}</td>
                  <td className="px-4 py-3">
                    <form action={resetUserPassword} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="id" value={user.id} />
                      <input
                        name="password"
                        type="password"
                        required
                        minLength={4}
                        placeholder="New password"
                        className="w-36 rounded-xl border border-line px-2 py-1.5"
                      />
                      <button className="text-sm font-semibold text-blue">
                        Set password
                      </button>
                    </form>
                    {user.id !== session.id ? (
                      <form
                        action={async () => {
                          "use server";
                          await toggleUser(user.id);
                        }}
                      >
                        <button className="mt-1 text-sm font-semibold text-blue">
                          {user.active ? "Disable" : "Enable"}
                        </button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <form action={createUser} className="rounded-2xl border border-line bg-card p-6">
        <h2 className="font-serif text-2xl">Add user</h2>
        <p className="mt-1 text-sm text-muted">
          For Bus Coordinator, Reception, Admin, or Bus Company, leave class
          blank. Only a Teacher login needs a class. Write down the temporary
          password and give it to that person — AMPM Flow does not send it.
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
