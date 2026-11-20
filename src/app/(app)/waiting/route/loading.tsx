export default function WaitingRouteLoading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-40 animate-pulse rounded bg-line/50" />
      <div className="h-10 w-72 animate-pulse rounded-xl bg-line/60" />
      <div className="h-64 animate-pulse rounded-2xl border border-line bg-card" />
    </div>
  );
}
