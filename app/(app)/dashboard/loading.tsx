export default function DashboardLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading your planner">
      <div className="h-9 w-64 animate-pulse rounded-lg bg-zinc-200/70" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl border border-zinc-200 bg-white" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[400px_minmax(0,1fr)]">
        <div className="h-[70vh] animate-pulse rounded-xl border border-zinc-200 bg-white" />
        <div className="h-[70vh] animate-pulse rounded-xl border border-zinc-200 bg-white" />
      </div>
    </div>
  );
}
