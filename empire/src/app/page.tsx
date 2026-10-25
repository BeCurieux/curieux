import { SiteFooter, SiteHeader } from "@/components/shell/site-header";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { ViewBeacon } from "@/components/beacon";
import { TAGLINE } from "@/content/brand";
import { LAUNCH_PACK, REFUND_POLICY } from "@/lib/billing/plans";
import { launchPackOnSale } from "@/lib/billing/on-sale";

const OUTPUTS = [
  ["Brand Blueprint", "Positioning, ideal customer, palette, type, tone and photo direction."],
  [
    "Sidekick prompt pack",
    "Ten prompts for Shopify's own assistant, each with what to check after.",
  ],
  ["Homepage copy", "Hero, value props, about, FAQ and signup — in your voice."],
  ["Product listings", "Titles, descriptions, specs, FAQ and SEO, from your real product facts."],
  [
    "Photo briefs",
    "Shot plans for hero, detail, lifestyle and Instagram images, plus Canva steps.",
  ],
  ["Launch emails", "An announcement and a three-email sequence."],
  ["Social launch kit", "Five Reels, five captions, three carousels and a 7-day calendar."],
  ["Launch checklist", "Payments, policies, shipping, a test order — adapted to your business."],
];

const HONEST = [
  [
    "It writes from your facts.",
    "If a listing needs something you haven't told us — dimensions, delivery times — it asks instead of inventing it.",
  ],
  [
    "It won't promise sales.",
    "No one honest can. It gives you a clear brand, usable copy and a plan; the launching is yours.",
  ],
  [
    "Sidekick prompts are instructions, not magic.",
    "What Shopify Sidekick can change depends on your theme. Every prompt says what to check, and you never publish without reviewing.",
  ],
  [
    "A photo brief isn't a photo.",
    "You'll shoot your real product. We tell you exactly how, and how to keep edited images truthful.",
  ],
];

export default function Home() {
  return (
    <>
      <ViewBeacon name="landing_viewed" />
      <SiteHeader />
      <main id="main">
        <section className="mx-auto grid max-w-6xl gap-10 px-5 pt-10 pb-16 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:pt-16">
          <div>
            <p className="eyebrow mb-5">Empire Studio · by Her Little Empire</p>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl">
              Your Shopify launch, written, planned and ready to paste.
            </h1>
            <p className="text-mute mt-6 max-w-xl text-xl">
              Tell us about your business once. Get a coordinated launch pack — brand, store setup,
              product copy, photo briefs, emails and a checklist — that all sound like you.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <ButtonLink href="/sign-in?start=1">Start free — no card</ButtonLink>
              <ButtonLink href="/pricing" variant="secondary">
                See what's included
              </ButtonLink>
            </div>
            <p className="text-mute mt-4 text-sm">{TAGLINE}</p>
          </div>
          <Card className="bg-aubergine text-ivory self-start">
            <div className="flex items-center justify-between gap-3">
              <p className="eyebrow text-blush">Sample Sidekick prompt</p>
              <Badge tone="blush">Example brand</Badge>
            </div>
            <p className="text-blush mt-3 text-sm">
              For a made-up shop, Juniper &amp; Thread. Yours uses your name, colours and words.
            </p>
            <pre className="bg-aubergine-deep text-ivory mt-4 rounded-2xl p-4 font-mono text-[0.8rem] leading-relaxed whitespace-pre-wrap">
              {`In my theme settings, update the colour scheme for Juniper & Thread: background #F5EFE3, text #262326, buttons and links #632B39, secondary section background #E9E0D0. Set headings to Lora and body text to Karla. Don't change any section content and don't publish.`}
            </pre>
            <p className="text-blush mt-4 text-sm">
              Check after: button text is readable, fonts changed everywhere, checkout still looks
              right.
            </p>
          </Card>
        </section>

        <section className="border-line bg-paper border-y">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
            <p className="eyebrow">What you walk away with</p>
            <h2 className="mt-3 max-w-2xl text-4xl">
              Eight pieces of one launch — not eight random documents.
            </h2>
            <ul className="mt-10 grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
              {OUTPUTS.map(([title, body]) => (
                <li key={title} className="border-blush border-t-2 pt-4">
                  <h3 className="text-xl">{title}</h3>
                  <p className="text-mute mt-2">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
          <p className="eyebrow">How it works</p>
          <ol className="mt-6 grid gap-6 md:grid-cols-4">
            {[
              ["Tell us about your business", "Ten minutes, plain questions. Fill in more later."],
              ["Get your Brand Blueprint", "Edit anything. Everything else reads from it."],
              [
                "Pick a workflow",
                "Design the store, write listings, plan photos or plan the launch.",
              ],
              [
                "Edit, copy, save, download",
                "Every version is kept. Export the whole pack in one go.",
              ],
            ].map(([title, body], i) => (
              <li key={title} className="bg-blush-soft rounded-3xl p-6">
                <span className="text-aubergine font-num text-4xl">{i + 1}</span>
                <h3 className="mt-3 text-xl">{title}</h3>
                <p className="text-mute mt-2">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-8 sm:px-8">
          <Card>
            <p className="eyebrow">The honest bit</p>
            <h2 className="mt-3 text-3xl">What Empire Studio is, and isn't</h2>
            <dl className="mt-8 grid gap-8 md:grid-cols-2">
              {HONEST.map(([title, body]) => (
                <div key={title}>
                  <dt className="text-aubergine font-serif text-xl">{title}</dt>
                  <dd className="text-mute mt-2">{body}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16 text-center sm:px-8">
          <h2 className="text-4xl">Try it free. Upgrade when it's earned it.</h2>
          <p className="text-mute mx-auto mt-4 max-w-xl text-lg">
            The free studio gives you a brand preview and a real Sidekick prompt for your store.{" "}
            {launchPackOnSale()
              ? `The ${LAUNCH_PACK.name} is ${LAUNCH_PACK.priceLabel}, once. ${REFUND_POLICY}`
              : `The ${LAUNCH_PACK.name} isn't on sale yet.`}
          </p>
          <div className="mt-8 flex justify-center">
            <ButtonLink href="/sign-in?start=1">Start free</ButtonLink>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
