export const WELCOME_IMAGE = "/demo4.png";

export function HeaderWelcome({
  schoolName,
}: {
  schoolName?: string | null;
}) {
  return (
    <div className="relative h-32 overflow-hidden rounded-2xl sm:h-40 md:h-48">
      <img
        src={WELCOME_IMAGE}
        alt=""
        className="h-full w-full object-cover object-right"
      />
      <div className="absolute inset-y-0 left-0 flex w-[54%] max-w-[11.5rem] flex-col justify-center px-3 sm:w-[46%] sm:max-w-[18rem] sm:px-5">
        <h1 className="font-serif text-lg leading-tight text-navy sm:text-2xl">
          Welcome to {schoolName || "your school"}
        </h1>
        <p className="mt-0.5 text-xs text-navy/80 sm:text-sm">Transportation Desk</p>
      </div>
    </div>
  );
}
