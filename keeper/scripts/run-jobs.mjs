// Local job runner: drains the queue by calling the jobs endpoint until empty.
// Usage: JOBS_SECRET=... npm run jobs

const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const secret = process.env.JOBS_SECRET;
if (!secret) {
  console.error("Set JOBS_SECRET");
  process.exit(1);
}

for (;;) {
  const res = await fetch(`${base}/api/jobs/run?batch=10`, {
    method: "POST",
    headers: { "x-jobs-secret": secret },
  });
  if (!res.ok) {
    console.error("job run failed:", res.status, await res.text());
    process.exit(1);
  }
  const out = await res.json();
  for (const r of out.results) {
    console.log(`${r.ok ? "✓" : "✕"} ${r.type} ${r.error ?? ""}`);
  }
  if (out.processed === 0) break;
}
console.log("Queue drained.");
