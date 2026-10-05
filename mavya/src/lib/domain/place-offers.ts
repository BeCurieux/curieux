import { explain, must, type Db } from "./db";

// Free places offered to waiting families (docs/M8_NETWORK.md, M8c). A
// place is held for the family for 48 hours; they accept or decline. The
// database decides who may, and what's free.

export type OpenPlaceOffer = {
  id: string;
  childName: string;
  familyName: string;
  className: string;
  weekday: number;
  startTime: string;
  expiresAt: string;
  automatic: boolean;
};

// Offers waiting for a family's answer, soonest to lapse first.
export async function openPlaceOffers(db: Db, organisationId: string): Promise<OpenPlaceOffer[]> {
  const rows = must(
    await db
      .from("place_offers")
      .select(
        "id, expires_at, offered_by, children (first_name), families (display_name), classes (name, weekday, start_time)",
      )
      .eq("organisation_id", organisationId)
      .eq("status", "offered")
      .gt("expires_at", new Date().toISOString())
      .order("expires_at"),
  ) as unknown as {
    id: string;
    expires_at: string;
    offered_by: string | null;
    children: { first_name: string } | null;
    families: { display_name: string } | null;
    classes: { name: string; weekday: number; start_time: string } | null;
  }[];
  return rows.map((r) => ({
    id: r.id,
    childName: r.children?.first_name ?? "A child",
    familyName: r.families?.display_name ?? "",
    className: r.classes?.name ?? "",
    weekday: r.classes?.weekday ?? 1,
    startTime: (r.classes?.start_time ?? "00:00").slice(0, 5),
    expiresAt: r.expires_at,
    automatic: r.offered_by === null,
  }));
}

export async function autoPlaceOffersOn(db: Db, organisationId: string): Promise<boolean> {
  const row = must(
    await db.from("organisations").select("auto_place_offers").eq("id", organisationId).single(),
  );
  return row.auto_place_offers;
}

export async function setAutoPlaceOffers(db: Db, organisationId: string, on: boolean) {
  const { error } = await db.rpc("set_auto_place_offers", { p_org: organisationId, p_on: on });
  if (error) throw explain(error);
}

export async function offerPlace(db: Db, wishId: string, classId: string): Promise<string> {
  const { data, error } = await db.rpc("offer_place", { p_wish: wishId, p_class: classId });
  if (error) throw explain(error);
  return data;
}

export async function withdrawPlaceOffer(db: Db, offerId: string) {
  const { error } = await db.rpc("withdraw_place_offer", { p_offer: offerId });
  if (error) throw explain(error);
}

export type MyPlaceOffer = {
  id: string;
  childId: string;
  childName: string;
  school: string;
  className: string;
  level: string;
  location: string;
  weekday: number;
  startTime: string;
  expiresAt: string;
};

export async function myPlaceOffers(db: Db): Promise<MyPlaceOffer[]> {
  const { data, error } = await db.rpc("my_place_offers");
  if (error) throw explain(error);
  return (data ?? []).map((o) => ({
    id: o.offer_id,
    childId: o.child_id,
    childName: o.child_first_name,
    school: o.organisation_name,
    className: o.class_name,
    level: o.level_name,
    location: o.location_name,
    weekday: o.weekday,
    startTime: o.start_time.slice(0, 5),
    expiresAt: o.expires_at,
  }));
}

// The enrolment when accepted; null when declined, or when the offer had
// already lapsed.
export async function answerPlaceOffer(
  db: Db,
  offerId: string,
  accept: boolean,
): Promise<string | null> {
  const { data, error } = await db.rpc("answer_place_offer", {
    p_offer: offerId,
    p_accept: accept,
  });
  if (error) throw explain(error);
  return data ?? null;
}
