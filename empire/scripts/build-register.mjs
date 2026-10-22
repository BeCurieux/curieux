// Builds content/register.json and content/register.csv — the content
// inventory and source-to-feature mapping — from the audit records.
// Run: node scripts/build-register.mjs
//
// Sources:
//   content/audit/fit-kit.json          Income Fit Test kit (PDFs, workbook)
//   content/audit/products-offer.json   offer, money, brand and add-on products
//   content/audit/products-content.json faceless products, starter kits
//   EXTRA below                          the FIT engine sources, the brand
//                                        system, and assets that weren't found
//
// Every audit entry was read from the founder's documents (22 Oct 2026) and
// cites file and section; see content/audit/*-methods.md for the methods.

import { readFileSync, writeFileSync } from "node:fs";

const read = (f) => JSON.parse(readFileSync(f, "utf8"));
const group = (g) => (x) => ({ ...x, group: g });

const audited = [
  ...read("content/audit/fit-kit.json").map(group("Income Fit Test kit")),
  ...read("content/audit/products-offer.json").map(group("Offer, money and add-ons")),
  ...read("content/audit/products-content.json").map(group("Content and starter kits")),
];

const base = {
  content_types: [],
  duplicates_with: [],
  missing_information: [],
  research_verification: [],
  compliance_flags: [],
  sections: [],
};

const EXTRA = [
  {
    ...base,
    id: "income-fit-test",
    title: "The Income Fit Test (product)",
    group: "Income Fit Test kit",
    file: "01_income-fit-test/",
    version: "v1.4 (Start Here); 1.3 on other files",
    price_usd: 19,
    product: "The Income Fit Test",
    content_summary:
      "The flagship: an offline personalised report (20-question quiz, top three of 23 researched ideas, calculator, rules for five countries, a dated 14-day plan and go/adjust/stop), plus the workbook, opportunity cards, AI shortcut system, 14-day test plan, scorecard and rules guides.",
    customer_problem: "Which side income fits my real week, and how do I test it cheaply?",
    content_types: ["question", "formula", "research", "workflow", "guidance"],
    proposed_destination: "FIT Finder",
    proposed_form: "interactive feature (built)",
    duplicates_with: ["fit-report", "workbook", "start-here"],
    missing_information: [
      "Version numbering differs between files (1.4 vs 1.3); the founder confirmed v1.4 (see content/CORRECTIONS.md).",
      "Question count is stated as 20, 19, 17 + optional and 15 in different files; the founder confirmed 20.",
    ],
    reuse: {
      status: "built",
      reason: "Converted into the FIT Finder: src/lib/fit, app/studio/fit.",
    },
  },
  {
    ...base,
    id: "fit-report",
    title: "Your Income Fit Report (quiz and scoring engine)",
    group: "Income Fit Test kit",
    file: "01_income-fit-test/kit/00_Your_Income_Fit_Report.html; source/report_src.html",
    version: "v1.4",
    price_usd: null,
    content_summary:
      "The interactive report: 18 scored questions plus a minimum hourly rate and an optional name (20 in total), the Fit Finder scoring ported from the workbook's Options sheet (columns AF–AZ), top three, why it fits, risks, a calculator, country rules summaries, a dated 14-day plan, Day 14 gates and back-ups.",
    customer_problem: "Personalised result from the quiz.",
    content_types: ["question", "formula", "guidance"],
    proposed_destination: "FIT Finder quiz and report",
    proposed_form: "interactive feature (built)",
    duplicates_with: [
      "workbook (same scoring)",
      "14-day-test-plan (report has a shorter dated version)",
      "go-no-go-scorecard (report adds an hourly-rate gate)",
    ],
    missing_information: [
      "'Sells without pitching' feeds only the risks text, not the score.",
      "The workbook's calculator model differs from the report's; the report is the source of truth (founder, 22 Oct 2026) and the workbook is to be brought into line (content/CORRECTIONS.md).",
    ],
    research_verification: ["Currency conversions use October 2026 rates (EST)."],
    reuse: {
      status: "built",
      reason:
        "Ported 1:1 to src/lib/fit/engine.ts; tests run the shipped JavaScript beside the port on 5,000 answer sets with identical scores. Products/services and recurring/one-off now break ties (founder, 22 Oct 2026).",
    },
  },
  {
    ...base,
    id: "opportunity-database",
    title: "Opportunity database (23 options)",
    group: "Income Fit Test kit",
    file: "01_income-fit-test/opportunities.json; source/options.py",
    version: "database v1.1",
    price_usd: null,
    content_summary:
      "Machine-readable fields for all 23 opportunities: scoring inputs and the text for what you do, who pays, reach, first test, poor fit and what to verify.",
    customer_problem: "Researched, comparable ideas.",
    content_types: ["research"],
    proposed_destination: "Opportunity research database",
    proposed_form: "structured data (built)",
    duplicates_with: [
      "opportunity-cards (same 23, as PDF)",
      "fit-report (embedded copy — verified identical, 0 differences)",
    ],
    research_verification: [
      "Figures in the text carry FACT/EST/UNKNOWN labels; money is AUD unless stated. Re-verify dated figures before each kit revision.",
    ],
    reuse: {
      status: "built",
      reason: "content/fit/opportunities.json is the single source for the FIT Finder.",
    },
  },
  {
    ...base,
    id: "fit-country-rules",
    title: "Country rules (report summaries and rules.py)",
    group: "Income Fit Test kit",
    file: "01_income-fit-test/source/rules.py; report RULES block",
    version: "checked 17 Oct 2026 (AU), 19 Oct 2026 (US, UK, CA, NZ)",
    price_usd: null,
    content_summary:
      "Short dated summaries per country in the report, labelled fact or unknown. rules.py builds the full Rules Guide from research files that aren't in the folder, and holds the US chapter back unless a US_READY flag is set.",
    customer_problem: "What rules apply where I live?",
    content_types: ["research", "guidance"],
    proposed_destination: "FIT Finder report § The rules where you live",
    proposed_form: "structured data (built), with the full guide as a downloadable resource",
    duplicates_with: ["rules-guides"],
    missing_information: [
      "The research_*.md files rules.py reads are not in the folder.",
      "Whether the shipped US chapter is final (US_READY) is unknown.",
    ],
    research_verification: ["Every line needs re-checking at each country's tax-year change."],
    compliance_flags: [],
    reuse: {
      status: "built",
      reason: "src/lib/fit/rules.ts, word for word with dates and labels.",
    },
  },
  {
    ...base,
    id: "brand-system",
    title: "Her Little Empire visual identity",
    group: "Brand",
    file: "03_brand/visual-identity.html; 03_brand/PRINT_STYLE.md; 03_brand/fonts/",
    version: "brand book v1 / print style v2, Oct 2026",
    price_usd: null,
    content_summary:
      "Colour tokens, font roles, devices (running head, numbering, footnote, one rose word), imagery do/don't, motion and the two-second check.",
    customer_problem: "Consistent, recognisable brand.",
    content_types: ["guidance"],
    proposed_destination: "Empire Studio's own look",
    proposed_form: "design tokens (adopted)",
    missing_information: [
      "Resolved (founder, 22 Oct 2026): Bodoni Moda 800 for headings, grey #564B4E, no stock photos of people. The brand book v1 still says #6E6264, 700 and allows stock photos; see content/CORRECTIONS.md.",
    ],
    compliance_flags: [
      "The brand book footer names the former trading entity. Replace it with: Her Little Empire · ABN 38 813 430 864 · hello@herlittleempire.com (content/CORRECTIONS.md).",
    ],
    reuse: {
      status: "built",
      reason:
        "Adopted in src/app/globals.css with the brand's own font files (print style v2 wins where they disagree).",
    },
  },
  {
    ...base,
    id: "video-course",
    title: "Video Course",
    group: "Income Fit Test kit",
    file: "not supplied (catalog.py lists Her-Little-Empire_Income-Fit-Test_Video-Course_v1.3.zip)",
    version: "v1.3 per catalog.py",
    price_usd: 6,
    content_summary: "unknown — not in the folder",
    customer_problem: "unknown",
    proposed_destination: "Guided learning beside the FIT Finder",
    proposed_form: "educational content",
    missing_information: ["Entire course"],
    reuse: { status: "blocked", reason: "Source not supplied." },
  },
  {
    ...base,
    id: "course-manuscripts",
    title: "Course manuscripts and assignments",
    group: "Named in the addendum, not found",
    file: "not supplied",
    version: "n/a",
    price_usd: null,
    content_summary:
      "No manuscripts were in the folder. The Faceless Content System workbook is described as a course workbook; the video course is listed in catalog.py but not supplied.",
    customer_problem: "n/a",
    proposed_destination: "Guided learning and implementation tasks",
    proposed_form: "educational content + tasks",
    missing_information: ["Manuscripts and assignments"],
    reuse: { status: "blocked", reason: "Not supplied." },
  },
];

// The addendum's conversion order.
const PRIORITY = {
  "income-fit-test": 1,
  "fit-report": 1,
  "opportunity-database": 1,
  "opportunity-cards": 1,
  workbook: 1,
  "fit-country-rules": 1,
  "rules-guides": 1,
  "go-no-go-scorecard": 1,
  "14-day-test-plan": 1,
  "14-day-tracker": 1,
  "start-here": 1,
  "ai-shortcut-system": 1,
  "brand-system": 2,
  "brand-in-a-box": 2,
  "sell-it-simply-workbook": 2,
  "little-offer-kit": 4,
  "get-found": 4,
  "first-5-customers": 4,
  "ai-business-assistant-pack": 4,
  "price-it-right": 5,
  "side-income-money-system": 5,
  "faceless-content-system-workbook": 6,
  "100-faceless-hooks": 6,
  "30-day-faceless-content-plan": 6,
  "faceless-not-anonymous-workbook": 6,
  "comment-to-dm-kit": 6,
};

// What has been built from each, in this release.
const BUILT = {
  "income-fit-test":
    "FIT Finder (quiz, report, calculator, dated 14-day plan, Day 14 gates), saved per account",
  "fit-report": "src/lib/fit/engine.ts (1:1 port, parity-tested)",
  "opportunity-database": "content/fit/opportunities.json",
  "fit-country-rules": "src/lib/fit/rules.ts",
  "go-no-go-scorecard": "Day 14 gates in the FIT Finder report (the report's version)",
  "14-day-test-plan": "Dated, saveable plan in the FIT Finder report (the report's version)",
  "14-day-tracker": "Plan ticks and calculator inputs saved per result",
  "brand-system": "Empire Studio's colours, fonts and labels",
  "sell-it-simply-workbook":
    "Methods: homepage_copy, product_listing, image_briefs, email_sequence, theme_brief; named steps in Empire Studio's own brand_blueprint method",
  "little-offer-kit": "Methods: product_listing, homepage_copy, email_sequence, design rules",
  "get-found": "SEO and title rules in the product_listing method",
  "first-5-customers": "Honesty rules in the email_sequence method",
  "ai-business-assistant-pack": "Ideal-customer, benefits and FAQ prompts in the methods",
  "faceless-content-system-workbook": "Method: social_content (formats, caption template)",
  "30-day-faceless-content-plan": "Method: social_content (weekly rhythm, launch week days 23–29)",
  "100-faceless-hooks": "content/hooks/hooks.json (100 hooks, verbatim) used by social_content",
  "faceless-not-anonymous-workbook": "Trust rules in social_content and theme_brief",
  "fit-check-freebie": "Free tier of the FIT Finder: top three ideas, one line on why each fits",
  "comment-to-dm-kit": "Listed as a social_content source; templates not yet used",
};

const NOT_REVIEWED = new Set(["video-course", "course-manuscripts"]);

// The founder's answers to the audit (Vee, 22 Oct 2026). Document fixes
// they call for are listed in content/CORRECTIONS.md.
const QUIZ = "The quiz is 20 questions and the kit is v1.4: use that everywhere.";
const DAY14 =
  "The Income Fit Report is the source of truth for the Day 14 rules and the calculator; this file is to match it.";
const REFUND =
  "Use exactly 'Full refund within 14 days of purchase, no questions asked.'; any consumer-rights mention goes in its own sentence after it.";
const LABELS = "Label every figure FACT, EST or UNKNOWN, with the date checked.";
const LAWYER =
  "Keep the 'ask a lawyer' referrals: they're responsible. The rule only bans describing the founder as a lawyer, barrister or counsel near products.";
const DECISIONS = {
  "income-fit-test": [QUIZ],
  "fit-report": [
    "Free users see their top three ideas with one line on why each fits; the full report (calculator, country rules, dated 14-day plan, go/adjust/stop) stays with Income Fit Test owners and bundle buyers.",
    "Products vs services and recurring vs one-off are tie-breakers in scoring.",
    DAY14.replace("this file is to match it", "everything else matches it"),
  ],
  "start-here": [QUIZ, REFUND],
  "14-day-test-plan": [QUIZ, DAY14, LABELS],
  "ai-shortcut-system": [QUIZ, DAY14, LABELS],
  "go-no-go-scorecard": [DAY14],
  workbook: [QUIZ, DAY14, LABELS, LAWYER],
  "opportunity-cards": [LABELS, LAWYER],
  "first-5-customers": [LAWYER, LABELS],
  "client-paperwork-kit": [LAWYER],
  "fit-check-freebie": [
    "Free, on Gumroad at the permalink fit-check.",
    QUIZ.replace(
      "use that everywhere",
      "the Fit Check's '17 questions (plus 2 optional)' changes to 20",
    ),
    REFUND,
  ],
  "sell-it-simply-workbook": [
    "Unreleased: not on sale yet. Its methods still power Empire Studio's generators.",
  ],
  "faceless-content-system-workbook": ["Unreleased: not on sale yet.", LABELS],
  "faceless-not-anonymous-workbook": ["Unreleased: not on sale yet."],
  "brand-in-a-box": [
    "The Brand Blueprint is labelled as Empire Studio's own method and doesn't claim to come from Brand-in-a-Box.",
  ],
  "brand-system": [
    "The website and current product PDFs win: Bodoni Moda 800 for headings, grey #564B4E, no stock photos of people (faceless brand).",
    "Footer: Her Little Empire · ABN 38 813 430 864 · hello@herlittleempire.com. No former trading name anywhere.",
  ],
};

const isLawyerFlag = (f) =>
  typeof f === "string" && /'lawyer' appears|puts 'lawyer' in product copy/.test(f);

const assets = [...audited, ...EXTRA].map((a) => ({
  priority: PRIORITY[a.id] ?? 7,
  ...a,
  // Decided: these referrals stay (see founder_decisions).
  compliance_flags: (a.compliance_flags ?? []).filter((f) => !isLawyerFlag(f)),
  source_reviewed: !NOT_REVIEWED.has(a.id),
  built: BUILT[a.id] ?? null,
  founder_decisions: DECISIONS[a.id] ?? [],
}));
for (const id of Object.keys(DECISIONS))
  if (!assets.some((a) => a.id === id)) throw new Error(`decision for unknown asset ${id}`);

const ids = new Set();
for (const a of assets) {
  if (ids.has(a.id)) throw new Error(`duplicate id ${a.id}`);
  ids.add(a.id);
}

const register = {
  generated: "2026-10-22",
  source:
    "Her Little Empire documents supplied 22 Oct 2026 (README_FOR_CLAUDE_CODE.md and 01_income-fit-test, 02_products, 03_brand), audited file by file.",
  fields: {
    file: "Original document(s), relative to the supplied folder.",
    sections: "Its sections, in order.",
    customer_problem: "The problem it addresses, in the document's framing.",
    content_types: "research, guidance, question, formula, template, workflow, example.",
    proposed_destination: "Where it goes in FIT Finder or Empire Studio.",
    proposed_form:
      "Interactive feature, structured data, AI instruction, educational article or downloadable resource.",
    duplicates_with: "Overlap with other assets.",
    missing_information: "Gaps and inconsistencies.",
    research_verification:
      "Figures, rules and claims to re-check, and whether they're labelled and dated.",
    compliance_flags: "Conflicts with the founder's rules.",
    reuse: "built | immediate | needs-work | blocked, with the reason.",
    built: "What this release built from it.",
    founder_decisions: "The founder's answers to the audit (22 Oct 2026).",
  },
  assets: assets.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id)),
};

writeFileSync("content/register.json", `${JSON.stringify(register, null, 2)}\n`);

const columns = [
  "priority",
  "id",
  "title",
  "group",
  "file",
  "version",
  "price_usd",
  "customer_problem",
  "content_types",
  "proposed_destination",
  "proposed_form",
  "duplicates_with",
  "missing_information",
  "research_verification",
  "compliance_flags",
  "reuse_status",
  "reuse_reason",
  "built",
  "source_reviewed",
  "founder_decisions",
];
const flat = (v) =>
  Array.isArray(v)
    ? v.map((x) => (typeof x === "object" ? Object.values(x).join(": ") : String(x))).join(" | ")
    : v && typeof v === "object"
      ? Object.values(v).join(": ")
      : String(v ?? "");
const cell = (v) => {
  const s = flat(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const rows = register.assets.map((a) => ({
  ...a,
  reuse_status: typeof a.reuse === "object" ? a.reuse.status : a.reuse,
  reuse_reason: typeof a.reuse === "object" ? a.reuse.reason : "",
}));
writeFileSync(
  "content/register.csv",
  [columns.join(","), ...rows.map((r) => columns.map((c) => cell(r[c])).join(","))].join("\n") +
    "\n",
);
console.log(`register: ${rows.length} assets`);
