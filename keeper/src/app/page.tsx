// Landing page (brief §28). Leads with the family, not the AI.
import Link from "next/link";

export default function LandingPage() {
  return (
    <div>
      <section className="py-24 text-center">
        <h1 className="mx-auto max-w-3xl text-5xl leading-tight tracking-tight md:text-6xl">
          They won&rsquo;t remember being two.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-ink/70">
          Turn the moments buried in your camera roll — and the little things
          you&rsquo;d otherwise forget — into a beautiful book of their year.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link href="/signup" className="btn">Make their year</Link>
          <a href="#how" className="btn-secondary">See how it works</a>
        </div>
      </section>

      <section id="how" className="grid gap-8 border-t border-sand py-20 md:grid-cols-3">
        {[
          {
            n: "1",
            title: "Add their moments",
            body: "Photos from your camera roll, the things they say, a quick voice note. No sorting required.",
          },
          {
            n: "2",
            title: "We help make sense of them",
            body: "We gather the moments into the stories of their year — the swimming era, the yellow boots, Grandpa Thursdays — and ask only the questions the photos can't answer.",
          },
          {
            n: "3",
            title: "Receive their year in a beautiful book",
            body: "A hardcover book, designed like it came from a small independent publisher. You approve every page before it prints.",
          },
        ].map((step) => (
          <div key={step.n}>
            <div className="font-display text-4xl text-clay">{step.n}</div>
            <h2 className="mt-3 text-xl">{step.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink/70">{step.body}</p>
          </div>
        ))}
      </section>

      <section className="border-t border-sand py-20 text-center">
        <p className="font-display text-2xl italic text-ink/80">
          You live it. We help you keep it.
        </p>
      </section>
    </div>
  );
}
