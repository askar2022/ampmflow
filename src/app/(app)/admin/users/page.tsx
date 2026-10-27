import { redirect } from "next/navigation";
import { canManageUsers, getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { approveUser, createUser, rejectUser } from "@/app/actions/users";
import { roleLabel } from "@/lib/format";
import { PENDING_ROLE } from "@/lib/types";
import { AddUserFields } from "./AddUserFields";
import { UserArchive } from "./UserArchive";
import { UserPasswordField } from "./UserPasswordField";
import { UserRemoveButton } from "./UserRemoveButton";

export default async function UsersPage() {
  const session = await getSession();
  if (!session || !canManageUsers(session.role)) redirect("/dashboard");
  const users = await prisma.user.findMany({
    where: { schoolId: session.schoolId },
    include: { teacher: true },
    orderBy: { name: "asc" },
  });
  const teachers = await prisma.teacher.findMany({
    where: { schoolId: session.schoolId },
    include: { classroom: true },
    orderBy: { name: "asc" },
  });
  const pending = users.filter((user) => user.role === PENDING_ROLE);
  const schoolUsers = users.filter((user) => user.role !== PENDING_ROLE);
  const staff = schoolUsers.filter((user) => user.active);
  const takenOff = schoolUsers.filter((user) => !user.active);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="font-serif text-4xl">Users</h1>
        <p className="mt-1 text-muted">
          Add local admins and staff for this school only. Move to archive
          turns off their login. They are not deleted.
        </p>
      </section>
      {pending.length ? (
        <section>
          <h2 className="text-2xl font-semibold tracking-tight text-navy">
            Waiting for approval
          </h2>
          <p className="mt-1 text-sm text-muted">
            These people requested an account. They cannot sign in until you
            approve them and choose a role.
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
                    <div className="text-sm text-muted">{user.email}</div>
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
                          defaultValue="TEACHER"
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
        <ul className="space-y-4">
          {staff.map((user) => (
            <li
              key={user.id}
              className="rounded-2xl border border-line bg-card p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xl font-semibold text-navy">{user.name}</div>
                  <div className="mt-1 text-base text-navy">{user.email}</div>
                  <div className="mt-1 text-sm text-muted">
                    {roleLabel(user.role)} · Active
                    {user.id === session.id ? " · You" : ""}
                  </div>
                </div>
                {user.id !== session.id ? (
                  <UserRemoveButton id={user.id} active={user.active} />
                ) : null}
              </div>
              <div className="mt-4 border-t border-line pt-4">
                <UserPasswordField id={user.id} />
              </div>
            </li>
          ))}
        </ul>
      </section>
      <UserArchive
        users={takenOff.map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          active: user.active,
        }))}
      />
      <form action={createUser} className="rounded-2xl border border-line bg-card p-6">
        <h2 className="font-serif text-2xl">Add staff</h2>
        <p className="mt-1 text-sm text-muted">
          Create a local admin or staff account for this school only. They
          cannot open a new school. Write down the temporary password and give
          it to that person — AMPM Flow does not send it. Only a Teacher login
          needs a class.
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
