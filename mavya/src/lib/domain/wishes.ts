import { explain, type Db } from "./db";

// What families want (docs/M8_NETWORK.md, M8b): times a family would like
// for a child, inside their own school; for owners, new-class
// opportunities and places that match now.

export type Wish = {
  id: string;
  childId: string;
  childName: string;
  familyName: string;
  levelName: string | null;
  locationName: string | null;
  weekdays: number[];
  earliest: string;
  latest: string;
  note: string | null;
  status: "open" | "placed" | "withdrawn";
  createdAt: string;
};

const WISH_SELECT =
  "id, child_id, weekdays, earliest, latest, note, status, created_at, children (first_name), families (display_name), levels (name), locations (name)";

type WishRow = {
  id: string;
  child_id: string;
  weekdays: number[];
  earliest: string;
  latest: string;
  note: string | null;
  status: string;
  created_at: string;
  children: { first_name: string } | null;
  families: { display_name: string } | null;
  levels: { name: string } | null;
  locations: { name: string } | null;
};

const toWish = (r: WishRow): Wish => ({
  id: r.id,
  childId: r.child_id,
  childName: r.children?.first_name ?? "A child",
  familyName: r.families?.display_name ?? "",
  levelName: r.levels?.name ?? null,
  locationName: r.locations?.name ?? null,
  weekdays: r.weekdays,
  earliest: r.earliest.slice(0, 5),
  latest: r.latest.slice(0, 5),
  note: r.note,
  status: r.status as Wish["status"],
  createdAt: r.created_at,
});

// A child's requests, newest first (the family sees its own only).
export async function childWishes(db: Db, childId: string): Promise<Wish[]> {
  const { data, error } = await db
    .from("place_wishes")
    .select(WISH_SELECT)
    .eq("child_id", childId)
    .order("created_at", { ascending: false });
  if (error) throw explain(error);
  return (data as unknown as WishRow[]).map(toWish);
}

// Every open request at the school, for its owners.
export async function openWishes(db: Db, organisationId: string): Promise<Wish[]> {
  const { data, error } = await db
    .from("place_wishes")
    .select(WISH_SELECT)
    .eq("organisation_id", organisationId)
    .eq("status", "open")
    .order("created_at", { ascending: false });
  if (error) throw explain(error);
  return (data as unknown as WishRow[]).map(toWish);
}

export async function addWish(
  db: Db,
  input: {
    childId: string;
    levelId: string | null;
    locationId: string | null;
    weekdays: number[];
    earliest: string;
    latest: string;
    note: string;
  },
): Promise<string> {
  const { data, error } = await db.rpc("add_place_wish", {
    p_child: input.childId,
    p_level: input.levelId as string,
    p_location: input.locationId as string,
    p_weekdays: input.weekdays,
    p_earliest: input.earliest,
    p_latest: input.latest,
    p_note: input.note,
  });
  if (error) throw explain(error);
  return data;
}

export async function withdrawWish(db: Db, wishId: string) {
  const { error } = await db.rpc("withdraw_place_wish", { p_wish: wishId });
  if (error) throw explain(error);
}

export type Opportunity = {
  levelId: string;
  levelName: string;
  locationId: string;
  locationName: string;
  weekday: number;
  startTime: string;
  children: number;
};

export async function classOpportunities(db: Db, organisationId: string): Promise<Opportunity[]> {
  const { data, error } = await db.rpc("class_opportunities", { p_org: organisationId });
  if (error) throw explain(error);
  return (data ?? []).map((o) => ({
    levelId: o.level_id,
    levelName: o.level_name,
    locationId: o.location_id,
    locationName: o.location_name,
    weekday: o.weekday,
    startTime: o.start_time.slice(0, 5),
    children: o.children,
  }));
}

export type WishMatch = {
  wishId: string;
  classId: string;
  className: string;
  locationName: string;
  weekday: number;
  startTime: string;
  spare: number;
};

export async function wishMatches(db: Db, organisationId: string): Promise<WishMatch[]> {
  const { data, error } = await db.rpc("wish_matches", { p_org: organisationId });
  if (error) throw explain(error);
  return (data ?? []).map((m) => ({
    wishId: m.wish_id,
    classId: m.class_id,
    className: m.class_name,
    locationName: m.location_name,
    weekday: m.weekday,
    startTime: m.start_time.slice(0, 5),
    spare: m.spare,
  }));
}

export async function placeFromWish(db: Db, wishId: string, classId: string): Promise<string> {
  const { data, error } = await db.rpc("place_from_wish", { p_wish: wishId, p_class: classId });
  if (error) throw explain(error);
  return data;
}

export type WishChoices = {
  levels: { id: string; name: string; program: string }[];
  locations: { id: string; name: string }[];
};

// The school's levels and locations a family can ask for.
export async function wishChoices(db: Db, organisationId: string): Promise<WishChoices> {
  const { data, error } = await db.rpc("wish_choices", { p_org: organisationId });
  if (error) throw explain(error);
  const rows = data ?? [];
  return {
    levels: rows
      .filter((r) => r.kind === "level")
      .map((r) => ({ id: r.id, name: r.name, program: r.program ?? "" })),
    locations: rows.filter((r) => r.kind === "location").map((r) => ({ id: r.id, name: r.name })),
  };
}
