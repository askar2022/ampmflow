import { PrismaClient } from "@prisma/client";
import { dashboardSummary, loadStudents } from "../src/lib/transportation";

const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.findFirst();
  if (!school) throw new Error("No school");
  const students = await loadStudents(school.id);
  const summary = dashboardSummary(students);
  const featured = ["Mohammed Khalid", "Amina Ali", "Ahmed Omar"].map((name) => {
    const student = students.find((row) => row.fullName === name);
    return {
      name,
      am: student ? `${student.am.source} ${student.am.type} ${student.am.busNumber ?? ""}`.trim() : "missing",
      pm: student ? `${student.pm.source} ${student.pm.type} ${student.pm.busNumber ?? ""}`.trim() : "missing",
    };
  });
  console.log({ total: students.length, ...summary, featured });
}

main().finally(() => prisma.$disconnect());
