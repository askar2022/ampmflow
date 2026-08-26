import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { roleLabel } from "@/lib/format";
import { formatLongDate, formatTime, schoolNow } from "@/lib/dates";
import type { SessionUser } from "@/lib/types";

const NAV: { href: string; label: string; roles: SessionUser["role"][] }[] = [
  { href: "/dashboard", label: "Dashboard", roles: ["COORDINATOR", "ADMINISTRATOR", "FRONT_DESK"] },
  { href: "/buses", label: "Buses", roles: ["COORDINATOR", "ADMINISTRATOR", "FRONT_DESK"] },
  { href: "/pickup", label: "Parent Pickup", roles: ["COORDINATOR", "ADMINISTRATOR", "FRONT_DESK"] },
  { href: "/changes", label: "Today’s Changes", roles: ["COORDINATOR", "ADMINISTRATOR", "FRONT_DESK"] },
  { href: "/students", label: "Students", roles: ["COORDINATOR", "ADMINISTRATOR", "FRONT_DESK"] },
  { href: "/teachers", label: "Teacher Lists", roles: ["COORDINATOR", "ADMINISTRATOR", "FRONT_DESK"] },
  { href: "/company", label: "Bus Company Updates", roles: ["COORDINATOR", "ADMINISTRATOR", "BUS_COMPANY"] },
  { href: "/print", label: "Print / Email", roles: ["COORDINATOR", "ADMINISTRATOR", "TEACHER"] },
  { href: "/teacher", label: "My Classroom", roles: ["TEACHER"] },
  { href: "/requests", label: "Requests", roles: ["COORDINATOR", "ADMINISTRATOR", "FRONT_DESK"] },
  { href: "/admin/users", label: "Users", roles: ["ADMINISTRATOR", "COORDINATOR"] },
  { href: "/audit", label: "Audit History", roles: ["COORDINATOR", "ADMINISTRATOR"] },
];

export function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const now = schoolNow();
  const links = NAV.filter((item) => item.roles.includes(user.role));

  return (
    <div className="min-h-full">
      <header className="no-print bg-navy text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-gold">
              Riverside Elementary
            </p>
            <Link href={user.role === "TEACHER" ? "/teacher" : "/dashboard"} className="font-serif text-2xl">
              Bus & Dismissal Tracker
            </Link>
          </div>
          <div className="text-right text-sm text-white/80">
            <div className="font-medium text-white">{user.name}</div>
            <div>{roleLabel(user.role)}</div>
            <div>
              {formatLongDate(now)} · {formatTime(now)}
            </div>
          </div>
        </div>
        <nav className="border-t border-white/10 bg-navy-deep">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-1 px-4 py-2">
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
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
