export default function ChangesLoading() {
  return (
    <div className="space-y-4">
      <div className="h-10 w-56 animate-pulse rounded-lg bg-line/60" />
      <div className="h-5 w-80 max-w-full animate-pulse rounded bg-line/40" />
      <div className="h-64 animate-pulse rounded-2xl border border-line bg-card" />
    </div>
  );
}
