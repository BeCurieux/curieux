import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Calculator, PlanTracker } from "@/components/fit/report-widgets";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { catalogueItem } from "@/content/catalogue";
import { OPPORTUNITIES, UNIT } from "@/lib/fit/data";
import { country, gates, plan, risks, scoreAll, top3, whyFits } from "@/lib/fit/engine";
import { parseAnswers } from "@/lib/fit/validate";
import { DISCLAIMER, RULES } from "@/lib/fit/rules";
import { REFUND_POLICY } from "@/lib/billing/plans";
import { loadAccess } from "@/lib/generation/run";
import { studio } from "@/lib/studio/context";

export const metadata: Metadata = { title: "Your Income Fit Report" };

const fmt = (d: string) =>
  new Date(d).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });

function Section({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-line bg-paper rounded-3xl border p-5 sm:p-8">
      <p className="eyebrow">{label}</p>
      <h2 className="mt-2 text-3xl">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export default async function FitReport({ params }: { params: Promise<{ resultId: string }> }) {
  const { resultId } = await params;
  const { repo } = await studio();
  const result = await repo.getFitResult(resultId);
  if (!result) notFound();
  const a = parseAnswers(result.answers);
  if (!a) notFound();
  const { access } = await loadAccess(repo);
  const scored = scoreAll(a);
  const t = top3(scored);
  const out = scored.filter((s) => s.filtered);
  const [sym] = [country(a.country)[1]];
  const name = a.name.trim();
  const product = catalogueItem("income-fit-test")!;
  const buyUrl = process.env.NEXT_PUBLIC_INCOME_FIT_TEST_URL || "https://herlittleempire.com";
  const chips = [
    `${a.hours} hr${a.hours === 1 ? "" : "s"} a week`,
    `${a.block}-hour blocks`,
    a.evenings === "Yes" ? "evenings OK" : "no evenings",
    `${sym}${a.budget.toLocaleString("en")} to start`,
    a.contact === "None" ? "no customer contact" : a.contact.toLowerCase(),
    a.skill1 + (a.skill2 ? ` + ${a.skill2}` : ""),
    a.camera === "No" ? "off camera" : "camera OK",
    a.priority,
    a.country.replace(" (use US$)", ""),
  ];
  const s1 = t[0];
  const R = RULES[a.country];

  return (
    <main id="main" className="mx-auto max-w-4xl space-y-6 px-5 py-10 sm:px-8">
      <header className="bg-aubergine text-ivory rounded-3xl p-6 sm:p-10">
        <p className="eyebrow text-blush">Income Fit Report · {fmt(result.createdAt)}</p>
        <h1 className="text-ivory mt-4 text-4xl sm:text-5xl">
          {name ? `${name}, here's` : "Here's"} what fits.
        </h1>
        <ul className="mt-5 flex flex-wrap gap-2">
          {chips.map((c) => (
            <li
              key={c}
              className="border-blush/40 text-blush rounded-full border px-3 py-1 text-sm"
            >
              {c}
            </li>
          ))}
        </ul>
        <p className="text-ivory mt-6 font-serif text-2xl">
          {s1 ? (
            <>
              Test <b>{s1.o.name}</b> first.
              {t[1] ? ` If it doesn't pass, your back-up is ${t[1].o.name}.` : ""}
            </>
          ) : (
            "Nothing fits your answers right now. That's an honest result, not a failure."
          )}
        </p>
      </header>

      {!access.fitFinder ? (
        <Card className="border-aubergine">
          <h2 className="text-2xl">Your full report is part of {product.title}</h2>
          <p className="mt-2">
            You've seen your first pick. The full report adds your top three side by side, why each
            fits you and what could go wrong, a calculator with your go/stop line, the rules for
            your country, a dated 14-day test and your Day 14 decision rules — saved here as you
            work through it.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href={buyUrl}
              className="bg-aubergine text-ivory hover:bg-aubergine-deep inline-flex min-h-11 items-center rounded-full px-5 text-sm font-semibold"
            >
              Get {product.title} (US${product.priceUsd})
            </a>
            <ButtonLink href="/account" variant="secondary">
              I already bought it
            </ButtonLink>
          </div>
          <p className="text-mute mt-3 text-sm">
            Bought it on Gumroad? Sign in with the same email and it unlocks here. {REFUND_POLICY}
          </p>
        </Card>
      ) : !s1 ? (
        <Section label="What's ruling ideas out" title="Loosen one constraint">
          <p className="text-mute">
            Loosening one constraint (budget, block length, contact style or the 8-week need)
            usually opens several ideas. Take the quiz again with different answers and the report
            rebuilds.
          </p>
          <OutTable out={out} />
          <ButtonLink href="/studio/fit" variant="secondary">
            Change my answers
          </ButtonLink>
        </Section>
      ) : (
        <>
          <Section
            label="01 · Your top three"
            title={t.length === 1 ? "Your best fit." : "Side by side."}
          >
            <p className="text-mute">
              Out of {OPPORTUNITIES.length} researched ideas,{" "}
              {t.length === 3
                ? "these scored best for your answers."
                : `only ${t.length === 1 ? "one" : "two"} passed your limits.`}{" "}
              {out.length} were ruled out by something you told us; they're listed at the end.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead>
                  <tr className="text-mute">
                    <th className="py-2 font-medium">Idea</th>
                    <th className="py-2 text-right font-medium">Fit</th>
                    <th className="py-2 text-right font-medium">To start</th>
                    <th className="py-2 text-right font-medium">Hrs / wk</th>
                    <th className="py-2 text-right font-medium">First income</th>
                    <th className="py-2 pl-3 font-medium">Biggest catch</th>
                  </tr>
                </thead>
                <tbody>
                  {t.map((s, k) => (
                    <tr
                      key={s.o.id}
                      className={`border-line border-t align-top ${k === 0 ? "bg-blush-soft" : ""}`}
                    >
                      <td className="py-2">
                        <span className="font-semibold">
                          {k + 1}. {s.o.name}
                        </span>
                        <span className="text-mute block">{s.band}</span>
                      </td>
                      <td className="py-2 text-right">{s.total}/36</td>
                      <td className="py-2 text-right">
                        {s.sym}
                        {s.cap.toLocaleString("en")}
                      </td>
                      <td className="py-2 text-right">{s.o.minh}+</td>
                      <td className="py-2 text-right">
                        ~{s.o.weeks} wk{s.o.weeks > 1 ? "s" : ""}
                      </td>
                      <td className="py-2 pl-3">{s.o.poor.split(/;|\. /)[0]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-mute text-sm">
              To start, hours and first income are estimates <Badge tone="outline">EST</Badge> from
              our research, converted from AUD at October 2026 rates. Fit is out of 36: lifestyle,
              practical readiness and commercial evidence, 12 each.
            </p>
          </Section>

          <Section label="02 · Your #1" title={s1.o.name}>
            <p className="text-lg">{s1.o.do}</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-[#eef6f0] p-4">
                <h3 className="text-xl">Why it fits you</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {whyFits(s1, a).map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
              <div className="bg-ivory rounded-2xl p-4">
                <h3 className="text-xl">What could go wrong</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {risks(s1, a).map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
              <div className="bg-ivory rounded-2xl p-4">
                <h3 className="text-xl">Who pays</h3>
                <p className="mt-2">{s1.o.who}</p>
              </div>
              <div className="bg-ivory rounded-2xl p-4">
                <h3 className="text-xl">
                  Still unknown <Badge tone="warning">UNKNOWN</Badge>
                </h3>
                <p className="mt-2">{s1.o.verify} Your 14 days are designed to find out.</p>
              </div>
            </div>
          </Section>

          <Section label="03 · Your numbers" title="Does it add up?">
            <p className="text-mute">
              Put in your price and how long each {UNIT[s1.o.id] ?? "sale"} really takes. Your
              break-even, real hourly return and go/stop signal update as you type, and are saved to
              your account.
            </p>
            <Calculator
              resultId={result.id}
              progress={result.progress}
              scored={{ cap: s1.cap, o: { id: s1.o.id, verify: s1.o.verify } }}
              unit={UNIT[s1.o.id] ?? "sale"}
              sym={sym}
              weeklyHours={a.hours}
              floor={a.minrate}
            />
          </Section>

          <Section label="04 · The rules where you live" title="Check these first.">
            {R ? (
              <>
                <p className="text-mute">
                  From the {a.country} chapter of your Rules Guide, checked {R.checked}. Each item
                  links to the official page in the guide; the official page is the source of truth.
                </p>
                <ul className="list-disc space-y-2 pl-5">
                  {R.facts.map((f) => (
                    <li key={f.text}>
                      {f.text}{" "}
                      <Badge tone={f.label === "unknown" ? "warning" : "outline"}>
                        {f.label.toUpperCase()}
                      </Badge>
                    </li>
                  ))}
                  {s1.o.checks === "Yes" ? (
                    <li>
                      <b>This idea needs a check or registration before you start.</b> See its
                      Opportunity Card and the licences item in your chapter.
                    </li>
                  ) : null}
                </ul>
                {a.country === "United States" || a.country === "Canada" ? (
                  <p className="text-mute text-sm">
                    Your guide is a national overview.{" "}
                    {a.country === "United States"
                      ? "States, counties and cities"
                      : "Provinces and municipalities"}{" "}
                    set many of their own rules, so check yours too.
                  </p>
                ) : null}
              </>
            ) : (
              <p>
                Your Rules Guide covers Australia, the US, the UK, Canada and New Zealand. Your
                country isn't one of them, so before you take a payment, check how your tax office
                treats self-employed income, whether you need to register, and any licence your idea
                needs.
              </p>
            )}
            <p className="text-mute text-sm">{DISCLAIMER}</p>
          </Section>

          <Section label="05 · Your 14 days" title="Your test, dated.">
            <PlanTracker
              resultId={result.id}
              progress={result.progress}
              days={plan(s1, a)}
              short={a.block <= 1}
            />
            <p className="text-mute text-sm">
              Days 1 to 3 (map your week, run the Fit Finder, choose) are covered by this report.
              The full day-by-day pages, with notes boxes and the AI workflows, are in your 14-Day
              Test Plan.
            </p>
          </Section>

          <Section label="06 · Day 14" title="Go, adjust or stop.">
            <p className="text-mute">
              Decide on evidence that people will buy, not on whether you enjoyed it. Your lines,
              set now so day-14 you can't move them:
            </p>
            {(() => {
              const g = gates(s1, a);
              return (
                <>
                  <div className="grid gap-3 md:grid-cols-3">
                    {(
                      [
                        ["Go: next test", g.go, "bg-[#eef6f0]"],
                        ["Adjust: change one thing", g.adjust, "bg-[#fbf3e2]"],
                        ["Stop: and that's a result", g.stop, "bg-ivory"],
                      ] as const
                    ).map(([title, items, bg]) => (
                      <div key={title} className={`rounded-2xl p-4 ${bg}`}>
                        <h3 className="text-lg">{title}</h3>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                          {items.map((x) => (
                            <li key={x}>{x}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                  <p className="text-mute text-sm">
                    {g.note} The full scorecard is in your Go / No-Go Scorecard.
                  </p>
                </>
              );
            })()}
          </Section>

          {t.length > 1 ? (
            <Section label="07 · Your back-ups" title="If your first pick is a no.">
              <div className="grid gap-3 md:grid-cols-2">
                {t.slice(1).map((s, k) => (
                  <div key={s.o.id} className="bg-ivory rounded-2xl p-4">
                    <h3 className="text-lg">
                      {k + 2}. {s.o.name}
                    </h3>
                    <p className="mt-2 text-sm">
                      {whyFits(s, a)
                        .filter(
                          (x) => !/^It (needs about|works in|doesn't rely|can be done)/.test(x),
                        )
                        .slice(0, 2)
                        .join(" ")}{" "}
                      Start-up about {s.sym}
                      {s.cap.toLocaleString("en")} <Badge tone="outline">EST</Badge>, first income
                      around {s.o.weeks} week{s.o.weeks > 1 ? "s" : ""}{" "}
                      <Badge tone="outline">EST</Badge>.
                    </p>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {out.length > 0 ? (
            <Section label="08 · Ruled out" title="What your answers ruled out.">
              <OutTable out={out} />
            </Section>
          ) : null}

          <Card className="bg-blush-soft">
            <h2 className="text-2xl">Ready to build it?</h2>
            <p className="mt-2">
              If your idea sells products, Empire Studio turns it into a Shopify launch: brand,
              store, listings, photos and launch marketing.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <ButtonLink href="/studio">Open Empire Studio</ButtonLink>
              <Link
                href="/studio/fit"
                className="text-aubergine inline-flex min-h-11 items-center px-2 text-sm font-semibold underline"
              >
                Retake the quiz
              </Link>
            </div>
          </Card>
        </>
      )}
    </main>
  );
}

function OutTable({ out }: { out: ReturnType<typeof scoreAll> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[30rem] text-left text-sm">
        <thead>
          <tr className="text-mute">
            <th className="py-2 font-medium">Idea</th>
            <th className="py-2 font-medium">Why it's out for you</th>
          </tr>
        </thead>
        <tbody>
          {out.map((x) => (
            <tr key={x.o.id} className="border-line border-t align-top">
              <td className="py-2 pr-3 font-semibold">{x.o.name}</td>
              <td className="py-2">{x.why.join("; ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
