export const WELCOME_IMAGE = "/demo-2.jpg";

export function HeaderWelcome({
  schoolName,
  meta,
}: {
  schoolName?: string | null;
  meta?: string;
}) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6">
      <div className="relative overflow-hidden rounded-2xl">
        <img
          src={WELCOME_IMAGE}
          alt=""
          className="h-48 w-full object-cover object-center sm:h-56"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--navy)]/75 via-[color:var(--navy)]/25 to-transparent" />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
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
          <p className="absolute bottom-3 right-4 hidden max-w-[42%] text-right text-xs text-white/75 sm:block">
            {meta}
          </p>
        ) : null}
      </div>
    </div>
  );
}
