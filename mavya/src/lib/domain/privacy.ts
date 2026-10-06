import { explain, must, type Db } from "./db";

// A family's data on request (docs/M6_MIGRATION_PILOT.md, M6d): everything
// Ovyko holds about them, or deleting it. The database checks the caller
// owns the school and audits both.

export async function exportFamily(db: Db, familyId: string): Promise<unknown> {
  return must(await db.rpc("export_family", { p_family: familyId }));
}

// Returns the sign-in accounts of parents who now belong nowhere, for the
// server to remove.
export async function deleteFamily(db: Db, familyId: string, confirm: string): Promise<string[]> {
  const { data, error } = await db.rpc("delete_family", { p_family: familyId, p_confirm: confirm });
  if (error) throw explain(error);
  return data ?? [];
}
