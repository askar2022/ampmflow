import Link from "next/link";
import { getSession } from "@/lib/auth";
import { loadStudents } from "@/lib/transportation";
import { groupByBus } from "@/lib/reports";
import { planSummary } from "@/lib/format";

export default async function BusesPage() {
  const session = await getSession();
  if (!session) return null;
  const groups = groupByBus(await loadStudents(session.schoolId), "PM");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-4xl">Buses</h1>
        <p className="mt-1 text-muted">PM dismissal riders by bus number for today.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {groups.map(([number, students]) => (
          <section key={number} className="rounded-2xl border border-line bg-card p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="font-serif text-2xl">Bus {number}</h2>
              <span className="text-sm text-muted">{students.length} students</span>
            </div>
            <ul className="mt-3 space-y-1 text-sm">
              {students.map((student) => (
                <li key={student.id} className="flex justify-between gap-3 border-t border-line py-1.5">
                  <Link href={`/students/${student.id}`} className="hover:underline">
                    {student.fullName}
                  </Link>
                  <span className="text-muted">{planSummary(student.pm, "PM")}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
