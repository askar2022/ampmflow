import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { roleLabel } from "@/lib/format";
import { formatLongDate, formatTime, schoolNow } from "@/lib/dates";
import { BrandMark, SCHOOL_NAME } from "@/components/BrandMark";
import type { SessionUser } from "@/lib/types";

const NAV: { href: string; label: string; roles: SessionUser["role"][] }[] = [
  { href: "/dashboard", label: "Dashboard", roles: ["COORDINATOR", "FRONT_DESK"] },
  { href: "/leadership", label: "Leadership", roles: ["ADMINISTRATOR", "COORDINATOR"] },
  { href: "/changes", label: "Today’s Changes", roles: ["COORDINATOR", "ADMINISTRATOR", "FRONT_DESK"] },
  { href: "/activity", label: "Today’s Activity", roles: ["COORDINATOR", "ADMINISTRATOR", "FRONT_DESK"] },
  { href: "/buses", label: "Buses", roles: ["COORDINATOR", "ADMINISTRATOR", "FRONT_DESK"] },
  { href: "/pickup", label: "Parent Pickup", roles: ["COORDINATOR", "ADMINISTRATOR", "FRONT_DESK"] },
  { href: "/waiting", label: "Waiting for Route", roles: ["COORDINATOR", "ADMINISTRATOR", "FRONT_DESK"] },
  { href: "/acknowledgments", label: "Teacher Acknowledgments", roles: ["COORDINATOR", "ADMINISTRATOR", "FRONT_DESK"] },
  { href: "/checkin", label: "Bus Check-In", roles: ["COORDINATOR", "BUS_ASSISTANT"] },
  { href: "/students", label: "Students", roles: ["COORDINATOR", "ADMINISTRATOR", "FRONT_DESK"] },
  { href: "/print", label: "Reports", roles: ["COORDINATOR", "ADMINISTRATOR", "TEACHER"] },
  { href: "/teacher", label: "My Classroom", roles: ["TEACHER"] },
  { href: "/company", label: "Bus Company", roles: ["COORDINATOR", "ADMINISTRATOR", "BUS_COMPANY"] },
  { href: "/admin/users", label: "Users", roles: ["ADMINISTRATOR", "COORDINATOR"] },
];

export function AppShell({
  user,
  schoolName = SCHOOL_NAME,
  children,
}: {
  user: SessionUser;
  schoolName?: string;
  children: React.ReactNode;
}) {
  const now = schoolNow();
  const links = NAV.filter((item) => item.roles.includes(user.role));

  return (
    <div className="min-h-full">
      <header className="no-print bg-navy text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <Link
            href={
              user.role === "TEACHER"
                ? "/teacher"
                : user.role === "BUS_ASSISTANT"
                  ? "/checkin"
                  : user.role === "ADMINISTRATOR"
                    ? "/leadership"
                    : "/dashboard"
            }
          >
            <BrandMark light size={56} />
            <span className="sr-only">{schoolName}</span>
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
            {links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-3 py-1.5 text-sm hover:bg-white/10 ${
                  item.label === "Today’s Changes"
                    ? "bg-gold text-navy-deep font-semibold hover:bg-gold/90"
                    : "text-white/90"
                }`}
              >
                {item.label}
              </Link>
            ))}
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
