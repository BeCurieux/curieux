import { Megaphone, MessageCircle, PartyPopper, Info } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/demo/empty-state";
import { familyContext } from "@/lib/demo/context";
import { MESSAGES, type Message } from "@/lib/demo/data";

export const metadata: Metadata = { title: "Messages" };

const TONE: Record<Message["tone"], { icon: typeof Info; bg: string }> = {
  celebrate: { icon: PartyPopper, bg: "bg-butter" },
  news: { icon: Megaphone, bg: "bg-lilac" },
  info: { icon: Info, bg: "bg-mint" },
};

export default async function MessagesPage() {
  const { demo } = await familyContext();

  return (
    <div className="rise flex flex-col gap-6">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Messages</h1>
      {!demo ? (
        <EmptyState icon={<MessageCircle />} title="No messages yet">
          Updates from your activity providers will land here.
        </EmptyState>
      ) : (
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
      )}
    </div>
  );
}
