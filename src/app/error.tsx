"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="container-page py-24 text-center">
      <h1 className="section-title">Something went wrong</h1>
      <p className="mt-2 text-muted">We hit a problem loading this page. Please try again.</p>
      <button onClick={reset} className="btn-brand mt-6">Try again</button>
    </div>
  );
}
