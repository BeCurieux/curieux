import { CONTACT, COUNTRIES, SKILLS, TECH } from "./data";

// The Fit Finder's 20 questions, word for word from the shipped report
// (Income Fit Test v1.4): 18 that drive scoring, plus the minimum hourly
// rate (it sets the go/stop line) and an optional first name.
//
// Two answers didn't affect the v1.4 scoring: `psa` (products or services)
// and `rp` (recurring or one-off). At the founder's request they now break
// ties between ideas of equal fit (engine.ts, `byFit`).

export type QuestionType = "choice" | "num" | "text";

export interface Question {
  k: AnswerKey;
  q: string;
  h?: string;
  t: QuestionType;
  o?: readonly string[];
  lab?: Record<string, string>;
  sub?: Record<string, string>;
  min?: number;
  max?: number;
  step?: number;
  /** "cur" = the country's currency; "cur/hr" = currency an hour. */
  unit?: string;
  /** Upper end of the slider (the number box accepts up to max). */
  rangeMax?: number;
  default?: number;
  optional?: boolean;
}

export type AnswerKey =
  | "country"
  | "hours"
  | "block"
  | "evenings"
  | "priority"
  | "soon"
  | "budget"
  | "car"
  | "space"
  | "checks"
  | "contact"
  | "psa"
  | "rp"
  | "tech"
  | "skill1"
  | "skill2"
  | "remote"
  | "camera"
  | "minrate"
  | "name";

export const QUESTIONS: Question[] = [
  {
    k: "country",
    q: "Where do you live?",
    h: "This sets your currency and which country's rules apply.",
    t: "choice",
    o: COUNTRIES.map((c) => c[0]),
  },
  {
    k: "hours",
    q: "How many hours a week could you give this?",
    h: "A normal week, not your best one.",
    t: "num",
    min: 1,
    max: 40,
    unit: "hours a week",
    default: 10,
  },
  {
    k: "block",
    q: "What's the longest stretch you reliably get?",
    h: "In school hours, or whenever your working time is. This rules out more ideas than total hours.",
    t: "choice",
    o: ["1", "2", "3", "4"],
    lab: {
      "1": "About 1 hour",
      "2": "About 2 hours",
      "3": "About 3 hours",
      "4": "4 hours or more",
    },
  },
  { k: "evenings", q: "Could you work some evenings or weekends?", t: "choice", o: ["Yes", "No"] },
  {
    k: "priority",
    q: "What matters most right now?",
    t: "choice",
    o: ["Money soon", "Flexibility", "Building something over time"],
  },
  { k: "soon", q: "Do you need your first income within 8 weeks?", t: "choice", o: ["Yes", "No"] },
  {
    k: "budget",
    q: "How much could you spend to start?",
    h: "Zero is a perfectly good answer.",
    t: "num",
    min: 0,
    max: 5000,
    step: 10,
    unit: "cur",
    rangeMax: 1000,
    default: 0,
  },
  { k: "car", q: "Do you have a car you can use?", t: "choice", o: ["Yes", "No"] },
  {
    k: "space",
    q: "Do you have spare space?",
    h: "A garage, shed or spare room.",
    t: "choice",
    o: ["Yes", "No"],
  },
  {
    k: "checks",
    q: "Would you get checks or registrations if an idea needs them?",
    h: "For example a working-with-children check or a business registration.",
    t: "choice",
    o: ["Yes", "No"],
  },
  { k: "contact", q: "How much contact with customers suits you?", t: "choice", o: CONTACT },
  {
    k: "psa",
    q: "Would you rather sell products or services?",
    t: "choice",
    o: ["Products", "Services", "Either"],
  },
  {
    k: "rp",
    q: "Recurring clients or one-off projects?",
    t: "choice",
    o: ["Recurring", "Project", "Either"],
    lab: { Project: "One-off projects" },
  },
  {
    k: "tech",
    q: "How comfortable are you with technology?",
    t: "choice",
    o: TECH,
    lab: {
      Low: "Low · I keep it simple",
      Medium: "Medium · I can learn new apps",
      High: "High · I enjoy tech",
    },
  },
  {
    k: "skill1",
    q: "What's your main skill area?",
    t: "choice",
    o: SKILLS,
    sub: {
      Professional: "office, HR, finance, management",
      Admin: "organising, systems, data",
      Creative: "design, making, visual",
      Teaching: "tutoring, languages, training",
      Practical: "hands-on, physical",
      Writing: "words, content, communication",
    },
  },
  {
    k: "skill2",
    q: "A second skill area?",
    h: "Optional. Skip if nothing else stands out.",
    t: "choice",
    o: [...SKILLS, ""],
    lab: { "": "None, skip this" },
    optional: true,
  },
  {
    k: "remote",
    q: "Does it need to be remote only?",
    t: "choice",
    o: ["Yes", "No"],
    lab: { Yes: "Yes, remote only", No: "No, in person is fine too" },
  },
  {
    k: "camera",
    q: "Happy to appear on camera?",
    h: "Some ideas, like video lessons or filmed content for brands, need your face on screen.",
    t: "choice",
    o: ["Yes", "No"],
    lab: { Yes: "Yes, that's fine", No: "No, keep me off camera" },
  },
  {
    k: "minrate",
    q: "What's the least you'd accept for an hour of your time?",
    h: "Not what you hope to earn: the floor below which this isn't worth it to you. We use it to set your go/stop line.",
    t: "num",
    min: 0,
    max: 300,
    step: 1,
    unit: "cur/hr",
    rangeMax: 150,
    default: 25,
  },
  {
    k: "name",
    q: "What should we call you on your report?",
    h: "Optional. First name only, or leave it blank.",
    t: "text",
    optional: true,
  },
];

export type Answers = {
  country: Country;
  hours: number;
  block: number;
  evenings: "Yes" | "No";
  priority: "Money soon" | "Flexibility" | "Building something over time";
  soon: "Yes" | "No";
  budget: number;
  car: "Yes" | "No";
  space: "Yes" | "No";
  checks: "Yes" | "No";
  contact: (typeof CONTACT)[number];
  psa: "Products" | "Services" | "Either";
  rp: "Recurring" | "Project" | "Either";
  tech: (typeof TECH)[number];
  skill1: (typeof SKILLS)[number];
  skill2: (typeof SKILLS)[number] | "";
  remote: "Yes" | "No";
  camera: "Yes" | "No";
  minrate: number;
  name: string;
};

type Country = (typeof COUNTRIES)[number][0];
