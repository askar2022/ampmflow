import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadStudent } from "@/lib/transportation";
import { UpdateForm } from "./UpdateForm";

export default async function UpdatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  if (
    session.role !== "COORDINATOR" &&
    session.role !== "ADMINISTRATOR" &&
    session.role !== "FRONT_DESK"
  ) {
    redirect("/students");
  }
  const { id } = await params;
  const loaded = await loadStudent(id);
  if (!loaded) notFound();

  const routes = await prisma.busRoute.findMany({
    where: { schoolId: session.schoolId },
    orderBy: [{ number: "asc" }, { trip: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/students" className="text-sm font-medium text-navy underline">
          ← Back to students
        </Link>
        <h1 className="mt-2 font-serif text-4xl">
          Update Transportation
        </h1>
        <p className="text-muted">
          {loaded.effective.fullName} · {loaded.effective.studentId} · Grade{" "}
          {loaded.effective.grade}
        </p>
      </div>
      <UpdateForm
        studentId={id}
        studentName={loaded.effective.fullName}
        daycareName={loaded.effective.daycareName}
        am={loaded.effective.am}
        pm={loaded.effective.pm}
        routes={routes.map((r) => ({ id: r.id, number: r.number, trip: r.trip }))}
        allowPermanent={
          session.role === "COORDINATOR" || session.role === "ADMINISTRATOR"
        }
      />
    </div>
  );
}
