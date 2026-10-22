import source from "../../../content/fit/opportunities.json";

// The 23 researched opportunities from the Income Fit Test (opportunity
// database v1.1, shipped in kit v1.4). content/fit/opportunities.json is a
// verbatim copy of the founder's file and the single source of truth; this
// module only renames fields to the short names the scoring engine uses,
// exactly as the shipped report does.
//
// Figures inside the text fields carry their own FACT / EST / UNKNOWN
// labels. Money figures are AUD unless stated (converted per country in
// engine.ts with the kit's October 2026 rates).

export const OPPORTUNITY_DB_VERSION = "1.1";
export const KIT_VERSION = "Income Fit Test v1.4";

export const COUNTRIES = [
  ["United States", "US$", 0.6928],
  ["United Kingdom", "£", 0.5243],
  ["Canada", "C$", 0.9891],
  ["Australia", "A$", 1.0],
  ["New Zealand", "NZ$", 1.2362],
  ["Somewhere else (use US$)", "US$", 0.6928],
] as const;
export type Country = (typeof COUNTRIES)[number][0];

export const CONTACT = ["None", "Messaging only", "Phone or video calls", "In person"] as const;
export const TECH = ["Low", "Medium", "High"] as const;
export const SKILLS = [
  "Professional",
  "Admin",
  "Creative",
  "Teaching",
  "Practical",
  "Writing",
] as const;

export interface Opportunity {
  id: number;
  name: string;
  group: string;
  /** Minimum hours a week. */
  minh: number;
  /** Minimum working block, in hours. */
  block: number;
  eve: "Yes" | "Partly" | "No";
  remote: "Yes" | "No";
  car: "Yes" | "No";
  space: "Yes" | "No";
  checks: "Yes" | "No";
  /** Minimum start-up capital, AUD (EST). */
  cap: number;
  /** Customer contact needed, 0–3 (index into CONTACT). */
  contact: number;
  psa: string;
  rp: string;
  /** Typical weeks to first income (EST). */
  weeks: number;
  evid: number;
  tech: number;
  skill: number;
  tag1: string;
  tag2: string;
  demand: number;
  lev: number;
  comp: number;
  pitch: number;
  camera: "Yes" | "No";
  do: string;
  who: string;
  reach: string;
  test: string;
  poor: string;
  verify: string;
}

interface SourceOption {
  id: number;
  name: string;
  group: string;
  min_hours: number;
  block_hrs: number;
  evenings: string;
  remote: string;
  car: string;
  space: string;
  checks: string;
  mincap: number;
  contact: number;
  psa: string;
  rp: string;
  weeks: number;
  evidence: number;
  tech: number;
  skill: number;
  tag1: string;
  tag2: string;
  demand: number;
  leverage: number;
  competition: number;
  pitching: number;
  do: string;
  who_pays: string;
  reach: string;
  first_test: string;
  poor_fit: string;
  verify: string;
}

const db = source as unknown as {
  _note: string;
  options: SourceOption[];
  extra: { CAMERA: number[] };
};

export const OPPORTUNITIES: Opportunity[] = db.options.map((o) => ({
  id: o.id,
  name: o.name,
  group: o.group,
  minh: o.min_hours,
  block: o.block_hrs,
  eve: o.evenings as Opportunity["eve"],
  remote: o.remote as Opportunity["remote"],
  car: o.car as Opportunity["car"],
  space: o.space as Opportunity["space"],
  checks: o.checks as Opportunity["checks"],
  cap: o.mincap,
  contact: o.contact,
  psa: o.psa,
  rp: o.rp,
  weeks: o.weeks,
  evid: o.evidence,
  tech: o.tech,
  skill: o.skill,
  tag1: o.tag1,
  tag2: o.tag2,
  demand: o.demand,
  lev: o.leverage,
  comp: o.competition,
  pitch: o.pitching,
  camera: db.extra.CAMERA.includes(o.id) ? "Yes" : "No",
  do: o.do,
  who: o.who_pays,
  reach: o.reach,
  test: o.first_test,
  poor: o.poor_fit,
  verify: o.verify,
}));

/** What one unit of each opportunity is called, for the calculator. */
export const UNIT: Record<number, string> = {
  1: "session",
  2: "lesson",
  3: "clean-up job",
  4: "resume package",
  5: "client month",
  6: "item sold",
  7: "item",
  8: "repair job",
  9: "client month",
  10: "item sold",
  11: "item sold",
  12: "download sold",
  13: "video",
  14: "commission",
  15: "night booked",
  16: "client month",
  17: "store set-up",
  18: "client month",
  19: "episode",
  20: "pack sold",
  21: "email flow",
  22: "translation job",
  23: "package",
};
