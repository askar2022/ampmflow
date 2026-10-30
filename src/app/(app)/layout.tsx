import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
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
  const school = await getSchoolIdentityById(session.schoolId);

  return (
    <AppShell
      user={session}
      schoolName={school?.name ?? null}
      schoolLogoUrl={school?.logoUrl ?? null}
    >
      {children}
    </AppShell>
  );
}
