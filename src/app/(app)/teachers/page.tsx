import Link from "next/link";
import { getSession } from "@/lib/auth";
import { loadStudents } from "@/lib/transportation";
import { groupByTeacher } from "@/lib/reports";

export default async function TeachersPage() {
  const session = await getSession();
  if (!session) return null;
  const groups = groupByTeacher(await loadStudents(session.schoolId));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-4xl">Teachers and classes</h1>
        <p className="mt-1 text-muted">
          Each teacher and classroom from your student upload. Open a card to
          print that class list.
        </p>
        <a
          href="/print/export?kind=teacher"
          className="mt-3 inline-block rounded-xl border border-line bg-card px-4 py-2 text-sm font-semibold"
        >
          Download Excel
        </a>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {groups.map(([name, students]) => (
          <Link
            key={name}
            href={`/print?kind=teacher&group=${encodeURIComponent(name)}`}
            className="rounded-2xl border border-line bg-card p-5 hover:border-gold"
          >
            <h2 className="font-serif text-2xl">{name}</h2>
            <p className="mt-1 text-sm text-muted">{students.length} students</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
