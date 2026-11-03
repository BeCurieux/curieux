import { NextResponse } from "next/server";
import { toCsv } from "@/lib/admin/csv";
import { isAdmin } from "@/lib/auth/session";
import { userClient } from "@/lib/supabase/server";

// The Leads tab's export (SPEC.md → Admin). Admins only; everyone else gets
// a 404. Read through row level security as the admin.
export async function GET() {
  if (!(await isAdmin())) return new NextResponse("Not found", { status: 404 });
  const db = await userClient();
  const { data: leads, error } = await db
    .from("leads")
    .select("email, source, first_seen, interests, converted_user_id")
    .order("first_seen", { ascending: false });
  if (error) return new NextResponse("Couldn't read leads", { status: 500 });
  const { data: orders } = await db
    .from("orders")
    .select("user_id, products!orders_product_id_fkey(tier)");
  const buyers = new Set(
    (orders ?? [])
      .filter((o) => {
        const tier = (o.products as unknown as { tier: string } | null)?.tier;
        return o.user_id && (tier === "module0" || tier === "course" || tier === "founding");
      })
      .map((o) => o.user_id as string),
  );
  const csv = toCsv(
    ["email", "source", "first_seen", "interests", "has_account", "bought"],
    leads.map((l) => [
      l.email,
      l.source,
      l.first_seen,
      (l.interests as string[]).join(" "),
      l.converted_user_id ? "yes" : "no",
      l.converted_user_id && buyers.has(l.converted_user_id) ? "yes" : "no",
    ]),
  );
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="leads-${date}.csv"`,
      "cache-control": "private, no-store",
    },
  });
}
