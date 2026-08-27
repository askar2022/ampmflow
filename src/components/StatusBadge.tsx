import { toneLabel, type StatusTone } from "@/lib/format";

export function StatusBadge({
  tone,
  children,
}: {
  tone: StatusTone;
  children?: React.ReactNode;
}) {
  return (
    <span
      className={`badge-${tone} inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium tracking-wide`}
    >
      {children ?? toneLabel(tone)}
    </span>
  );
}
