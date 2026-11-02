import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto w-full max-w-xl px-5 py-12">
      <h1 className="text-4xl">Page not found</h1>
      <p className="mt-4">
        <Link href="/">Back to the start</Link>
      </p>
    </main>
  );
}
