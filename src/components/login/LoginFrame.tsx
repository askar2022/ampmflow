import type { CSSProperties } from "react";
import Link from "next/link";
import { APP_NAME, APP_SUBTITLE, schoolTheme } from "@/lib/school";

export function LoginFrame({
  children,
  variant = "signin",
  schoolName,
  logoUrl,
  homeHref = "/",
}: {
  children: React.ReactNode;
  variant?: "signin" | "signup";
  schoolName?: string | null;
  logoUrl?: string | null;
  homeHref?: string;
}) {
  const illustrationWidth =
    variant === "signup"
      ? "w-[150px] short-h:w-[110px]"
      : "w-[170px] short-h:w-[128px]";
  const theme = schoolTheme(schoolName);
  const title = schoolName || APP_NAME;
  const subtitle = schoolName ? "Transportation Desk" : APP_SUBTITLE;

  return (
    <div
      className="flex min-h-dvh items-center justify-center overflow-x-hidden overflow-y-auto bg-[#f3f4f6] px-4 py-4 short-h:py-3 sm:py-6"
      style={
        {
          "--navy": theme.navy,
          "--navy-deep": theme.navyDeep,
        } as CSSProperties
      }
    >
      <div className="login-card w-full max-w-[440px] rounded-[20px] border border-[#e8e8ea] bg-white px-6 py-6 shadow-[0_16px_48px_rgba(15,23,42,0.08)] short-h:py-4 sm:px-8">
        <div className="flex flex-col items-center text-center">
          <Link href={homeHref} className="flex flex-col items-center">
            <img
              src={logoUrl || "/front_image.png"}
              alt=""
              className={`${illustrationWidth} h-auto object-contain ${logoUrl ? "" : "mix-blend-multiply"}`}
            />
            <h1 className="mt-1.5 text-[28px] leading-none font-semibold tracking-tight text-navy short-h:mt-1 short-h:text-[22px]">
              {title}
            </h1>
          </Link>
          <p className="mt-1.5 text-[13px] font-medium text-[#4b5563] short-h:mt-1">
            {subtitle}
          </p>
        </div>
        <div className="mt-4 short-h:mt-3">{children}</div>
        <p className="login-staff-note mt-5 text-center text-xs text-[#9aa1aa] short-h:hidden">
          Authorized staff only
        </p>
      </div>
    </div>
  );
}
