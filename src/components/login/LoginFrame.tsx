import {
  APP_NAME,
  APP_SUBTITLE,
  DEFAULT_SCHOOL_LOGO,
  schoolInitials,
} from "@/lib/school";
import type { SchoolIdentity } from "@/lib/school";

export function LoginFrame({
  school,
  children,
}: {
  school: SchoolIdentity | null;
  children: React.ReactNode;
}) {
  const name = school?.name ?? "Sankofa Prep";
  const logoUrl = school ? school.logoUrl : DEFAULT_SCHOOL_LOGO;

  return (
    <div className="flex min-h-dvh items-center justify-center overflow-x-hidden bg-[#eceae6] px-4 py-8">
      <div className="w-full max-w-[440px] rounded-[20px] border border-[#e2e0dc] bg-white px-6 py-8 shadow-[0_12px_40px_rgba(14,36,56,0.08)] sm:px-8 sm:py-10">
        <div className="flex flex-col items-center text-center">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={name}
              width={72}
              height={72}
              className="h-[72px] w-[72px] object-contain"
            />
          ) : (
            <span className="grid h-[72px] w-[72px] place-items-center rounded-2xl bg-navy text-lg font-semibold text-white">
              {schoolInitials(name)}
            </span>
          )}
          <p className="mt-3 text-[15px] font-medium text-navy">{name}</p>
          <h1 className="mt-5 text-[28px] leading-none font-semibold tracking-tight text-navy">
            {APP_NAME}
          </h1>
          <p className="mt-2 text-[13px] text-muted">{APP_SUBTITLE}</p>
        </div>
        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}
