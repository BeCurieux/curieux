// Order status (brief §20): white-label — no provider branding shown.
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, userClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const STEPS = ["submitted", "in_production", "shipped", "delivered"] as const;

/** The headline at the top of the page — what's true right now. */
const LABELS: Record<string, string> = {
  draft: "Nearly there",
  submitted: "We have it",
  in_production: "It’s being printed",
  shipped: "It’s on its way",
  delivered: "It’s with you",
  cancelled: "Cancelled",
  failed: "Something went wrong",
};

/** Each step, with a line saying what is actually happening to the book. */
const STEP_COPY: Record<string, { label: string; detail: string }> = {
  submitted: {
    label: "We have it",
    detail: "Your book is in the queue exactly as you approved it.",
  },
  in_production: {
    label: "On the press",
    detail: "Printed on uncoated Mohawk, then left to dry before binding.",
  },
  shipped: {
    label: "On its way",
    detail: "Bound, wrapped and posted.",
  },
  delivered: {
    label: "With you",
    detail: "That year is now on a shelf instead of a phone.",
  },
};

export default async function OrderPage({ params }: { params: { orderId: string } }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const db = userClient();
  const { data: order } = await db
    .from("print_orders")
    .select("*, books(id, title)")
    .eq("id", params.orderId)
    .single();
  if (!order) redirect("/home");
  const book = order.books as any;
  const activeIndex = STEPS.indexOf(order.status as (typeof STEPS)[number]);

  return (
    <div className="mx-auto max-w-lg py-16">
      <Link href={`/books/${book.id}`} className="text-sm text-boot">&larr; {book.title}</Link>
      <h1 className="mt-2 text-3xl">{LABELS[order.status] ?? order.status}</h1>

      {/* A numbered 1-2-3-4 is a parcel tracker. This is a book about someone's
          child arriving, so each step says what is happening to it. */}
      <ol className="mt-10 space-y-6">
        {STEPS.map((step, i) => {
          const done = i <= activeIndex;
          const current = i === activeIndex;
          return (
            <li key={step} className="flex gap-4">
              <span
                aria-hidden
                className={`mt-1.5 h-2.5 w-2.5 flex-none rounded-full ${
                  current ? "bg-boot ring-4 ring-boot/20" : done ? "bg-ink" : "border border-rule"
                }`}
              />
              <div>
                <div className={done ? "" : "text-stone"}>{STEP_COPY[step].label}</div>
                {done && (
                  <p className="mt-0.5 max-w-[42ch] text-sm leading-relaxed text-stone">
                    {STEP_COPY[step].detail}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {order.tracking_number && (
        <div className="card mt-10 text-sm">
          Tracking: <span className="font-mono">{order.tracking_number}</span>
          {order.tracking_url && (
            <>
              {" · "}
              <a className="text-boot underline" href={order.tracking_url} target="_blank" rel="noreferrer">
                Track delivery
              </a>
            </>
          )}
        </div>
      )}
    </div>
  );
}
