import { redirect } from "next/navigation";
import { canManageUsers, getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createUser, toggleUser } from "@/app/actions/users";
import { updateSchoolIdentity } from "@/app/actions/school";
import { roleLabel } from "@/lib/format";

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
    orderBy: { name: "asc" },
  });
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
      <section>
        <h1 className="font-serif text-4xl">Users</h1>
        <p className="mt-1 text-muted">
          Administrators can view everything and manage accounts. Parent access is
          not included in this first version.
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
              {users.map((user) => (
                <tr key={user.id} className="border-t border-line">
                  <td className="px-4 py-3">
                    <div className="font-medium">{user.name}</div>
                    <div className="text-muted">{user.email}</div>
                  </td>
                  <td>{roleLabel(user.role)}</td>
                  <td>{user.active ? "Active" : "Disabled"}</td>
                  <td>
                    {user.id !== session.id ? (
                      <form
                        action={async () => {
                          "use server";
                          await toggleUser(user.id);
                        }}
                      >
                        <button className="text-sm font-semibold text-blue">
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
        <div className="mt-4 space-y-3">
          <input name="name" required placeholder="Name" className="w-full rounded-xl border border-line px-3 py-2" />
          <input name="email" type="email" required placeholder="Email" className="w-full rounded-xl border border-line px-3 py-2" />
          <select name="role" className="w-full rounded-xl border border-line px-3 py-2">
            <option value="TEACHER">Teacher</option>
            <option value="FRONT_DESK">Front Desk</option>
            <option value="COORDINATOR">Transportation Coordinator</option>
            <option value="ADMINISTRATOR">School Administrator</option>
            <option value="BUS_COMPANY">Bus Company</option>
            <option value="BUS_ASSISTANT">Bus Assistant</option>
          </select>
          <select name="teacherId" className="w-full rounded-xl border border-line px-3 py-2">
            <option value="">Classroom (teachers only)</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.name}
              </option>
            ))}
          </select>
          <input
            name="assignedBus"
            placeholder="Bus number (bus assistants only)"
            className="w-full rounded-xl border border-line px-3 py-2"
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
