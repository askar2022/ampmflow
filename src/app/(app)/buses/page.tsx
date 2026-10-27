import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ImportForm } from "../students/import/ImportForm";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function RosterPage() {
  const session = await getSession();
  if (!session) return null;

  const canUpload =
    session.role === "ADMINISTRATOR" || session.role === "COORDINATOR";
  const students = await prisma.student.count({
    where: { schoolId: session.schoolId },
  });

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
            Choose the school Excel or CSV file, then load it. Stay on this
            page until you see Finished. Leave overwrite unchecked unless you
            mean to change names already on the list.
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
