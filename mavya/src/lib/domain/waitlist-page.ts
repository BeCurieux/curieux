import { explain, must, type Db } from "./db";

// A waiting-list page for new families (docs/M8_NETWORK.md, M8d): one
// school's own page, linked from its website. The database decides what's
// valid and who may see enquiries.

export type WaitlistPage = {
  school: string;
  levels: { id: string; name: string; program: string }[];
  locations: { id: string; name: string }[];
};

// The school's page, or null when it isn't on.
export async function waitlistPage(db: Db, slug: string): Promise<WaitlistPage | null> {
  const { data, error } = await db.rpc("waitlist_page", { p_slug: slug });
  if (error) throw explain(error);
  return (data as WaitlistPage | null) ?? null;
}

export type Enquiry = {
  parentName: string;
  email: string;
  phone: string | null;
  childFirstName: string;
  childLastName: string;
  dateOfBirth: string;
  levelId: string | null;
  locationId: string | null;
  weekdays: number[];
  earliest: string;
  latest: string;
  note: string | null;
};

export async function joinSchoolWaitlist(db: Db, slug: string, e: Enquiry) {
  const { error } = await db.rpc("join_school_waitlist", {
    p_slug: slug,
    p_parent_name: e.parentName,
    p_email: e.email,
    p_phone: e.phone as string,
    p_child_first_name: e.childFirstName,
    p_child_last_name: e.childLastName,
    p_date_of_birth: e.dateOfBirth,
    p_level: e.levelId as string,
    p_location: e.locationId as string,
    p_weekdays: e.weekdays,
    p_earliest: e.earliest,
    p_latest: e.latest,
    p_note: e.note as string,
    p_consent: true,
  });
  if (error) throw explain(error);
}

export type SchoolEnquiry = Enquiry & {
  id: string;
  levelName: string | null;
  locationName: string | null;
  createdAt: string;
};

// The school's enquiries, oldest first (the order families asked in).
export async function schoolEnquiries(db: Db, organisationId: string): Promise<SchoolEnquiry[]> {
  const rows = must(
    await db
      .from("waitlist_enquiries")
      .select("*, levels (name), locations (name)")
      .eq("organisation_id", organisationId)
      .order("created_at"),
  ) as unknown as {
    id: string;
    parent_name: string;
    email: string;
    phone: string | null;
    child_first_name: string;
    child_last_name: string;
    date_of_birth: string;
    level_id: string | null;
    location_id: string | null;
    weekdays: number[];
    earliest: string;
    latest: string;
    note: string | null;
    created_at: string;
    levels: { name: string } | null;
    locations: { name: string } | null;
  }[];
  return rows.map((r) => ({
    id: r.id,
    parentName: r.parent_name,
    email: r.email,
    phone: r.phone,
    childFirstName: r.child_first_name,
    childLastName: r.child_last_name,
    dateOfBirth: r.date_of_birth,
    levelId: r.level_id,
    locationId: r.location_id,
    levelName: r.levels?.name ?? null,
    locationName: r.locations?.name ?? null,
    weekdays: r.weekdays,
    earliest: r.earliest.slice(0, 5),
    latest: r.latest.slice(0, 5),
    note: r.note,
    createdAt: r.created_at,
  }));
}

export async function waitlistPageSetting(
  db: Db,
  organisationId: string,
): Promise<{ on: boolean; slug: string }> {
  const row = must(
    await db
      .from("organisations")
      .select("waitlist_page_on, slug")
      .eq("id", organisationId)
      .single(),
  );
  return { on: row.waitlist_page_on, slug: row.slug };
}

export async function setWaitlistPage(db: Db, organisationId: string, on: boolean) {
  const { error } = await db.rpc("set_waitlist_page", { p_org: organisationId, p_on: on });
  if (error) throw explain(error);
}

// Adds the enquiry to the waiting list; says whether the parent still
// needs inviting.
export async function addEnquiry(
  db: Db,
  enquiryId: string,
): Promise<{ familyId: string; email: string; joined: boolean }> {
  const out = must(await db.rpc("add_waitlist_enquiry", { p_enquiry: enquiryId })) as {
    family_id: string;
    email: string;
    joined: boolean;
  };
  return { familyId: out.family_id, email: out.email, joined: out.joined };
}

export async function removeEnquiry(db: Db, enquiryId: string) {
  const { error } = await db.rpc("remove_waitlist_enquiry", { p_enquiry: enquiryId });
  if (error) throw explain(error);
}
