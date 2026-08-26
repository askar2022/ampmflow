import { APP_NAME, APP_SUBTITLE, APP_TAGLINE } from "@/lib/school";
import type { SchoolIdentity } from "@/lib/school";
import { SchoolChip } from "@/components/BrandMark";
import { RouteCanvas } from "@/components/login/RouteCanvas";

export function LoginFrame({
  school,
  children,
}: {
  school: SchoolIdentity | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center overflow-x-hidden bg-paper px-4 py-8 sm:px-6">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-line bg-card shadow-xl md:grid-cols-2">
        <aside className="relative isolate overflow-hidden bg-navy px-6 py-7 text-white sm:px-8 sm:py-8">
          <RouteCanvas />
          <div className="relative z-10">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {APP_NAME}
            </h1>
            <p className="mt-1.5 text-xs font-medium tracking-[0.14em] text-white/65 uppercase">
              {APP_SUBTITLE}
            </p>
            <p className="mt-4 text-base font-medium text-white/90">
              {APP_TAGLINE}
            </p>
            {school ? (
              <SchoolChip
                name={school.name}
                logoUrl={school.logoUrl}
                light
              />
            ) : null}
          </div>
        </aside>
        <main className="flex items-center px-5 py-6 sm:px-7 sm:py-7">
          <div className="w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
