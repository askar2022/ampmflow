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
  { href: "/waiting", label: "Submit new request", roles: ["COORDINATOR", "ADMINISTRATOR", "FRONT_DESK"] },
  { href: "/changes", label: "Today’s Changes", roles: ["COORDINATOR", "ADMINISTRATOR", "FRONT_DESK"] },
  { href: "/gps", label: "Live GPS", roles: ["COORDINATOR", "ADMINISTRATOR", "FRONT_DESK"] },
  { href: "/analytics", label: "Analytics", roles: ["COORDINATOR", "ADMINISTRATOR", "FRONT_DESK"] },
  { href: "/buses", label: "Roster", roles: ["COORDINATOR", "ADMINISTRATOR", "FRONT_DESK"] },
  { href: "/print", label: "Print list", roles: ["COORDINATOR", "ADMINISTRATOR", "FRONT_DESK", "TEACHER"] },
  { href: "/company", label: "Open requests", roles: ["BUS_COMPANY"] },
  { href: "/company/alerts", label: "Late Bus Alert", roles: ["BUS_COMPANY"] },
  { href: "/company/gps", label: "Live GPS", roles: ["BUS_COMPANY"] },
  { href: "/company/gps-report", label: "GPS Report", roles: ["BUS_COMPANY"] },
  { href: "/admin/users", label: "Users", roles: ["ADMINISTRATOR"] },
  { href: "/teacher", label: "My Classroom", roles: ["TEACHER"] },
  { href: "/checkin", label: "Bus Check-In", roles: ["BUS_ASSISTANT"] },
];

export function AppShell({
  user,
  schoolName,
  headerName,
  schoolLogoUrl,
  showPlatform = false,
  children,
}: {
  user: SessionUser;
  schoolName?: string | null;
  headerName?: string | null;
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
              name={company ? headerName || user.name : schoolName}
              subtitle={company ? "Bus company" : "Transportation Desk"}
              logoUrl={company ? null : schoolLogoUrl}
            />
          </Link>
        </div>
        <nav className="mx-auto mt-3 flex max-w-[1100px] flex-col gap-2 px-4 sm:flex-row sm:items-center sm:px-6">
          <div className="min-w-0 w-full">
            <div className="flex min-h-[44px] w-full flex-wrap items-center gap-1 rounded-[22px] bg-navy-deep px-2 py-1 text-[14px] text-white">
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
              <button className="inline-flex min-h-[44px] shrink-0 items-center whitespace-nowrap rounded-full border border-navy/25 bg-white px-5 py-2 text-[14px] font-semibold text-navy sm:min-h-10 sm:px-5 sm:text-[13px]">
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
