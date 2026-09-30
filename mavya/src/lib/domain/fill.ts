import "server-only";
import { must, type Db } from "./db";

// Fill Empty Spots (docs/M5_FILL_SPOTS.md). Which spots are open, who can
// take them and claiming one are all decided by the database; these only
// call it and shape what it returns.

export type OpenSpot = {
  occurrenceId: string;
  classId: string;
  startsAt: string;
  spots: number;
  offersOpen: number;
  offersClaimed: number;
};

export async function openSpots(db: Db, organisationId: string, days = 7): Promise<OpenSpot[]> {
  const { data, error } = await db.rpc("open_spots", { p_org: organisationId, p_days: days });
  return must({ data, error }).map((r) => ({
    occurrenceId: r.occurrence_id,
    classId: r.class_id,
    startsAt: r.starts_at,
    spots: r.spots,
    offersOpen: r.offers_open,
    offersClaimed: r.offers_claimed,
  }));
}

export type OfferStatus = "offered" | "claimed" | "declined" | "expired" | "filled";

export type Candidate = {
  childId: string;
  name: string;
  family: string;
  creditExpiresAt: string;
  missedAt: string | null;
  offerStatus: OfferStatus | null;
};

export async function candidates(db: Db, occurrenceId: string): Promise<Candidate[]> {
  const { data, error } = await db.rpc("vacancy_candidates", { p_occurrence: occurrenceId });
  return must({ data, error }).map((r) => ({
    childId: r.child_id,
    name: `${r.first_name} ${r.last_name}`,
    family: r.family_name,
    creditExpiresAt: r.credit_expires_at,
    missedAt: r.missed_at,
    offerStatus: (r.offer_status as OfferStatus | null) ?? null,
  }));
}

export async function offerSpot(db: Db, input: { occurrenceId: string; childId: string }) {
  const { data, error } = await db.rpc("offer_spot", {
    p_occurrence: input.occurrenceId,
    p_child: input.childId,
  });
  return must({ data, error });
}

export type OfferDetails = {
  offerId: string;
  status: OfferStatus;
  childId: string;
  childFirstName: string;
  className: string;
  level: string;
  location: string;
  timezone: string;
  instructor: string | null;
  startsAt: string;
  endsAt: string;
  expiresAt: string;
};

// The offer behind a claim code, if it's for the caller's family.
export async function offerDetails(db: Db, code: string): Promise<OfferDetails | null> {
  const { data, error } = await db.rpc("offer_details", { p_code: code });
  const row = must({ data, error })[0];
  if (!row) return null;
  return {
    offerId: row.offer_id,
    status: row.status as OfferStatus,
    childId: row.child_id,
    childFirstName: row.child_first_name,
    className: row.class_name,
    level: row.level_name,
    location: row.location_name,
    timezone: row.timezone,
    instructor: row.instructor_first_name,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    expiresAt: row.expires_at,
  };
}

export type ClaimOutcome = "claimed" | "taken" | "expired" | "closed";

export async function claimOffer(
  db: Db,
  code: string,
): Promise<{ outcome: ClaimOutcome; bookingId: string | null }> {
  const { data, error } = await db.rpc("claim_offer", { p_code: code });
  const row = must({ data, error })[0]!;
  return { outcome: row.outcome as ClaimOutcome, bookingId: row.booking_id };
}

export async function declineOffer(db: Db, code: string): Promise<boolean> {
  const { data, error } = await db.rpc("decline_offer", { p_code: code });
  return must({ data, error });
}

export type Tally = { makeupsDelivered: number; families: number; offersClaimed: number };

export const TALLY_DAYS = 84;

export async function fillTally(db: Db, organisationId: string): Promise<Tally> {
  const { data, error } = await db.rpc("fill_tally", { p_org: organisationId, p_days: TALLY_DAYS });
  const row = must({ data, error })[0]!;
  return {
    makeupsDelivered: row.makeups_delivered,
    families: row.families,
    offersClaimed: row.offers_claimed,
  };
}

export type CancelPreview = {
  lessons: number;
  children: number;
  families: number;
  credits: number;
  makeups: number;
};

export async function previewCancelLessons(
  db: Db,
  input: { locationId: string; date: string },
): Promise<CancelPreview> {
  const { data, error } = await db.rpc("preview_cancel_lessons", {
    p_location: input.locationId,
    p_date: input.date,
  });
  return must({ data, error })[0]!;
}
