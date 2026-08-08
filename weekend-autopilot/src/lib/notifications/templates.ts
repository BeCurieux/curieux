/**
 * Email templates (§23, §24).
 *
 * Hand-written HTML rather than a component library, because email clients are
 * not browsers: tables, inline styles, no flexbox, no web fonts. The design
 * language still holds — warm paper, charcoal type, one accent, no photograph
 * required (§54) — because the email is the product’s front door on a Thursday
 * morning and it has to feel like the same thing as the app.
 *
 * Every customer-facing string comes from the brand config (§brand): no
 * hard-coded product name lives in here.
 */

import { brand, url } from "@/config/brand";
import { formatDistance, formatMoneyRange, type Market } from "@/config/markets";
import type { PlanWithItems } from "@/lib/types";
import { displayDate, displayTime } from "@/lib/util/time";

const PAPER = "#FBF8F3";
const INK = "#22201D";
const GRAPHITE = "#4A4742";
const MIST = "#8A857D";
const FOREST = "#22503F";
const RULE = "#E6E0D6";

const SERIF = "'Iowan Old Style', Palatino, Georgia, serif";
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

// ------------------------------------------------------------ weekly plan

/**
 * The Thursday email. Its only job is to make someone think "oh, that’s a good
 * idea" and tap through — so it carries the shape of the day, the four facts
 * that decide whether it is on (weather, cost, effort, distance) and nothing
 * else. Full detail lives in the app (§23).
 */
export function weeklyPlanEmail(input: {
  plan: PlanWithItems;
  backup: PlanWithItems | null;
  market: Market;
  recipientName: string | null;
  unsubscribeUrl: string;
}): RenderedEmail {
  const { plan, backup, market } = input;

  const dateLabel = displayDate(plan.weekend_date, market.locale, market.timezone);
  const planUrl = url(`/app/plans/${plan.id}`);

  const stops = plan.items.filter((i) => i.item_type !== "TRAVEL" && i.item_type !== "BREAK");

  const badges = [
    plan.weather_summary,
    formatMoneyRange(market, Number(plan.estimated_total_cost_min), Number(plan.estimated_total_cost_max)),
    activityWord(plan.activity_level),
    plan.total_activity_distance_km > 0
      ? formatDistance(market, plan.total_activity_distance_km)
      : null,
    `${plan.total_travel_minutes} min from home`,
  ].filter((b): b is string => Boolean(b));

  const html = shell(`
    <tr><td style="padding:0 32px">
      <p style="margin:0 0 6px;font:600 12px/1.4 ${SANS};letter-spacing:.14em;text-transform:uppercase;color:${MIST}">
        Your Saturday is sorted
      </p>
      <h1 style="margin:0 0 10px;font:400 30px/1.18 ${SERIF};color:${INK}">
        ${escape(plan.title)}
      </h1>
      <p style="margin:0 0 22px;font:400 16px/1.55 ${SANS};color:${GRAPHITE}">
        ${escape(plan.short_description)}
      </p>
    </td></tr>

    <tr><td style="padding:0 32px 8px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="border-top:1px solid ${RULE};border-bottom:1px solid ${RULE}">
        ${stops.map((item) => timelineRow(displayTime(item.start_time), item.title)).join("")}
      </table>
    </td></tr>

    <tr><td style="padding:20px 32px 0">
      <p style="margin:0;font:400 14px/1.9 ${SANS};color:${GRAPHITE}">
        ${badges.map((b) => `<span style="white-space:nowrap">${escape(b)}</span>`).join(
          `<span style="color:${RULE}"> &nbsp;·&nbsp; </span>`
        )}
      </p>
      <p style="margin:6px 0 0;font:400 12px/1.5 ${SANS};color:${MIST}">
        Costs are estimates. Times are a suggestion, not a schedule.
      </p>
    </td></tr>

    ${
      plan.fit_reason
        ? `<tr><td style="padding:22px 32px 0">
             <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
               <tr><td style="border-left:2px solid ${FOREST};padding:2px 0 2px 14px">
                 <p style="margin:0;font:400 15px/1.6 ${SERIF};color:${GRAPHITE};font-style:italic">
                   ${escape(plan.fit_reason)}
                 </p>
               </td></tr>
             </table>
           </td></tr>`
        : ""
    }

    <tr><td style="padding:28px 32px 0">
      ${button(planUrl, "Open the plan")}
    </td></tr>

    ${
      backup
        ? `<tr><td style="padding:26px 32px 0">
             <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                    style="background:#FFFFFF;border:1px solid ${RULE};border-radius:14px">
               <tr><td style="padding:16px 18px">
                 <p style="margin:0 0 4px;font:600 11px/1.4 ${SANS};letter-spacing:.12em;text-transform:uppercase;color:${MIST}">
                   Too tired?
                 </p>
                 <p style="margin:0 0 10px;font:400 16px/1.4 ${SERIF};color:${INK}">
                   ${escape(backup.title)}
                 </p>
                 <a href="${url(`/app/plans/${backup.id}`)}"
                    style="font:600 14px/1 ${SANS};color:${FOREST};text-decoration:none">
                   Show me the easy version →
                 </a>
               </td></tr>
             </table>
           </td></tr>`
        : ""
    }

    <tr><td style="padding:30px 32px 0">
      <p style="margin:0;font:400 13px/1.6 ${SANS};color:${MIST}">
        ${escape(dateLabel)} · ${escape(market.display_name)}
      </p>
    </td></tr>
  `, input.unsubscribeUrl);

  const text = [
    `Your Saturday is sorted`,
    ``,
    plan.title,
    plan.short_description,
    ``,
    ...stops.map((i) => `${displayTime(i.start_time)}  ${i.title}`),
    ``,
    badges.join(" · "),
    `Costs are estimates.`,
    ``,
    plan.fit_reason,
    ``,
    `Open the plan: ${planUrl}`,
    backup ? `\nToo tired? ${backup.title}: ${url(`/app/plans/${backup.id}`)}` : "",
    ``,
    `${brand.name} · ${dateLabel}`,
    `Unsubscribe: ${input.unsubscribeUrl}`,
  ].join("\n");

  return { subject: subjectFor(plan), html, text };
}

/** Rotated so the inbox does not show the same line every week (§23). */
function subjectFor(plan: PlanWithItems): string {
  const options = [
    "Your Saturday is sorted.",
    "Your weekend is ready.",
    "We planned this one for you.",
  ];
  // Deterministic per plan, varied across weeks.
  const index = [...plan.id].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % options.length;
  return options[index] ?? options[0]!;
}

// ------------------------------------------------------------ feedback

/**
 * Sunday evening (§24). The buttons are links that record the answer directly,
 * so answering costs one tap and no page load — the "did you do it?" rate is
 * the north-star metric, and every extra step costs us data we need.
 */
export function feedbackRequestEmail(input: {
  plan: PlanWithItems;
  market: Market;
  token: string;
  unsubscribeUrl: string;
}): RenderedEmail {
  const yes = url(`/app/plans/${input.plan.id}/feedback?did=yes&t=${input.token}`);
  const no = url(`/app/plans/${input.plan.id}/feedback?did=no&t=${input.token}`);

  const html = shell(`
    <tr><td style="padding:0 32px">
      <h1 style="margin:0 0 12px;font:400 28px/1.2 ${SERIF};color:${INK}">Did you do it?</h1>
      <p style="margin:0 0 24px;font:400 16px/1.55 ${SANS};color:${GRAPHITE}">
        ${escape(input.plan.title)}
      </p>
    </td></tr>
    <tr><td style="padding:0 32px">
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding-right:10px">${button(yes, "Yes")}</td>
          <td>${button(no, "No", true)}</td>
        </tr>
      </table>
    </td></tr>
    <tr><td style="padding:24px 32px 0">
      <p style="margin:0;font:400 13px/1.6 ${SANS};color:${MIST}">
        One tap is all we need. It is the only thing that makes next weekend better.
      </p>
    </td></tr>
  `, input.unsubscribeUrl);

  const text = [
    `Did you do it?`,
    ``,
    input.plan.title,
    ``,
    `Yes: ${yes}`,
    `No:  ${no}`,
    ``,
    `Unsubscribe: ${input.unsubscribeUrl}`,
  ].join("\n");

  return { subject: `Did you do it?`, html, text };
}

// ------------------------------------------------------------ lifecycle

export function welcomeEmail(input: {
  onboardingUrl: string;
  firstDeliveryLabel: string;
  unsubscribeUrl: string;
}): RenderedEmail {
  const html = shell(`
    <tr><td style="padding:0 32px">
      <h1 style="margin:0 0 12px;font:400 28px/1.2 ${SERIF};color:${INK}">
        ${escape(brand.tagline)}
      </h1>
      <p style="margin:0 0 20px;font:400 16px/1.6 ${SANS};color:${GRAPHITE}">
        Tell us a few things about your weekends — it takes about three minutes — and
        your first plan will land ${escape(input.firstDeliveryLabel)}.
      </p>
    </td></tr>
    <tr><td style="padding:0 32px">${button(input.onboardingUrl, "Set up my weekends")}</td></tr>
  `, input.unsubscribeUrl);

  const text = [
    brand.tagline,
    ``,
    `Set up your weekends: ${input.onboardingUrl}`,
    `Your first plan arrives ${input.firstDeliveryLabel}.`,
  ].join("\n");

  return { subject: `Welcome — let’s plan your weekends`, html, text };
}

/** Sent when we could not build something we would genuinely recommend (§39). */
export function generationFailedEmail(input: { unsubscribeUrl: string }): RenderedEmail {
  const html = shell(`
    <tr><td style="padding:0 32px">
      <h1 style="margin:0 0 12px;font:400 26px/1.25 ${SERIF};color:${INK}">
        We’re still working on this weekend
      </h1>
      <p style="margin:0 0 18px;font:400 16px/1.6 ${SANS};color:${GRAPHITE}">
        We couldn’t build one we’d genuinely recommend yet, so we haven’t sent you
        something mediocre. We’re checking again and will be in touch shortly.
      </p>
      <p style="margin:0;font:400 14px/1.6 ${SANS};color:${MIST}">
        If this happens twice, reply to this email and a human will sort it out.
      </p>
    </td></tr>
  `, input.unsubscribeUrl);

  return {
    subject: "We’re still working on this weekend",
    html,
    text:
      "We couldn’t build a weekend we’d genuinely recommend yet, so we haven’t sent " +
      "you something mediocre. We’re checking again and will be in touch shortly.",
  };
}

export function pilotEndingEmail(input: {
  weekendsDone: number;
  didItCount: number;
  upgradeUrl: string;
  unsubscribeUrl: string;
}): RenderedEmail {
  const html = shell(`
    <tr><td style="padding:0 32px">
      <h1 style="margin:0 0 12px;font:400 28px/1.2 ${SERIF};color:${INK}">
        That’s four weekends
      </h1>
      <p style="margin:0 0 18px;font:400 16px/1.6 ${SANS};color:${GRAPHITE}">
        You did ${input.didItCount} of them. Every one taught us something about what
        actually works for you — which is why the next four would be better than the
        last four.
      </p>
    </td></tr>
    <tr><td style="padding:0 32px">${button(input.upgradeUrl, "Keep going")}</td></tr>
  `, input.unsubscribeUrl);

  return {
    subject: "That’s four weekends — keep going?",
    html,
    text: `You did ${input.didItCount} of your four weekends. Keep going: ${input.upgradeUrl}`,
  };
}

// ------------------------------------------------------------ shell

function shell(content: string, unsubscribeUrl: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${escape(brand.name)}</title></head>
<body style="margin:0;padding:0;background:${PAPER}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER}">
    <tr><td align="center" style="padding:36px 12px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:560px;background:${PAPER}">
        <tr><td style="padding:0 32px 26px">
          <span style="font:600 13px/1 ${SANS};letter-spacing:.2em;text-transform:uppercase;color:${FOREST}">
            ${escape(brand.name)}
          </span>
        </td></tr>
        ${content}
        <tr><td style="padding:34px 32px 0">
          <table role="presentation" width="100%"><tr>
            <td style="border-top:1px solid ${RULE};padding-top:16px">
              <p style="margin:0;font:400 12px/1.7 ${SANS};color:${MIST}">
                ${escape(brand.name)} · <a href="mailto:${brand.supportEmail}"
                  style="color:${MIST}">${escape(brand.supportEmail)}</a><br>
                <a href="${unsubscribeUrl}" style="color:${MIST}">Unsubscribe</a>
              </p>
            </td>
          </tr></table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function timelineRow(time: string, title: string): string {
  return `<tr>
    <td width="72" valign="top" style="padding:13px 0 13px 0;border-bottom:1px solid ${RULE}">
      <span style="font:400 14px/1.4 ${SANS};color:${MIST};font-variant-numeric:tabular-nums">${escape(time)}</span>
    </td>
    <td valign="top" style="padding:13px 0;border-bottom:1px solid ${RULE}">
      <span style="font:400 16px/1.4 ${SANS};color:${INK}">${escape(title)}</span>
    </td>
  </tr>`;
}

function button(href: string, label: string, secondary = false): string {
  const background = secondary ? "#FFFFFF" : FOREST;
  const colour = secondary ? INK : "#FFFFFF";
  const border = secondary ? `border:1px solid ${RULE};` : "";
  return `<a href="${href}" style="display:inline-block;background:${background};color:${colour};
    ${border}font:600 15px/1 ${SANS};padding:14px 22px;border-radius:10px;text-decoration:none">
    ${escape(label)}</a>`;
}

function activityWord(level: string): string {
  const words: Record<string, string> = {
    GENTLE: "Gentle",
    EASY: "Easy",
    MODERATE: "Moderate",
    ACTIVE: "Active",
  };
  return words[level] ?? "Easy";
}

function escape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
