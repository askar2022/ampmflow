import { APP_NAME, APP_SUBTITLE, schoolInitials } from "@/lib/school";

export function BrandMark({
  light = false,
  schoolName,
  schoolLogoUrl,
  compact = false,
}: {
  light?: boolean;
  schoolName?: string | null;
  schoolLogoUrl?: string | null;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "flex items-center gap-3" : "flex flex-col"}>
      <div>
        <p
          className={`text-[1.35rem] font-semibold tracking-tight ${
            light ? "text-white" : "text-navy"
          }`}
        >
          {APP_NAME}
        </p>
        <p
          className={`text-[11px] font-medium tracking-[0.14em] uppercase ${
            light ? "text-white/65" : "text-muted"
          }`}
        >
          {APP_SUBTITLE}
        </p>
      </div>
      {schoolName ? (
        <SchoolChip
          name={schoolName}
          logoUrl={schoolLogoUrl}
          light={light}
          compact={compact}
        />
      ) : null}
    </div>
  );
}

export function SchoolChip({
  name,
  logoUrl,
  light = false,
  compact = false,
}: {
  name: string;
  logoUrl?: string | null;
  light?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={`inline-flex items-center gap-2.5 ${compact ? "mt-0" : "mt-5"}`}
    >
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={name}
          className={`rounded-xl object-contain ${
            compact ? "h-9 w-9" : "h-14 w-14 bg-black/30 p-1"
          }`}
        />
      ) : (
        <span
          className={`grid place-items-center rounded-xl text-xs font-semibold ${
            compact ? "h-9 w-9" : "h-14 w-14"
          } ${light ? "bg-teal text-white" : "bg-navy text-white"}`}
        >
          {schoolInitials(name)}
        </span>
      )}
      <span
        className={`font-medium ${compact ? "text-sm" : "text-[15px]"} ${
          light ? "text-white" : "text-navy"
        }`}
      >
        {name}
      </span>
    </div>
  );
}
