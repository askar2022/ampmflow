import type { CSSProperties } from "react";
import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { AppNav } from "@/components/AppNav";
import { HeaderWelcome } from "@/components/WelcomeBanner";
import { schoolTheme } from "@/lib/school";
import type { SessionUser } from "@/lib/types";

const NAV: { href: string; label: string; roles: SessionUser["role"][] }[] = [
  { href: "/dashboard", label: "Desk", roles: ["COORDINATOR", "ADMINISTRATOR", "FRONT_DESK"] },
  { href: "/changes", label: "Today’s Changes", roles: ["COORDINATOR", "ADMINISTRATOR", "FRONT_DESK"] },
  { href: "/buses", label: "Buses", roles: ["COORDINATOR", "ADMINISTRATOR", "FRONT_DESK"] },
  { href: "/waiting", label: "Waiting for Route", roles: ["COORDINATOR", "ADMINISTRATOR", "FRONT_DESK"] },
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
      <header className="no-print bg-navy text-white">
        <Link href={home} className="block">
          <HeaderWelcome schoolName={schoolName} />
        </Link>
        <nav className="bg-navy-deep">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-1 px-3 py-2 sm:px-4">
            <AppNav links={links} />
            <form action={logoutAction} className="ml-auto">
              <button className="rounded-full px-3 py-1.5 text-sm text-white/70 hover:bg-white/10 hover:text-white">
                Sign out
              </button>
            </form>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-4 sm:px-6">{children}</main>
    </div>
  );
}
