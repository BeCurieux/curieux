import { Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  AddEnquiryButton,
  OfferButton,
  PlaceButton,
  RemoveEnquiryButton,
  WithdrawOfferButton,
} from "@/components/business/wish-buttons";
import { SettingSwitch } from "@/components/forms/setting-switch";
import { Button } from "@/components/ui/button";
import { requireOwner } from "@/lib/business/owner";
import { autoPlaceOffersOn, openPlaceOffers } from "@/lib/domain/place-offers";
import { schoolEnquiries, waitlistPageSetting } from "@/lib/domain/waitlist-page";
import { appUrl } from "@/lib/email/transport";
import { classOpportunities, openWishes, wishMatches } from "@/lib/domain/wishes";
import { dayName, formatDateTime, formatTime } from "@/lib/format";
import { setAutoOffers, setWaitlistPageOn } from "@/lib/wishes/actions";

export const metadata: Metadata = { title: "What families want" };

// What families have asked for, new classes worth running, and places that
// match now (docs/M8_NETWORK.md, M8b).
export default async function DemandPage({
  searchParams,
}: {
  searchParams: Promise<{ placed?: string }>;
}) {
  const { db, organisationId } = await requireOwner();
  const placed = (await searchParams).placed?.slice(0, 40);
  const [opportunities, matches, wishes, offers, auto, page, enquiries] = await Promise.all([
    classOpportunities(db, organisationId),
    wishMatches(db, organisationId),
    openWishes(db, organisationId),
    openPlaceOffers(db, organisationId),
    autoPlaceOffersOn(db, organisationId),
    waitlistPageSetting(db, organisationId),
    schoolEnquiries(db, organisationId),
  ]);
  const pageUrl = appUrl(`/waiting-list/${page.slug}`);
  const byId = new Map(wishes.map((w) => [w.id, w]));

  return (
    <div className="rise flex max-w-3xl flex-col gap-8">
      <div>
        <h1 className="font-display text-4xl font-semibold tracking-tight">What families want</h1>
        <p className="mt-1 text-muted">
          Times families have asked for, from each child&apos;s page in the parent app. Only your
          school sees them.
        </p>
      </div>

      {placed !== undefined ? (
        <p role="status" className="rounded-md bg-[#dcf1e7] px-4 py-3 font-semibold text-[#1d5a41]">
          {placed || "The child"} is enrolled. Their family has been emailed.
        </p>
      ) : null}

      <SettingSwitch on={auto} title="Offer free places automatically" save={setAutoOffers}>
        When a place comes up at a time a family asked for, Ovyko offers it to the family who&apos;s
        waited longest and holds it for them for 48 hours. If they say no, or don&apos;t answer, it
        goes to the next family.
      </SettingSwitch>

      <SettingSwitch
        on={page.on}
        title="Waiting-list page for new families"
        save={setWaitlistPageOn}
      >
        A page for your website where new families leave their child&apos;s details and the times
        that suit. Only you see what they send. {page.on ? `Your page: ${pageUrl}` : null}
      </SettingSwitch>

      {enquiries.length ? (
        <section aria-labelledby="enquiries" className="flex flex-col gap-3">
          <h2 id="enquiries" className="font-display text-2xl font-semibold">
            New families
          </h2>
          <p className="text-muted">
            From your waiting-list page, oldest first. Adding one invites the parent to Ovyko, and
            once they join, places can be offered to them.
          </p>
          <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
            {enquiries.map((e) => (
              <li key={e.id} className="flex flex-col gap-3 px-5 py-4">
                <span>
                  <span className="block font-semibold">
                    {e.childFirstName} {e.childLastName} · born {e.dateOfBirth}
                  </span>
                  <span className="block text-sm text-muted">
                    {e.weekdays.map((d) => dayName(d).slice(0, 3)).join(", ")},{" "}
                    {formatTime(e.earliest)}
                    {e.latest !== e.earliest ? ` to ${formatTime(e.latest)}` : ""} ·{" "}
                    {e.levelName ?? "level not sure"}
                    {e.locationName ? ` · ${e.locationName}` : ""}
                    {e.note ? ` · “${e.note}”` : ""}
                  </span>
                  <span className="block text-sm text-muted">
                    {e.parentName} · {e.email}
                    {e.phone ? ` · ${e.phone}` : ""} · sent {formatDateTime(e.createdAt)}
                  </span>
                </span>
                <span className="flex flex-wrap gap-2">
                  <AddEnquiryButton enquiryId={e.id} />
                  <RemoveEnquiryButton enquiryId={e.id} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {offers.length ? (
        <section aria-labelledby="offers" className="flex flex-col gap-3">
          <h2 id="offers" className="font-display text-2xl font-semibold">
            Waiting for an answer
          </h2>
          <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
            {offers.map((o) => (
              <li
                key={o.id}
                className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <span>
                  <span className="block font-semibold">
                    {o.childName} ({o.familyName})
                  </span>
                  <span className="block text-sm text-muted">
                    {o.className} · {dayName(o.weekday)} {formatTime(o.startTime)} · held until{" "}
                    {formatDateTime(o.expiresAt)}
                    {o.automatic ? " · offered by Ovyko" : ""}
                  </span>
                </span>
                <WithdrawOfferButton offerId={o.id} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="opportunities" className="flex flex-col gap-3">
        <h2 id="opportunities" className="font-display text-2xl font-semibold">
          New class opportunities
        </h2>
        {opportunities.length === 0 ? (
          <p className="text-muted">
            None yet. When 3 or more children want the same level and time, and no class has room,
            it shows here.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {opportunities.map((o) => {
              const when = `${dayName(o.weekday)} ${formatTime(o.startTime)}`;
              const params = new URLSearchParams({
                level: o.levelId,
                location: o.locationId,
                weekday: String(o.weekday),
                time: o.startTime,
                name: `${o.levelName} ${dayName(o.weekday).slice(0, 3)}`,
              });
              return (
                <li
                  key={`${o.levelId}-${o.locationId}-${o.weekday}`}
                  className="flex flex-col gap-3 rounded-lg bg-ink p-6 text-white sm:flex-row sm:items-center"
                >
                  <div className="flex-1">
                    <p className="inline-flex items-center gap-2 font-semibold text-butter">
                      <Sparkles aria-hidden className="size-4" />
                      {when} · {o.levelName} · {o.locationName}
                    </p>
                    <p className="font-display text-2xl font-semibold">
                      {o.children} children would come
                    </p>
                  </div>
                  <Button asChild variant="warm" className="w-fit">
                    <Link href={`/business/classes/new?${params.toString()}`}>
                      Create this class
                    </Link>
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="matches" className="flex flex-col gap-3">
        <h2 id="matches" className="font-display text-2xl font-semibold">
          Places that match now
        </h2>
        {matches.length === 0 ? (
          <p className="text-muted">No class with room matches a request right now.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
            {matches.map((m) => {
              const w = byId.get(m.wishId);
              return (
                <li
                  key={`${m.wishId}-${m.classId}`}
                  className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span>
                    <span className="block font-semibold">
                      {w?.childName ?? "A child"} ({w?.familyName})
                    </span>
                    <span className="block text-sm text-muted">
                      {m.className} · {dayName(m.weekday)} {formatTime(m.startTime)} ·{" "}
                      {m.locationName} · {m.spare} {m.spare === 1 ? "place" : "places"} free
                    </span>
                  </span>
                  <span className="flex flex-wrap gap-2">
                    <OfferButton wishId={m.wishId} classId={m.classId} />
                    <PlaceButton
                      wishId={m.wishId}
                      classId={m.classId}
                      label={`Enrol ${w?.childName ?? "child"}`}
                    />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="requests" className="flex flex-col gap-3">
        <h2 id="requests" className="font-display text-2xl font-semibold">
          Every open request
        </h2>
        {wishes.length === 0 ? (
          <p className="text-muted">No requests yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
            {wishes.map((w) => (
              <li key={w.id} className="flex flex-col gap-1 px-5 py-3">
                <span className="font-semibold">
                  {w.childName} ({w.familyName})
                </span>
                <span className="text-sm text-muted">
                  {w.weekdays.map((d) => dayName(d).slice(0, 3)).join(", ")},{" "}
                  {formatTime(w.earliest)}
                  {w.latest !== w.earliest ? ` to ${formatTime(w.latest)}` : ""} ·{" "}
                  {w.levelName ?? "any level"}
                  {w.locationName ? ` · ${w.locationName}` : ""}
                  {w.note ? ` · “${w.note}”` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
