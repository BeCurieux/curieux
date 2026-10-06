import Link from "next/link";

// Shown throughout a pretend school from "Try it yourself"
// (docs/TRY_IT_YOURSELF.md), so no one mistakes it for a real one.
export function DemoBanner({ expiresAt }: { expiresAt: string }) {
  const until = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(expiresAt));
  return (
    <section
      aria-label="Demo school"
      className="mb-6 flex flex-col gap-3 rounded-md bg-[#e8e3ff] px-4 py-3 text-[#2e2366] sm:flex-row sm:items-center sm:justify-between"
    >
      <p>
        <span className="font-semibold">This is a pretend school, just for you.</span> Click
        anything: nothing here sends emails or takes payments, and it’s deleted {until}.
      </p>
      <div className="flex shrink-0 flex-wrap items-center gap-4 font-semibold">
        <Link href="/founding" className="underline underline-offset-2">
          Join the founding schools
        </Link>
        <form action="/auth/sign-out" method="post">
          <button type="submit" className="underline underline-offset-2">
            Leave the demo
          </button>
        </form>
      </div>
    </section>
  );
}
