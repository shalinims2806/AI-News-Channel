import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-page py-24 text-center">
      <p className="font-serif text-6xl font-extrabold text-brand">404</p>
      <h1 className="section-title mt-2">We couldn&apos;t find that page</h1>
      <Link href="/" className="btn-brand mt-6">Back to home</Link>
    </div>
  );
}
