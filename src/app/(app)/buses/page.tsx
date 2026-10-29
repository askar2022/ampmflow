import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSchoolIdentityById } from "@/lib/school";
import { ensureStudentContactColumns } from "@/lib/transportation";
import { ImportForm } from "../students/import/ImportForm";
import { ClearRoster } from "./ClearRoster";
import { StudentArchive } from "./StudentArchive";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function RosterPage() {
  const session = await getSession();
  if (!session) return null;

  const canUpload =
    session.role === "ADMINISTRATOR" || session.role === "COORDINATOR";
  await ensureStudentContactColumns().catch(() => undefined);
  const [students, archived, school] = await Promise.all([
    prisma.student.count({
      where: { schoolId: session.schoolId, active: true },
    }),
    prisma.student.findMany({
      where: { schoolId: session.schoolId, active: false },
      select: { id: true, firstName: true, lastName: true, grade: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    getSchoolIdentityById(session.schoolId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-4xl">Roster</h1>
        <p className="mt-1 max-w-2xl text-muted">
          Upload the school student list here. After a student is assigned a
          bus or van, print that list for the driver on Reports.
        </p>
        <p className="mt-2 text-sm font-semibold text-navy">
          {students} student{students === 1 ? "" : "s"} on the roster
        </p>
      </div>

      {canUpload ? (
        <div>
          <h2 className="font-serif text-2xl">Upload students</h2>
          <p className="mt-1 text-sm text-muted">
            Load the school Excel again if students are already on the list.
            Teacher, bus, and van from the file are written onto those
            students and then show on Front Desk and Reports. Stay on this
            page until you see Finished.
          </p>
          <div className="mt-4">
            <ImportForm />
          </div>
          <a
            href="/sample-import.csv"
            className="mt-3 inline-block text-sm font-semibold text-navy"
          >
            Download sample CSV
          </a>
          <div className="mt-6 space-y-4">
            <ClearRoster
              schoolName={school?.name || "this school"}
              count={students}
            />
            <StudentArchive students={archived} />
          </div>
        </div>
      ) : (
        <p className="rounded-2xl border border-line bg-card px-4 py-6 text-sm text-muted">
          Ask your administrator to upload the student file. Front Desk then
          searches those students. Print each bus or van list on{" "}
          <Link href="/print" className="font-semibold text-navy underline">
            Reports
          </Link>
          .
        </p>
      )}
    </div>
  );
}
