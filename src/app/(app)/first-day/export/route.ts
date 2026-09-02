import * as XLSX from "xlsx";
import { getSession } from "@/lib/auth";
import { todayKey } from "@/lib/dates";
import { gateCounts, loadGateRoster } from "@/lib/gate";
import { workbookBytes } from "@/lib/excel";

export async function GET() {
  const session = await getSession();
  if (!session) return new Response("Please sign in.", { status: 401 });

  const roster = await loadGateRoster(session.schoolId);
  const counts = gateCounts(roster);
  const rows = [
    { Measure: "Total students", Students: counts.totalStudents, Families: counts.totalFamilies },
    { Measure: "Returning", Students: counts.returning, Families: "" },
    { Measure: "New Application", Students: counts.newApplication, Families: "" },
    { Measure: "Checked in", Students: counts.checkedIn, Families: "" },
    { Measure: "Not checked in", Students: counts.notCheckedIn, Families: "" },
    { Measure: "Confirmed absences", Students: counts.confirmedAbsences, Families: "" },
    { Measure: "Arriving late", Students: counts.arrivingLate, Families: "" },
    { Measure: "Absent—no bus", Students: counts.absentNoBus, Families: "" },
    { Measure: "Absent—sick", Students: counts.absentSick, Families: "" },
    { Measure: "Transferred", Students: counts.transferred, Families: "" },
    { Measure: "Unable to reach", Students: counts.unableToReach, Families: "" },
    { Measure: "Parent Drop-Off", Students: counts.parentDropOff, Families: "" },
    { Measure: "Bus Drop-Off", Students: counts.busDropOff, Families: "" },
    {
      Measure: "Parent Pickup—Confirmed",
      Students: counts.parentPickupConfirmed.students,
      Families: counts.parentPickupConfirmed.families,
    },
    {
      Measure: "Bus Needed Tomorrow",
      Students: counts.pickupTodayBusTomorrow.students,
      Families: counts.pickupTodayBusTomorrow.families,
    },
    {
      Measure: "Confirmed Bus",
      Students: counts.confirmedBus.students,
      Families: counts.confirmedBus.families,
    },
    {
      Measure: "Not Confirmed",
      Students: counts.notConfirmed.students,
      Families: counts.notConfirmed.families,
    },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Dashboard");
  return new Response(Buffer.from(workbookBytes(wb)), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="ampmflow-first-day-${todayKey()}.xlsx"`,
    },
  });
}
