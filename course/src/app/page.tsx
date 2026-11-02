import Link from "next/link";

// Placeholder until the sales page is built (SPEC.md → Build order, step 6).
export default function Home() {
  return (
    <main id="main" className="mx-auto w-full max-w-xl px-5 py-12">
      <h1 className="text-4xl sm:text-5xl">Her Little Empire</h1>
      <p className="mt-4 text-xl">Check whether your product idea adds up before you buy stock.</p>
      <p className="mt-8">
        <Link
          href="/learn"
          className="bg-accent text-on-accent inline-block rounded-full px-6 py-4 text-lg font-semibold no-underline"
        >
          Go to the course
        </Link>
      </p>
    </main>
  );
}
