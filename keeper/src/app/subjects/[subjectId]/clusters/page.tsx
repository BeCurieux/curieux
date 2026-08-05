// Cluster review (brief §9): Keep / Rename / Merge / Remove.
import { redirect } from "next/navigation";
import { currentUser, userClient } from "@/lib/supabase/server";
import { updateCluster } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function ClustersPage({ params }: { params: { subjectId: string } }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const db = userClient();

  const { data: clusters } = await db
    .from("memory_clusters")
    .select("*, cluster_memories(memory_id)")
    .eq("subject_id", params.subjectId)
    .neq("status", "rejected")
    .order("created_at");

  const others = (clusters ?? []).filter((c) => c.status !== "rejected");

  return (
    <div className="py-10">
      <h1 className="text-3xl">The stories of their year</h1>
      <p className="mt-2 text-sm text-ink/60">
        We&rsquo;ve grouped related memories. Keep the ones that feel true, rename or merge the rest.
      </p>

      <div className="mt-8 space-y-4">
        {(clusters ?? []).map((cluster) => (
          <div key={cluster.id} className="card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="font-display text-xl">{cluster.title}</span>
                <span className="ml-3 text-sm text-ink/50">
                  {(cluster.cluster_memories ?? []).length} memories
                  {cluster.start_date && ` · ${cluster.start_date} → ${cluster.end_date ?? ""}`}
                </span>
                {cluster.status === "confirmed" && (
                  <span className="ml-3 rounded-full bg-sage/10 px-2 py-0.5 text-xs text-sage">kept</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {cluster.status === "suggested" && (
                  <form action={updateCluster}>
                    <input type="hidden" name="cluster_id" value={cluster.id} />
                    <input type="hidden" name="subject_id" value={params.subjectId} />
                    <input type="hidden" name="action" value="keep" />
                    <button className="btn !px-4 !py-1.5 text-xs">Keep</button>
                  </form>
                )}
                <form action={updateCluster} className="flex items-center gap-2">
                  <input type="hidden" name="cluster_id" value={cluster.id} />
                  <input type="hidden" name="subject_id" value={params.subjectId} />
                  <input type="hidden" name="action" value="rename" />
                  <input className="input !w-40 !py-1.5 text-xs" name="title" placeholder="Rename…" />
                  <button className="btn-secondary !px-4 !py-1.5 text-xs">Rename</button>
                </form>
                {others.length > 1 && (
                  <form action={updateCluster} className="flex items-center gap-2">
                    <input type="hidden" name="cluster_id" value={cluster.id} />
                    <input type="hidden" name="subject_id" value={params.subjectId} />
                    <input type="hidden" name="action" value="merge" />
                    <select className="input !w-40 !py-1.5 text-xs" name="into_cluster_id">
                      {others
                        .filter((o) => o.id !== cluster.id)
                        .map((o) => (
                          <option key={o.id} value={o.id}>Merge into: {o.title}</option>
                        ))}
                    </select>
                    <button className="btn-secondary !px-4 !py-1.5 text-xs">Merge</button>
                  </form>
                )}
                <form action={updateCluster}>
                  <input type="hidden" name="cluster_id" value={cluster.id} />
                  <input type="hidden" name="subject_id" value={params.subjectId} />
                  <input type="hidden" name="action" value="remove" />
                  <button className="text-xs text-ink/40 hover:text-red-600">Remove</button>
                </form>
              </div>
            </div>
          </div>
        ))}
        {(!clusters || clusters.length === 0) && (
          <p className="text-sm text-ink/50">
            No suggestions yet — they appear a little while after you upload photos.
          </p>
        )}
      </div>
    </div>
  );
}
