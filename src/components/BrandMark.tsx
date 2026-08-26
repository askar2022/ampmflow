export const SCHOOL_NAME = "Sankofa Prep";

export function BrandMark({
  light = false,
  size = 48,
}: {
  light?: boolean;
  size?: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <img
        src="/sankofa-logo.jpg"
        alt="Sankofa Prep"
        width={size}
        height={size}
        className="rounded-full bg-white object-cover"
        style={{ width: size, height: size }}
      />
      <div>
        <p
          className={`text-[11px] uppercase tracking-[0.22em] ${
            light ? "text-gold" : "text-muted"
          }`}
        >
          {SCHOOL_NAME}
        </p>
        <p className={light ? "font-serif text-2xl text-white" : "font-serif text-2xl"}>
          Bus & Dismissal Tracker
        </p>
      </div>
    </div>
  );
}
