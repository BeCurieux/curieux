"use client";

import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="main" className="mx-auto max-w-xl px-5 py-24 text-center">
      <p className="eyebrow">Something went wrong</p>
      <h1 className="mt-3 text-4xl">That didn't work — and it's not you.</h1>
      <p className="mt-3 text-ink-soft">Your saved work is safe. Try again, and if it keeps happening, email us.</p>
      <div className="mt-6 flex justify-center"><Button onClick={reset}>Try again</Button></div>
    </main>
  );
}
