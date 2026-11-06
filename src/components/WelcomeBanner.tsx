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
          <img
            src={logoUrl!}
            alt=""
            className="mb-1.5 h-12 w-auto max-w-[15rem] self-start object-contain object-left sm:mb-2 sm:h-14 sm:max-w-[18rem] md:h-16"
          />
        ) : null}
        <h1 className="font-serif text-lg leading-tight text-navy sm:text-2xl">
          Welcome to {name || "your school"}
        </h1>
        <p className="mt-0.5 text-xs text-navy/80 sm:text-sm">{subtitle}</p>
      </div>
    </div>
  );
}
