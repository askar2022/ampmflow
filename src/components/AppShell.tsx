import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { roleLabel } from "@/lib/format";
import { formatLongDate, formatTime, schoolNow } from "@/lib/dates";
import { BrandMark } from "@/components/BrandMark";
import { AppNav } from "@/components/AppNav";
import type { SessionUser } from "@/lib/types";

const NAV: { href: string; label: string; roles: SessionUser["role"][] }[] = [
  { href: "/dashboard", label: "Desk", roles: ["COORDINATOR", "ADMINISTRATOR", "FRONT_DESK"] },
  { href: "/changes", label: "Today’s Changes", roles: ["COORDINATOR", "ADMINISTRATOR", "FRONT_DESK"] },
  { href: "/buses", label: "Buses", roles: ["COORDINATOR", "ADMINISTRATOR", "FRONT_DESK"] },
  { href: "/waiting", label: "Waiting for Route", roles: ["COORDINATOR", "ADMINISTRATOR", "FRONT_DESK"] },
  { href: "/print", label: "Reports", roles: ["COORDINATOR", "ADMINISTRATOR", "FRONT_DESK", "TEACHER"] },
  { href: "/plans", label: "Regular Plans", roles: ["COORDINATOR", "ADMINISTRATOR"] },
  { href: "/students", label: "Students", roles: ["COORDINATOR", "ADMINISTRATOR", "FRONT_DESK"] },
  { href: "/teachers", label: "Teachers", roles: ["COORDINATOR", "ADMINISTRATOR"] },
  { href: "/company", label: "Bus Company", roles: ["COORDINATOR", "ADMINISTRATOR", "BUS_COMPANY"] },
  { href: "/admin/users", label: "Users", roles: ["ADMINISTRATOR"] },
  { href: "/teacher", label: "My Classroom", roles: ["TEACHER"] },
  { href: "/checkin", label: "Bus Check-In", roles: ["BUS_ASSISTANT"] },
];

export function AppShell({
  user,
  schoolName,
  schoolLogoUrl,
  children,
}: {
  user: SessionUser;
  schoolName?: string | null;
  schoolLogoUrl?: string | null;
  children: React.ReactNode;
}) {
  const now = schoolNow();
  const links = NAV.filter((item) => item.roles.includes(user.role));

  return (
    <div className="min-h-full">
      <header className="no-print bg-navy text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link
            href={
              user.role === "TEACHER"
                ? "/teacher"
                : user.role === "BUS_ASSISTANT"
                  ? "/checkin"
                  : "/dashboard"
            }
          >
            <BrandMark
              light
              compact
              schoolName={schoolName}
              schoolLogoUrl={schoolLogoUrl}
            />
          </Link>
          <div className="text-right text-sm text-white/80">
            <div className="font-medium text-white">{user.name}</div>
            <div>{roleLabel(user.role)}</div>
            <div>
              {formatLongDate(now)} · {formatTime(now)}
            </div>
          </div>
        </div>
        <nav className="border-t border-white/10 bg-navy-deep">
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
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
