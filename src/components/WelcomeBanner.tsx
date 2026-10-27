export const WELCOME_IMAGE = "/demo-2.jpg";

export function HeaderWelcome({
  schoolName,
  meta,
}: {
  schoolName?: string | null;
  meta?: string;
}) {
  return (
    <div className="relative h-40 overflow-hidden sm:h-52">
      <img
        src={WELCOME_IMAGE}
        alt=""
        className="h-full w-full object-cover object-right"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[color:var(--navy)]/88 via-[color:var(--navy)]/40 to-transparent" />
      <div className="absolute inset-0 flex items-end justify-between gap-4 px-4 py-5 sm:px-6">
        <div>
          <p className="text-sm font-semibold tracking-wide text-white/80">
            AMPM Flow
          </p>
          <h1 className="mt-1 font-serif text-3xl text-white sm:text-4xl">
            Welcome to {schoolName || "your school"}
          </h1>
          <p className="mt-1 text-sm text-white/85 sm:text-base">
            Student Transportation Desk
          </p>
        </div>
        {meta ? (
          <p className="max-w-[40%] text-right text-xs text-white/80 sm:text-sm">
            {meta}
          </p>
        ) : null}
      </div>
    </div>
  );
}
