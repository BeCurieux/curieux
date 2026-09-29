import { CalendarX2, Info, Megaphone, MessageCircle, PartyPopper, Trophy } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/demo/empty-state";
import { MarkRead } from "@/components/family/mark-read";
import { familyContext } from "@/lib/demo/context";
import { MESSAGES, type Message } from "@/lib/demo/data";
import { myNotifications } from "@/lib/domain/notifications";
import { formatDateTime, lessonMoment } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Messages" };

const TONE: Record<Message["tone"], { icon: typeof Info; bg: string }> = {
  celebrate: { icon: PartyPopper, bg: "bg-butter" },
  news: { icon: Megaphone, bg: "bg-lilac" },
  info: { icon: Info, bg: "bg-mint" },
};

export default async function MessagesPage() {
  const { demo, db } = await familyContext();
  const notifications = await myNotifications(db);
  const unread = notifications.some((n) => n.unread);

  return (
    <div className="rise flex flex-col gap-6">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Messages</h1>
      {unread ? <MarkRead /> : null}

      {notifications.length > 0 ? (
        <section aria-labelledby="progress" className="flex flex-col gap-3">
          <h2 id="progress" className="text-sm font-bold tracking-wide text-muted uppercase">
            Updates
          </h2>
          {notifications.map((n) => (
            <article
              key={n.id}
              className={cn(
                "flex gap-4 rounded-lg bg-surface p-4 shadow-[0_1px_0_var(--border)]",
                n.unread && "ring-2 ring-coral/60",
              )}
            >
              <span
                className={cn(
                  "grid size-11 shrink-0 place-items-center rounded-full [&_svg]:size-5",
                  n.kind === "lesson_cancelled" ? "bg-[#fde3dd]" : "bg-butter",
                )}
              >
                {n.kind === "lesson_cancelled" ? (
                  <CalendarX2 aria-hidden />
                ) : (
                  <Trophy aria-hidden />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-muted">{n.organisation}</p>
                  <p className="shrink-0 text-sm text-muted">
                    {n.unread ? (
                      <span className="mr-2 rounded-full bg-coral px-2 py-0.5 text-xs font-bold text-ink">
                        New
                      </span>
                    ) : null}
                    {formatDateTime(n.createdAt)}
                  </p>
                </div>
                {n.kind === "lesson_cancelled" ? (
                  <>
                    <h3 className="font-semibold">
                      {n.childFirstName}&apos;s{" "}
                      {n.lessonStartsAt
                        ? `${lessonMoment(n.lessonStartsAt, n.lessonTimezone ?? "Australia/Sydney").day} ${lessonMoment(n.lessonStartsAt, n.lessonTimezone ?? "Australia/Sydney").date}`
                        : ""}{" "}
                      lesson is cancelled
                    </h3>
                    <p className="text-muted">
                      {n.childFirstName} has a make-up credit to book another class.
                    </p>
                  </>
                ) : (
                  <>
                    <h3 className="font-semibold">
                      {n.childFirstName} achieved {n.skill}
                    </h3>
                    <p className="text-muted">
                      It&apos;s on {n.childFirstName}&apos;s progress page now.
                    </p>
                  </>
                )}
              </div>
            </article>
          ))}
        </section>
      ) : null}

      {demo ? (
        MESSAGES.map((group) => (
          <section
            key={group.group}
            aria-labelledby={`g-${group.group}`}
            className="flex flex-col gap-3"
          >
            <h2
              id={`g-${group.group}`}
              className="text-sm font-bold tracking-wide text-muted uppercase"
            >
              {group.group}
            </h2>
            {group.messages.map((m) => {
              const { icon: Icon, bg } = TONE[m.tone];
              return (
                <article
                  key={m.id}
                  className="flex gap-4 rounded-lg bg-surface p-4 shadow-[0_1px_0_var(--border)]"
                >
                  <span
                    className={`grid size-11 shrink-0 place-items-center rounded-full ${bg} [&_svg]:size-5`}
                  >
                    <Icon aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-muted">{m.from}</p>
                      <p className="shrink-0 text-sm text-muted">{m.when}</p>
                    </div>
                    <h3 className="font-semibold">{m.title}</h3>
                    <p className="text-muted">{m.body}</p>
                  </div>
                </article>
              );
            })}
          </section>
        ))
      ) : notifications.length === 0 ? (
        <EmptyState icon={<MessageCircle />} title="No messages yet">
          Updates from your activity providers, like a new skill achieved, will land here.
        </EmptyState>
      ) : null}
    </div>
  );
}
