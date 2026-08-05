// Order status (brief §20): white-label — no provider branding shown.
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, userClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const STEPS = ["submitted", "in_production", "shipped", "delivered"] as const;
const LABELS: Record<string, string> = {
  draft: "Preparing",
  submitted: "Order received",
  in_production: "Being printed",
  shipped: "On its way",
  delivered: "Delivered",
  cancelled: "Cancelled",
  failed: "Something went wrong",
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

      <ol className="mt-10 space-y-4">
        {STEPS.map((step, i) => (
          <li key={step} className="flex items-center gap-3">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs ${
                i <= activeIndex ? "bg-ink text-paper" : "border border-rule text-stone"
              }`}
            >
              {i + 1}
            </span>
            <span className={i <= activeIndex ? "" : "text-stone"}>{LABELS[step]}</span>
          </li>
        ))}
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
