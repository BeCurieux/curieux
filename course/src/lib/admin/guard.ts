import "server-only";
import { notFound } from "next/navigation";
import { isAdmin, requireUser } from "@/lib/auth/session";

// /admin is gated by the admins table and a server check (SPEC.md → Admin).
// Anyone else gets a plain 404: the page doesn't announce itself.
export async function requireAdmin(path = "/admin") {
  const user = await requireUser(path);
  if (!(await isAdmin())) notFound();
  return user;
}
