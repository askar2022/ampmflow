export default function WaitingLoading() {
  return (
    <div className="space-y-4">
      <div className="h-10 w-64 animate-pulse rounded-lg bg-line/60" />
      <div className="h-5 w-80 max-w-full animate-pulse rounded bg-line/40" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((key) => (
          <div
            key={key}
            className="h-36 animate-pulse rounded-2xl border border-line bg-card"
          />
        ))}
      </div>
    </div>
  );
}
