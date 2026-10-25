// The founder's seven-day sales view. Every row says whether it's actually
// tracked, so "not connected yet" can never be mistaken for "no sales".

export interface RecentEvent {
  name: string;
  at: string;
  source: string | null;
  path: string | null;
  anonymousId: string | null;
}

export interface TrackingConfig {
  /** Gumroad ping, token and the Income Fit Test's product id are all set. */
  gumroadConnected: boolean;
  /** The Fit Check page's email opt-in is switched on. */
  emailOptInOn: boolean;
}

export type RowStatus = "tracked" | "partial" | "not_tracked";

export interface ReportRow {
  key: string;
  label: string;
  status: RowStatus;
  note: string;
  /** One count per day, oldest first; null when the row isn't tracked. */
  perDay: (number | null)[];
  total: number | null;
}

const VIEWS = new Set([
  "landing_viewed",
  "pricing_viewed",
  "fit_landing_viewed",
  "fit_check_viewed",
  "calculator_viewed",
  "offer_viewed",
]);

const dayKey = (iso: string) => iso.slice(0, 10);

export function sevenDayReport(
  events: RecentEvent[],
  now: Date,
  config: TrackingConfig,
): { days: string[]; rows: ReportRow[] } {
  const days = Array.from({ length: 7 }, (_, i) =>
    new Date(now.getTime() - (6 - i) * 86_400_000).toISOString().slice(0, 10),
  );
  const inWindow = events.filter((e) => days.includes(dayKey(e.at)));

  const count = (match: (e: RecentEvent) => boolean) => {
    const perDay = days.map((d) => inWindow.filter((e) => dayKey(e.at) === d && match(e)).length);
    return { perDay, total: perDay.reduce((a, b) => a + b, 0) };
  };
  const unique = (match: (e: RecentEvent) => boolean) => {
    const perDay = days.map(
      (d) =>
        new Set(
          inWindow
            .filter((e) => dayKey(e.at) === d && match(e) && e.anonymousId)
            .map((e) => e.anonymousId),
        ).size,
    );
    const total = new Set(
      inWindow.filter((e) => match(e) && e.anonymousId).map((e) => e.anonymousId),
    ).size;
    return { perDay, total };
  };
  const untracked = (key: string, label: string, note: string): ReportRow => ({
    key,
    label,
    status: "not_tracked",
    note,
    perDay: days.map(() => null),
    total: null,
  });
  const row = (
    key: string,
    label: string,
    status: RowStatus,
    note: string,
    c: { perDay: number[]; total: number },
  ): ReportRow => ({ key, label, status, note, ...c });

  const gumroadNote =
    "Gumroad isn't connected, so sales can't be seen here yet. This is not the same as zero sales: check Gumroad's own dashboard.";

  return {
    days,
    rows: [
      untracked(
        "website_visitors",
        "herlittleempire.com visitors",
        "The website's own analytics aren't connected to this dashboard.",
      ),
      row(
        "page_views",
        "Page views on Studio's public pages",
        "tracked",
        "Every view of the landing, pricing, FIT Finder, Fit Check, calculator and offer pages.",
        count((e) => VIEWS.has(e.name)),
      ),
      row(
        "visitors",
        "Unique visitors (who accepted analytics)",
        "partial",
        "Only visitors who accepted the cookie banner can be told apart, so this undercounts.",
        unique((e) => VIEWS.has(e.name)),
      ),
      row(
        "fit_check",
        "Fit Check: clicks to get it",
        "partial",
        "Clicks to download or to the free Gumroad listing. Completed Gumroad downloads are in Gumroad.",
        count(
          (e) =>
            e.name === "offer_clicked" && (e.path === "fit-check" || e.path === "fit-check-pdf"),
        ),
      ),
      row(
        "fit_finder",
        "FIT Finder completed",
        "tracked",
        "People who finished the 20 questions.",
        count((e) => e.name === "fit_completed"),
      ),
      config.emailOptInOn
        ? row(
            "email_consents",
            "Email follow-up: consents",
            "tracked",
            "People who ticked the box and asked for the emails.",
            count((e) => e.name === "email_consent_given"),
          )
        : untracked(
            "email_consents",
            "Email follow-up: consents",
            "The opt-in is switched off until a sender for the emails is set up.",
          ),
      row(
        "product_views",
        "Income Fit Test page views",
        "tracked",
        "Views of /income-fit-test.",
        count((e) => e.name === "offer_viewed" && e.path === "income-fit-test"),
      ),
      row(
        "checkout_starts",
        "Checkout starts (clicks to Gumroad)",
        "partial",
        "Clicks on a buy button for the Income Fit Test. Gumroad's own checkout steps aren't visible here.",
        count((e) => e.name === "offer_clicked" && e.path === "income-fit-test"),
      ),
      config.gumroadConnected
        ? row(
            "purchases",
            "Verified purchases",
            "tracked",
            "Sales looked up with Gumroad before they count.",
            count((e) => e.name === "purchase_verified"),
          )
        : untracked("purchases", "Verified purchases", gumroadNote),
      config.gumroadConnected
        ? row(
            "refunds",
            "Refunds",
            "tracked",
            "From Gumroad's refund notice or the daily recheck.",
            count((e) => e.name === "purchase_refunded"),
          )
        : untracked("refunds", "Refunds", gumroadNote),
    ],
  };
}
