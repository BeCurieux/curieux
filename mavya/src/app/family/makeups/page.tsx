import { CalendarCheck2, Check, Sparkles, Star } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BackLink } from "@/components/demo/back-link";
import { EmptyState } from "@/components/demo/empty-state";
import { Button } from "@/components/ui/button";
import { bookMakeup } from "@/lib/demo/actions";
import { familyContext } from "@/lib/demo/context";
import { ORGANISATION } from "@/lib/demo/data";
import { findChild, makeupOptions, type MakeupOption } from "@/lib/demo/service";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Make-ups" };

export default async function MakeupsPage({
  searchParams,
}: {
  searchParams: Promise<{ pick?: string }>;
}) {
  const { state, demo } = await familyContext();
  const ava = demo ? findChild("ava", state)! : null;

  if (!demo || !ava!.away) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink href="/family">Home</BackLink>
        <EmptyState icon={<Sparkles />} title="No make-up credits right now">
          When you let your provider know you can&apos;t make a class, your make-up options will
          show up here.
        </EmptyState>
      </div>
    );
  }

  if (ava!.makeup) return <Booked option={ava!.makeup} />;

  const options = makeupOptions(state);
  const { pick } = await searchParams;
  const selected =
    options.find((o) => o.id === pick) ?? options.find((o) => o.bestFit) ?? options[0]!;
  const [best, ...others] = [...options].sort((a, b) => Number(b.bestFit) - Number(a.bestFit));

  return (
    <div className="rise flex flex-col gap-6">
      <BackLink href="/family">Home</BackLink>
      <div>
        <p className="font-semibold text-muted">Ava&apos;s make-up credit</p>
        <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight">
          We found {options.length} classes that fit
        </h1>
      </div>

      <section aria-labelledby="best-fit" className="flex flex-col gap-3">
        <h2 id="best-fit" className="inline-flex items-center gap-2 font-semibold">
          <Star aria-hidden className="size-5 fill-butter text-[#b48a1a]" />
          Best fit
        </h2>
        <OptionCard option={best!} selected={selected.id === best!.id} big />
      </section>

      {others.length > 0 ? (
        <section aria-labelledby="more" className="flex flex-col gap-3">
          <h2 id="more" className="font-semibold">
            Also available
          </h2>
          {others.map((o) => (
            <OptionCard key={o.id} option={o} selected={selected.id === o.id} />
          ))}
        </section>
      ) : null}

      <form
        action={bookMakeup.bind(null, selected.id)}
        className="sticky bottom-20 z-10 flex flex-col gap-3 rounded-lg bg-ink p-4 text-white shadow-2xl"
      >
        <p className="text-center">
          <span className="text-white/70">Ava · </span>
          <span className="font-semibold">
            {selected.day} {selected.time}
          </span>
        </p>
        <Button type="submit" variant="warm" size="lg">
          Confirm booking
        </Button>
      </form>
    </div>
  );
}

function OptionCard({
  option,
  selected,
  big = false,
}: {
  option: MakeupOption;
  selected: boolean;
  big?: boolean;
}) {
  return (
    <Link
      href={`/family/makeups?pick=${option.id}`}
      scroll={false}
      replace
      aria-current={selected ? "true" : undefined}
      aria-label={`${option.day} ${option.time}, ${option.level}, ${option.spots} ${option.spots === 1 ? "spot" : "spots"} left${selected ? ", selected" : ""}`}
      className={cn(
        "flex items-center gap-4 rounded-lg border-2 bg-surface p-4 transition",
        selected
          ? "border-ink"
          : "border-transparent shadow-[0_1px_0_var(--border)] hover:border-line",
        big && "p-5",
      )}
    >
      <div
        className={cn(
          "grid shrink-0 place-items-center rounded-md bg-surface-soft text-center font-display font-semibold",
          big ? "size-16 text-lg" : "size-14",
        )}
      >
        {option.shortDay}
      </div>
      <div className="flex-1">
        <p className={cn("font-semibold", big ? "text-xl" : "text-lg")}>
          {option.day} {option.time}
        </p>
        <p className="text-muted">
          {option.level} · {option.instructor}
        </p>
        <p className="mt-1 text-sm font-semibold text-success">
          {option.spots} {option.spots === 1 ? "spot" : "spots"} left
        </p>
      </div>
      <span
        aria-hidden
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-full border-2",
          selected ? "border-ink bg-ink text-white" : "border-line",
        )}
      >
        {selected ? <Check className="size-4" strokeWidth={3} /> : null}
      </span>
    </Link>
  );
}

function Booked({
  option,
}: {
  option: { day: string; time: string; level: string; instructor: string };
}) {
  return (
    <div className="flex flex-col items-center gap-6 pt-6 text-center">
      <div className="animate-pop grid size-24 place-items-center rounded-full bg-success text-white shadow-[0_12px_30px_-10px_var(--success)]">
        <Check aria-hidden className="size-12" strokeWidth={3} />
      </div>
      <div role="status">
        <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight">
          You&apos;re booked in!
        </h1>
        <p className="mt-2 text-lg text-muted">Ava&apos;s make-up is locked in.</p>
      </div>
      <div className="flex w-full items-center gap-4 rounded-lg bg-surface p-5 text-left shadow-[0_1px_0_var(--border)]">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#dcf1e7] text-[#23694c] [&_svg]:size-6">
          <CalendarCheck2 aria-hidden />
        </span>
        <div>
          <p className="text-lg font-semibold">
            {option.day} {option.time}
          </p>
          <p className="text-muted">
            {option.level} · {option.instructor} · {ORGANISATION.name}
          </p>
        </div>
      </div>
      <p className="text-muted">Ava&apos;s Wednesday spot is now free for another family.</p>
      <div className="flex w-full flex-col gap-3">
        <Button asChild size="lg">
          <Link href="/family/kids/ava">See Ava&apos;s progress</Link>
        </Button>
        <Button asChild variant="soft" size="lg">
          <Link href="/family">Back home</Link>
        </Button>
      </div>
    </div>
  );
}
