import * as XLSX from "xlsx";
import { getSession } from "@/lib/auth";
import { todayKey } from "@/lib/dates";
import {
  AM_LABEL,
  PM_LABEL,
  activeDismissalStudents,
  loadGateRoster,
} from "@/lib/gate";
import { workbookBytes } from "@/lib/excel";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return new Response("Please sign in.", { status: 401 });

  const grade = new URL(request.url).searchParams.get("grade") || "";
  const roster = await loadGateRoster(session.schoolId);
  const rows = activeDismissalStudents(roster.filter((s) => s.grade === grade)).map(
    (student) => ({
      Student: student.fullName,
      Grade: student.grade,
      "Teacher/Class": student.teacherName,
      "AM Arrival Status": AM_LABEL[student.amArrival],
      "PM Dismissal Today": PM_LABEL[student.pmDismissal],
      "Last updated": student.updatedAt || "",
      "Family ID": student.familyKey,
    }),
  );

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: `No arrived students in ${grade}.` }]),
    grade.slice(0, 31) || "Grade",
  );
  return new Response(Buffer.from(workbookBytes(wb)), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="ampmflow-${grade.replace(/\s+/g, "-")}-${todayKey()}.xlsx"`,
    },
  });
}
