export default function Loading() {
  return (
    <div className="container-page space-y-4 py-8" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-1/3 animate-pulse rounded bg-line" />
      {[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-line" />)}
    </div>
  );
}
