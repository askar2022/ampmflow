export default function AnalyticsLoading() {
  return (
    <div className="space-y-4">
      <div className="h-10 w-48 animate-pulse rounded-xl bg-card" />
      <div className="h-40 animate-pulse rounded-2xl border border-line bg-card" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-28 animate-pulse rounded-2xl border border-line bg-card" />
        <div className="h-28 animate-pulse rounded-2xl border border-line bg-card" />
      </div>
    </div>
  );
}
