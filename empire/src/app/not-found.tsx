import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto max-w-xl px-5 py-24 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-3 text-4xl">That page isn't here.</h1>
      <p className="mt-3 text-ink-soft">It may have moved, or it belongs to someone else's studio.</p>
      <div className="mt-6 flex justify-center"><ButtonLink href="/studio">Back to your studio</ButtonLink></div>
    </main>
  );
}
