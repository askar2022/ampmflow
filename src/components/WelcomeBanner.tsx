import { formatLongDate, schoolNow } from "@/lib/dates";

export const WELCOME_IMAGE = "/demo-2.jpg";

export function WelcomeBanner({
  schoolName,
  copy,
}: {
  schoolName?: string | null;
  copy?: string;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-line bg-card shadow-sm">
      <div className="relative h-48 sm:h-64">
        <img
          src={WELCOME_IMAGE}
          alt=""
          className="h-full w-full object-cover object-right"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[color:var(--navy)]/90 via-[color:var(--navy)]/45 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-end p-6 text-white sm:p-8">
          <p className="text-sm text-white/80">{formatLongDate(schoolNow())}</p>
          <h1 className="font-serif text-4xl">Welcome to reception</h1>
          <p className="mt-1 text-lg text-white/90">
            {schoolName || "Student desk"}
          </p>
          {copy ? (
            <p className="mt-2 max-w-md text-sm text-white/80">{copy}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
