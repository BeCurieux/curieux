// Minimal admin panel (brief §25). Read-mostly; retries for failed jobs.
// Admin actions can never bypass parent approval — there is no approval
// override here by design.
import Link from "next/link";
import { redirect } from "next/navigation";
import { adminClient, currentUser } from "@/lib/supabase/server";
import { adminRetryJob } from "@/app/actions";
import { healthOf, needsSomebody } from "@/lib/admin/health";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const db = adminClient();
  const { data: profile } = await db.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) redirect("/home");

  const [
    { count: users }, { count: children }, { count: books },
    { data: failedJobs }, { data: orders },
    { count: queued }, { count: running }, { count: failed }, { count: dead },
    { data: lastFinished }, { data: oldestWaiting },
  ] = await Promise.all([
      db.from("profiles").select("id", { count: "exact", head: true }),
      db.from("subjects").select("id", { count: "exact", head: true }),
      db.from("books").select("id", { count: "exact", head: true }),
      db.from("jobs").select("*").in("status", ["failed", "dead"]).order("updated_at", { ascending: false }).limit(20),
      db.from("print_orders").select("*").order("created_at", { ascending: false }).limit(20),
      // The queue, as six numbers. A dead runner is the one failure in this
      // product that announces itself nowhere else — see lib/admin/health.ts.
      db.from("jobs").select("id", { count: "exact", head: true }).eq("status", "queued"),
      db.from("jobs").select("id", { count: "exact", head: true }).eq("status", "running"),
      db.from("jobs").select("id", { count: "exact", head: true }).eq("status", "failed"),
      db.from("jobs").select("id", { count: "exact", head: true }).eq("status", "dead"),
      db.from("jobs").select("updated_at").eq("status", "done")
        .order("updated_at", { ascending: false }).limit(1),
      db.from("jobs").select("created_at").in("status", ["queued", "running"])
        .order("created_at", { ascending: true }).limit(1),
    ]);

  const health = healthOf(
    {
      queued: queued ?? 0,
      running: running ?? 0,
      failed: failed ?? 0,
      dead: dead ?? 0,
      lastFinishedAt: (lastFinished ?? [])[0]?.updated_at ?? null,
      oldestWaitingAt: (oldestWaiting ?? [])[0]?.created_at ?? null,
    },
    new Date().toISOString()
  );

  return (
    <div className="py-10">
      <h1 className="text-3xl">Admin</h1>

      {/* First, and loud when it needs to be. Every other failure in this
          product announces itself somewhere; a stopped job runner is silent —
          uploads still work, the archive still opens, and nothing has been
          processed since Tuesday. */}
      <div
        className={`mt-6 rounded-2xl p-5 ${
          needsSomebody(health) ? "border border-clay bg-card" : "bg-card/60"
        }`}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="font-display text-lg">
            {{
              fine: "The queue is keeping up.",
              slow: "The queue is behind.",
              stopped: "Nothing is being processed.",
              stuck: "Some jobs have given up.",
            }[health.verdict]}
          </p>
          <p className="text-xs text-stone">
            {queued ?? 0} queued · {running ?? 0} running · {failed ?? 0} failed · {dead ?? 0} dead
          </p>
        </div>
        {health.because && (
          <p className="mt-2 max-w-[56ch] text-sm leading-relaxed">{health.because}</p>
        )}
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4 text-center">
        {[
          ["Users", users],
          ["Children", children],
          ["Books", books],
        ].map(([label, count]) => (
          <div key={String(label)} className="card">
            <div className="font-display text-3xl">{count ?? 0}</div>
            <div className="text-xs uppercase tracking-wider text-stone">{label}</div>
          </div>
        ))}
      </div>

      {/* The one place in the admin panel that can reach family content, and
          only where a family has said so. Linked from here rather than
          discovered, so that opening it is a deliberate act. */}
      <p className="mt-8 text-sm">
        <Link href="/admin/accounts" className="text-ochre">Find an account</Link>
        {" \u00b7 "}
        <Link href="/admin/funnel" className="text-ochre">Is it working</Link>
        {" \u00b7 "}
        <Link href="/admin/spend" className="text-ochre">What the model costs</Link>
        {" \u00b7 "}
        <Link href="/admin/support" className="text-ochre">
          Families who have asked us to look
        </Link>
      </p>

      <section className="mt-10">
        <h2 className="text-xl">Failed jobs</h2>
        <div className="mt-4 space-y-2">
          {(failedJobs ?? []).map((job) => (
            <div key={job.id} className="card !p-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <span className="font-mono text-xs">{job.type}</span>
                  <span className="ml-2 rounded bg-red-50 px-2 py-0.5 text-xs text-red-700">{job.status}</span>
                  <span className="ml-2 text-xs text-stone">attempts: {job.attempts}</span>
                  {job.last_error && <p className="mt-1 text-xs text-stone">{job.last_error}</p>}
                </div>
                <form action={adminRetryJob}>
                  <input type="hidden" name="job_id" value={job.id} />
                  <button className="btn-secondary !px-4 !py-1.5 text-xs">Retry</button>
                </form>
              </div>
            </div>
          ))}
          {(!failedJobs || failedJobs.length === 0) && <p className="text-sm text-stone">None.</p>}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl">Print orders</h2>
        <div className="mt-4 space-y-2">
          {(orders ?? []).map((order) => (
            <div key={order.id} className="card !p-4 text-sm">
              <span className="font-mono text-xs">{order.id.slice(0, 8)}</span>
              <span className="ml-2">{order.provider}</span>
              <span className="ml-2 rounded bg-rule px-2 py-0.5 text-xs">{order.status}</span>
              {order.tracking_number && <span className="ml-2 text-xs">{order.tracking_number}</span>}
            </div>
          ))}
          {(!orders || orders.length === 0) && <p className="text-sm text-stone">None.</p>}
        </div>
      </section>
    </div>
  );
}
