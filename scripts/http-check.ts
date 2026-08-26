import { SignJWT } from "jose";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET || "riverside-bus-dismissal-tracker-dev-secret-change-in-production",
);

async function tokenFor(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(email);
  return new SignJWT({
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
}

async function check(path: string, cookie: string) {
  const res = await fetch(`http://localhost:3000${path}`, {
    headers: { Cookie: `bdt_session=${cookie}` },
    redirect: "manual",
  });
  const text = await res.text();
  return {
    path,
    status: res.status,
    location: res.headers.get("location"),
    ok:
      res.status === 200 &&
      !text.includes("Application error") &&
      !text.includes("Something went wrong"),
    hasName: text.includes("AMPM Flow") || text.includes("ampmflow"),
  };
}

async function main() {
  const coordinator = await tokenFor("coordinator@riverside.edu");
  const teacher = await tokenFor("evasquez@riverside.edu");
  const company = await tokenFor("dispatch@citytransit.example");

  const coordPaths = [
    "/dashboard",
    "/changes",
    "/students",
    "/buses",
    "/pickup",
    "/teachers",
    "/company",
    "/print",
    "/requests",
    "/audit",
    "/admin/users",
    "/students/import",
  ];
  const results = [];
  for (const path of coordPaths) {
    results.push(await check(path, coordinator));
  }
  results.push(await check("/teacher", teacher));
  results.push(await check("/company", company));
  results.push(await check("/dashboard", teacher));
  console.log(results);
}

main().finally(() => prisma.$disconnect());
