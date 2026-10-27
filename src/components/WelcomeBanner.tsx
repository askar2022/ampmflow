export const WELCOME_IMAGE = "/demo4.png";

export function HeaderWelcome({
  schoolName,
}: {
  schoolName?: string | null;
}) {
  return (
    <div className="relative h-40 overflow-hidden rounded-2xl sm:h-48">
      <img
        src={WELCOME_IMAGE}
        alt=""
        className="h-full w-full object-cover object-right"
      />
      <div className="absolute inset-0 flex flex-col items-start justify-center px-5">
        <h1 className="font-serif text-2xl leading-tight text-navy sm:text-3xl">
          Welcome to {schoolName || "your school"}
        </h1>
        <p className="mt-0.5 text-sm text-navy/80">Transportation Desk</p>
      </div>
    </div>
  );
}
