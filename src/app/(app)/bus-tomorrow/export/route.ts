import * as XLSX from "xlsx";
import { getSession } from "@/lib/auth";
import { todayKey } from "@/lib/dates";
import { busTomorrowFamilies, loadGateRoster } from "@/lib/gate";
import { workbookBytes } from "@/lib/excel";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return new Response("Please sign in.", { status: 401 });

  const ids = new Set(
    (new URL(request.url).searchParams.get("families") || "")
      .split(",")
      .filter(Boolean),
  );
  const roster = await loadGateRoster(session.schoolId);
  const families = busTomorrowFamilies(roster).filter((family) =>
    ids.size ? ids.has(family.familyId) : false,
  );
  const rows = families.map((family) => ({
    "Family ID": family.familyKey,
    Parent: family.parentName,
    Phone: family.parentPhone,
    Address: `${family.address}, ${family.city} ${family.zip}`,
    ZIP: family.zip,
    Students: family.students.map((s) => s.fullName).join(", "),
    Grades: family.students.map((s) => s.grade).join(", "),
    Children: family.students.length,
    Notes: family.students[0]?.transportNotes || "",
    "Temporary vehicle": family.students[0]?.tempVehicleName || "",
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      rows.length
        ? rows
        : [{ Note: "Select families before exporting. This file never includes the full school list." }],
    ),
    "Selected families",
  );
  return new Response(Buffer.from(workbookBytes(wb)), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="ampmflow-bus-tomorrow-${todayKey()}.xlsx"`,
    },
  });
}
