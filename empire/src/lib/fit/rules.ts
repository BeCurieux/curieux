// "The rules where you live": the short country summaries from the Income
// Fit Test v1.4 report, word for word, with the date each country was
// checked and each line's label. The full chapters are in the kit's Rules
// Guide (06_Rules_Guides.pdf), where every item links to the official page;
// the official page is always the source of truth.
//
// General information, not legal, tax or financial advice. Re-check every
// line on or after each country's tax-year change before relying on it.

export type Label = "fact" | "est" | "unknown";

export interface CountryRules {
  checked: string;
  facts: { text: string; label: Label }[];
}

export const RULES: Record<string, CountryRules> = {
  Australia: {
    checked: "17 October 2026",
    facts: [
      {
        text: "An ABN is free through the Australian Business Register. Invoice another business without one and they generally withhold 47%.",
        label: "fact",
      },
      {
        text: "Sole-trader profit goes on your own tax return, taxed at your personal rates. Set money aside from each payment.",
        label: "fact",
      },
      {
        text: "GST registration is required once turnover reaches A$75,000 a year. Most people start well under it.",
        label: "fact",
      },
      {
        text: "Keep records of income and costs for five years. A separate bank account and a spreadsheet are enough to start.",
        label: "fact",
      },
      {
        text: "On Centrelink or the Child Care Subsidy? Business income is reported differently from wages. Read item 10 before you start.",
        label: "fact",
      },
    ],
  },
  "United States": {
    checked: "19 October 2026",
    facts: [
      {
        text: "Sole proprietors report on Schedule C. Net self-employment earnings of $400 or more mean filing and paying self-employment tax (15.3%).",
        label: "fact",
      },
      {
        text: "Sales tax is set by each state, with different rules and thresholds. Check your own state.",
        label: "fact",
      },
      {
        text: "Licence rules are set by your city, county and state, and vary. We couldn't confirm specifics, so check locally.",
        label: "unknown",
      },
      {
        text: "Platforms and clients may send you tax forms. Item 8 explains which.",
        label: "fact",
      },
    ],
  },
  "United Kingdom": {
    checked: "19 October 2026",
    facts: [
      {
        text: "The first £1,000 of trading income a year is tax-free (the trading allowance). Over that, register for Self Assessment.",
        label: "fact",
      },
      {
        text: "Making Tax Digital for Income Tax has applied to some sole traders since 6 April 2026, depending on income. Check item 5.",
        label: "fact",
      },
      { text: "VAT registration is required above £90,000 of taxable turnover.", label: "fact" },
      {
        text: "Platforms now report sellers' income to HMRC. Make sure your return matches.",
        label: "fact",
      },
    ],
  },
  Canada: {
    checked: "19 October 2026",
    facts: [
      {
        text: "Report sole-proprietor income on your personal return. You only need a Business Number when you register for a program account, such as GST/HST.",
        label: "fact",
      },
      {
        text: "You're a small supplier, with no need to register for GST/HST, while taxable revenue is $30,000 or less over four consecutive quarters.",
        label: "fact",
      },
      {
        text: "Business names and licences are provincial, and Quebec has its own system. Check your own province.",
        label: "fact",
      },
      { text: "Digital platforms have reported sellers' income since 2024.", label: "fact" },
    ],
  },
  "New Zealand": {
    checked: "19 October 2026",
    facts: [
      {
        text: "You need a personal IRD number. Tell Inland Revenue you've started working for yourself; an NZBN is optional.",
        label: "fact",
      },
      {
        text: "GST registration is required at NZ$60,000 turnover in any 12 months, measured on sales, not profit.",
        label: "fact",
      },
      {
        text: "Declare self-employed income in your individual return and set money aside for tax.",
        label: "fact",
      },
    ],
  },
};

export const DISCLAIMER =
  "General information, not legal, tax or financial advice. If your situation has a twist (benefits, a visa, a partner's business), talk to an accountant or the free services listed in your chapter.";
