import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const school = await prisma.school
    .findUnique({
      where: { id: session.schoolId },
      select: { name: true },
    })
    .catch(() => null);
  return (
    <AppShell user={session} schoolName={school?.name || "School"}>
      {children}
    </AppShell>
  );
}
