export const SCHOOL_NAME = "Sankofa Prep";
export const APP_NAME = "ampmflow";

export function BrandMark({
  light = false,
  size = 72,
}: {
  light?: boolean;
  size?: number;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <p
        className={`text-[11px] uppercase tracking-[0.22em] ${
          light ? "text-gold" : "text-muted"
        }`}
      >
        {SCHOOL_NAME}
      </p>
      <p
        className={
          light
            ? "mt-1 font-serif text-3xl text-white"
            : "mt-1 font-serif text-3xl"
        }
      >
        {APP_NAME}
      </p>
      <img
        src="/sankofa-logo.jpg"
        alt={SCHOOL_NAME}
        width={size}
        height={size}
        className="mt-4 rounded-full bg-white object-cover"
        style={{ width: size, height: size }}
      />
    </div>
  );
}
