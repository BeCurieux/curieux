// Minimal admin panel (brief §25). Read-mostly; retries for failed jobs.
// Admin actions can never bypass parent approval — there is no approval
// override here by design.
import { redirect } from "next/navigation";
import { adminClient, currentUser } from "@/lib/supabase/server";
import { adminRetryJob } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const db = adminClient();
  const { data: profile } = await db.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) redirect("/home");

  const [{ count: users }, { count: children }, { count: books }, { data: failedJobs }, { data: orders }] =
    await Promise.all([
      db.from("profiles").select("id", { count: "exact", head: true }),
      db.from("subjects").select("id", { count: "exact", head: true }),
      db.from("books").select("id", { count: "exact", head: true }),
      db.from("jobs").select("*").in("status", ["failed", "dead"]).order("updated_at", { ascending: false }).limit(20),
      db.from("print_orders").select("*").order("created_at", { ascending: false }).limit(20),
    ]);

  return (
    <div className="py-10">
      <h1 className="text-3xl">Admin</h1>
      <div className="mt-6 grid grid-cols-3 gap-4 text-center">
        {[
          ["Users", users],
          ["Children", children],
          ["Books", books],
        ].map(([label, count]) => (
          <div key={String(label)} className="card">
            <div className="font-display text-3xl">{count ?? 0}</div>
            <div className="text-xs uppercase tracking-wider text-ink/50">{label}</div>
          </div>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="text-xl">Failed jobs</h2>
        <div className="mt-4 space-y-2">
          {(failedJobs ?? []).map((job) => (
            <div key={job.id} className="card !p-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <span className="font-mono text-xs">{job.type}</span>
                  <span className="ml-2 rounded bg-red-50 px-2 py-0.5 text-xs text-red-700">{job.status}</span>
                  <span className="ml-2 text-xs text-ink/40">attempts: {job.attempts}</span>
                  {job.last_error && <p className="mt-1 text-xs text-ink/60">{job.last_error}</p>}
                </div>
                <form action={adminRetryJob}>
                  <input type="hidden" name="job_id" value={job.id} />
                  <button className="btn-secondary !px-4 !py-1.5 text-xs">Retry</button>
                </form>
              </div>
            </div>
          ))}
          {(!failedJobs || failedJobs.length === 0) && <p className="text-sm text-ink/50">None.</p>}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl">Print orders</h2>
        <div className="mt-4 space-y-2">
          {(orders ?? []).map((order) => (
            <div key={order.id} className="card !p-4 text-sm">
              <span className="font-mono text-xs">{order.id.slice(0, 8)}</span>
              <span className="ml-2">{order.provider}</span>
              <span className="ml-2 rounded bg-sand px-2 py-0.5 text-xs">{order.status}</span>
              {order.tracking_number && <span className="ml-2 text-xs">{order.tracking_number}</span>}
            </div>
          ))}
          {(!orders || orders.length === 0) && <p className="text-sm text-ink/50">None.</p>}
        </div>
      </section>
    </div>
  );
}
