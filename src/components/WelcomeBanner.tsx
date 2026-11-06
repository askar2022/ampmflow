export const WELCOME_IMAGE = "/demo4.png";

export function HeaderWelcome({
  name,
  subtitle = "Transportation Desk",
  logoUrl,
}: {
  name?: string | null;
  subtitle?: string;
  logoUrl?: string | null;
}) {
  const showLogo = Boolean(logoUrl?.trim());

  return (
    <div className="relative h-32 overflow-hidden rounded-2xl sm:h-40 md:h-48">
      <img
        src={WELCOME_IMAGE}
        alt=""
        className="h-full w-full object-cover object-right"
      />
      <div className="absolute inset-y-0 left-0 flex w-[70%] max-w-[18rem] flex-col justify-center px-3 sm:w-[58%] sm:max-w-[26rem] sm:px-5">
        {showLogo ? (
          <div className="mb-1.5 inline-flex max-w-full items-center rounded-xl bg-white/92 px-2.5 py-1.5 shadow-sm ring-1 ring-black/5 sm:mb-2 sm:px-3 sm:py-2">
            <img
              src={logoUrl!}
              alt=""
              className="h-8 w-auto max-w-[9.5rem] object-contain object-left sm:h-10 sm:max-w-[12rem]"
            />
          </div>
        ) : null}
        <h1 className="font-serif text-lg leading-tight text-navy sm:text-2xl">
          Welcome to {name || "your school"}
        </h1>
        <p className="mt-0.5 text-xs text-navy/80 sm:text-sm">{subtitle}</p>
      </div>
    </div>
  );
}
