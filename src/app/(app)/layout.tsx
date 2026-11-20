import { redirect } from "next/navigation";
import { getSession, isPlatformAdmin } from "@/lib/auth";
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

  // Skip platform-admin DB lookup for non-admins — login stays snappy.
  const [school, platformAdmin] = await Promise.all([
    getSchoolIdentityById(session.schoolId),
    session.role === "ADMINISTRATOR"
      ? isPlatformAdmin(session)
      : Promise.resolve(false),
  ]);
  const headerName = session.name;

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
