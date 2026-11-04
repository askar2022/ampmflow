import type { CSSProperties } from "react";
import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { AppNav } from "@/components/AppNav";
import { HeaderWelcome } from "@/components/WelcomeBanner";
import { schoolTheme } from "@/lib/school";
import type { SessionUser } from "@/lib/types";

function deskNavLabel(schoolName?: string | null) {
  return /metro/i.test(schoolName || "") ? "Dashboard" : "Front Desk";
}

const NAV: { href: string; label: string; roles: SessionUser["role"][] }[] = [
  { href: "/dashboard", label: "Front Desk", roles: ["COORDINATOR", "ADMINISTRATOR", "FRONT_DESK"] },
  { href: "/waiting", label: "Request for Route", roles: ["COORDINATOR", "ADMINISTRATOR", "FRONT_DESK"] },
  { href: "/changes", label: "Today’s Changes", roles: ["COORDINATOR", "ADMINISTRATOR", "FRONT_DESK"] },
  { href: "/analytics", label: "Analytics", roles: ["COORDINATOR", "ADMINISTRATOR"] },
  { href: "/buses", label: "Roster", roles: ["COORDINATOR", "ADMINISTRATOR", "FRONT_DESK"] },
  { href: "/print", label: "Reports", roles: ["COORDINATOR", "ADMINISTRATOR", "FRONT_DESK", "TEACHER"] },
  { href: "/company", label: "Today’s Changes", roles: ["BUS_COMPANY"] },
  { href: "/admin/users", label: "Users", roles: ["ADMINISTRATOR"] },
  { href: "/teacher", label: "My Classroom", roles: ["TEACHER"] },
  { href: "/checkin", label: "Bus Check-In", roles: ["BUS_ASSISTANT"] },
];

export function AppShell({
  user,
  schoolName,
  showPlatform = false,
  children,
}: {
  user: SessionUser;
  schoolName?: string | null;
  schoolLogoUrl?: string | null;
  showPlatform?: boolean;
  children: React.ReactNode;
}) {
  const links = NAV.filter((item) => item.roles.includes(user.role)).map(
    (item) =>
      item.href === "/dashboard"
        ? { ...item, label: deskNavLabel(schoolName) }
        : item,
  );
  const company = user.role === "BUS_COMPANY";
  const theme = schoolTheme(company ? null : schoolName);
  const home =
    user.role === "TEACHER"
      ? "/teacher"
      : user.role === "BUS_ASSISTANT"
        ? "/checkin"
        : company
          ? "/company"
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
        <div className="mx-auto max-w-[1100px] px-4 pt-3 sm:px-6">
          <Link href={home} className="block">
            <HeaderWelcome
              name={company ? user.name : schoolName}
              subtitle={company ? "Bus company" : "Transportation Desk"}
            />
          </Link>
        </div>
        <nav className="mx-auto mt-3 flex max-w-[1100px] flex-col gap-2 px-4 sm:flex-row sm:items-center sm:px-6">
          <div className="nav-scroll min-w-0">
            <div className="inline-flex min-h-[44px] min-w-max items-center gap-1 rounded-full bg-navy-deep px-2 text-[14px] text-white">
              <AppNav links={links} />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 self-end sm:ml-auto sm:self-auto">
            {showPlatform ? (
              <Link
                href="/platform"
                className="inline-flex min-h-[44px] items-center rounded-[12px] border border-navy/25 bg-white px-4 text-[14px] font-semibold text-navy sm:min-h-8 sm:rounded-full sm:px-3 sm:text-[13px]"
              >
                Add schools
              </Link>
            ) : null}
            <form action={logoutAction}>
              {user.role === "BUS_COMPANY" ? (
                <input type="hidden" name="next" value="company" />
              ) : null}
              <button className="min-h-[44px] rounded-[12px] border border-navy/25 bg-white px-4 text-[14px] font-semibold text-navy sm:min-h-8 sm:rounded-full sm:px-3 sm:text-[13px]">
                Sign Out
              </button>
            </form>
          </div>
        </nav>
      </header>
      <main className="mx-auto min-w-0 w-full max-w-[1100px] px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}
