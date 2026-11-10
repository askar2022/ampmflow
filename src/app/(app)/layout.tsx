import { redirect } from "next/navigation";
import { getSession, isPlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSchoolIdentityById } from "@/lib/school";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const [school, platformAdmin, companyName] = await Promise.all([
    getSchoolIdentityById(session.schoolId),
    isPlatformAdmin(session),
    session.role === "BUS_COMPANY"
      ? prisma.user
          .findUnique({
            where: { id: session.id },
            select: { name: true },
          })
          .then((row) => row?.name || session.name)
          .catch(() => session.name)
      : Promise.resolve(session.name),
  ]);
  const headerName = companyName;

  // Sankofa is no longer the platform hub — hide Add schools on that desk.
  const sankofaDesk = /sankofa/i.test(school?.name || "");
  const showPlatform = !sankofaDesk && platformAdmin;

  return (
    <AppShell
      user={session}
      schoolName={school?.name ?? null}
      schoolLogoUrl={school?.logoUrl ?? null}
      headerName={headerName}
      showPlatform={showPlatform}
    >
      {children}
    </AppShell>
  );
}
