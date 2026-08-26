import { SignJWT } from "jose";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET || "riverside-bus-dismissal-tracker-dev-secret-change-in-production",
);

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "coordinator@riverside.edu" },
  });
  const student = await prisma.student.findFirst({
    where: { firstName: "Mohammed", lastName: "Khalid" },
  });
  if (!user || !student) throw new Error("missing demo data");
  const token = await new SignJWT({
    id: user.id,
    schoolId: user.schoolId,
    email: user.email,
    name: user.name,
    role: user.role,
    teacherId: user.teacherId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(secret);

  const pages = [
    "/dashboard",
    `/students/${student.id}`,
    `/students/${student.id}/update`,
    "/teacher",
  ];
  for (const path of pages) {
    const res = await fetch(`http://localhost:3000${path}`, {
      headers: { Cookie: `bdt_session=${token}` },
    });
    const html = await res.text();
    const checks = [
      "Mohammed Khalid",
      "120",
      "Parent pickup",
      "Bus 3",
      "Today only",
      "Update Transportation",
    ].filter((needle) => html.includes(needle));
    console.log(path, res.status, checks.join(" | "));
  }
}

main().finally(() => prisma.$disconnect());
