import type { CSSProperties } from "react";
import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { AppNav } from "@/components/AppNav";
import { HeaderWelcome } from "@/components/WelcomeBanner";
import { schoolTheme } from "@/lib/school";
import type { SessionUser } from "@/lib/types";

const NAV: { href: string; label: string; roles: SessionUser["role"][] }[] = [
  { href: "/dashboard", label: "Front Desk", roles: ["COORDINATOR", "ADMINISTRATOR", "FRONT_DESK"] },
  { href: "/waiting", label: "Request for Route", roles: ["COORDINATOR", "ADMINISTRATOR", "FRONT_DESK"] },
  { href: "/changes", label: "Today’s Changes", roles: ["COORDINATOR", "ADMINISTRATOR", "FRONT_DESK"] },
  { href: "/buses", label: "Roster", roles: ["COORDINATOR", "ADMINISTRATOR", "FRONT_DESK"] },
  { href: "/print", label: "Reports", roles: ["COORDINATOR", "ADMINISTRATOR", "FRONT_DESK", "TEACHER"] },
  { href: "/company", label: "Bus Company", roles: ["BUS_COMPANY"] },
  { href: "/admin/users", label: "Users", roles: ["ADMINISTRATOR"] },
  { href: "/teacher", label: "My Classroom", roles: ["TEACHER"] },
  { href: "/checkin", label: "Bus Check-In", roles: ["BUS_ASSISTANT"] },
];

export function AppShell({
  user,
  schoolName,
  children,
}: {
  user: SessionUser;
  schoolName?: string | null;
  schoolLogoUrl?: string | null;
  children: React.ReactNode;
}) {
  const links = NAV.filter((item) => item.roles.includes(user.role));
  const theme = schoolTheme(schoolName);
  const home =
    user.role === "TEACHER"
      ? "/teacher"
      : user.role === "BUS_ASSISTANT"
        ? "/checkin"
        : "/dashboard";

  return (
    <div
      className="min-h-full"
      style={
        {
          "--navy": theme.navy,
          "--navy-deep": theme.navyDeep,
        } as CSSProperties
      }
    >
      <header className="no-print">
        <div className="mx-auto max-w-4xl px-4 pt-3 sm:px-6">
          <Link href={home} className="block">
            <HeaderWelcome schoolName={schoolName} />
          </Link>
        </div>
        <nav className="mx-auto mt-3 flex max-w-4xl flex-col gap-2 px-4 sm:flex-row sm:items-center sm:px-6">
          <div className="nav-scroll min-w-0">
            <div className="inline-flex min-w-max items-center gap-1 rounded-full bg-navy-deep px-2 py-1 text-white">
              <AppNav links={links} />
            </div>
          </div>
          <form action={logoutAction} className="self-end sm:ml-auto sm:self-auto">
            <button className="rounded-full px-3 py-1.5 text-sm text-navy/70 hover:bg-line hover:text-navy">
              Sign out
            </button>
          </form>
        </nav>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-4 sm:px-6">{children}</main>
    </div>
  );
}
