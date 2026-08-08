/**
 * The taste model (§19).
 *
 * Deliberately NOT a large AI-generated blob. Personalisation runs on explicit
 * structured signals — dimension, value, weight, confidence, source — because
 * they can be inspected, tested, corrected by the user and reasoned about
 * arithmetically. The model may write a readable summary of them; it does not
 * own them.
 *
 * The dimensions in use:
 *
 *   category:<id>          −1…+1  affinity for a category
 *   travel_max_minutes     value is a number, weight unused
 *   walk_preferred_km      value is "min-max"
 *   start_time             value is "HH:MM"
 *   crowd_tolerance        value is 0–1
 *   spend_activity         value is low|medium|high
 *   spend_food             value is low|medium|high
 *   novelty_appetite       value is 0–1
 */

import { EVIDENCE_WEIGHTS, type EvidenceSource } from "@/config/scoring";
import type { PreferenceProfile, TasteSignal, TasteSource } from "@/lib/types";

export const TASTE_DIMENSIONS = {
  CATEGORY: "category",
  TRAVEL_MAX_MINUTES: "travel_max_minutes",
  WALK_PREFERRED_KM: "walk_preferred_km",
  START_TIME: "start_time",
  CROWD_TOLERANCE: "crowd_tolerance",
  SPEND_ACTIVITY: "spend_activity",
  SPEND_FOOD: "spend_food",
  NOVELTY_APPETITE: "novelty_appetite",
} as const;

/** A proposed change to the model, before it is merged with what exists. */
export interface SignalDelta {
  dimension: string;
  value: string;
  /** Change to apply to the weight, −1…+1. */
  delta: number;
  source: TasteSource;
  evidence: string;
}

const SOURCE_TO_EVIDENCE: Record<TasteSource, EvidenceSource> = {
  ONBOARDING: "onboarding",
  CHECKIN: "checkin",
  PLAN_ACCEPTED: "plan_accepted",
  PLAN_REJECTED: "plan_rejected",
  DID_IT: "did_it",
  LOVED_IT: "loved_it",
  RATING: "rating",
  MANUAL_EDIT: "manual_edit",
  INFERRED: "inferred",
};

/**
 * Merge a delta into an existing signal.
 *
 * Two things happen, and they are separate on purpose:
 *
 *  - The WEIGHT moves toward the evidence, scaled by how much that kind of
 *    evidence is worth (§18: doing something counts for far more than ticking
 *    a box about it).
 *  - The CONFIDENCE rises with corroboration and falls when new evidence
 *    contradicts the existing signal. A signal we have seen confirmed six
 *    times should not be overturned by one bad Saturday, but it should become
 *    less certain.
 */
export function applyDelta(existing: TasteSignal | null, delta: SignalDelta): {
  weight: number;
  confidence: number;
} {
  const evidenceWeight = EVIDENCE_WEIGHTS[SOURCE_TO_EVIDENCE[delta.source]];
  const scaled = delta.delta * evidenceWeight * 0.25;

  if (!existing) {
    return {
      weight: clamp(scaled * 2, -1, 1),
      // A single observation is never confident, however strong.
      confidence: Math.min(0.35, 0.15 * evidenceWeight),
    };
  }

  const weight = clamp(existing.weight + scaled, -1, 1);

  const agrees = Math.sign(delta.delta) === Math.sign(existing.weight) || existing.weight === 0;
  const confidence = agrees
    ? Math.min(1, existing.confidence + 0.12 * evidenceWeight)
    : Math.max(0.1, existing.confidence - 0.18);

  return { weight, confidence: round2(confidence) };
}

/**
 * Seed signals from onboarding (§19, source ONBOARDING).
 *
 * These start at modest weight and low confidence by design: what someone
 * ticks on a Tuesday evening is a hypothesis about themselves, and the whole
 * product is built on the assumption that behaviour will revise it.
 */
export function seedFromOnboarding(preferences: PreferenceProfile): SignalDelta[] {
  const deltas: SignalDelta[] = [];

  for (const categoryId of preferences.liked_categories) {
    deltas.push({
      dimension: TASTE_DIMENSIONS.CATEGORY,
      value: categoryId,
      delta: 0.6,
      source: "ONBOARDING",
      evidence: "Selected during onboarding",
    });
  }

  deltas.push({
    dimension: TASTE_DIMENSIONS.TRAVEL_MAX_MINUTES,
    value: String(preferences.max_travel_minutes),
    delta: 0.5,
    source: "ONBOARDING",
    evidence: "Stated travel tolerance",
  });

  deltas.push({
    dimension: TASTE_DIMENSIONS.CROWD_TOLERANCE,
    value: preferences.crowd_tolerance.toFixed(2),
    delta: 0.5,
    source: "ONBOARDING",
    evidence: "Stated crowd tolerance",
  });

  const startTimes: Record<string, string> = {
    EARLY: "07:45",
    AROUND_9: "09:00",
    AROUND_10: "10:00",
    LATE_MORNING: "11:00",
    FLEXIBLE: "09:30",
  };
  const startTime = startTimes[preferences.start_time_preference];
  if (startTime) {
    deltas.push({
      dimension: TASTE_DIMENSIONS.START_TIME,
      value: startTime,
      delta: 0.4,
      source: "ONBOARDING",
      evidence: "Stated preferred start",
    });
  }

  // Dislikes are negative category signals where they map onto a category, and
  // constraints otherwise. "Crowds" is a tolerance, not a category.
  const dislikeToCategory: Record<string, string> = {
    steep_hikes: "bushwalks",
    shopping: "vintage",
    touristy: "unusual",
  };
  for (const dislike of preferences.dislikes) {
    const categoryId = dislikeToCategory[dislike];
    if (categoryId) {
      deltas.push({
        dimension: TASTE_DIMENSIONS.CATEGORY,
        value: categoryId,
        delta: -0.7,
        source: "ONBOARDING",
        evidence: `Stated dislike: ${dislike}`,
      });
    }
  }
  if (preferences.dislikes.includes("crowds")) {
    deltas.push({
      dimension: TASTE_DIMENSIONS.CROWD_TOLERANCE,
      value: "0.20",
      delta: 0.8,
      source: "ONBOARDING",
      evidence: "Explicitly dislikes crowds",
    });
  }

  return deltas;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
