// What Ovyko's emails say (docs/M6_MIGRATION_PILOT.md, M6c). Pure, so it is
// tested directly. Subjects and previews never name a child, a skill, a
// health detail or a place (docs/SECURITY.md, "Neutral notifications"):
// they show on lock screens and in shared inboxes. The details are in
// Ovyko, after sign-in.

import { outboundMessage } from "@/lib/domain/notifications";

export type Email = { subject: string; preview: string; text: string; html: string };

type Paragraph = string | { button: string; href: string } | { small: string };

const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

function build(subject: string, preview: string, paragraphs: Paragraph[]): Email {
  const text = paragraphs
    .map((p) => (typeof p === "string" ? p : "button" in p ? `${p.button}: ${p.href}` : p.small))
    .join("\n\n");
  const body = paragraphs
    .map((p) =>
      typeof p === "string"
        ? `<p style="margin:0 0 16px;font-size:16px;line-height:1.5">${escape(p)}</p>`
        : "button" in p
          ? `<p style="margin:24px 0"><a href="${escape(p.href)}" style="display:inline-block;background:#1f2333;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:999px">${escape(p.button)}</a></p>`
          : `<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#6b6f80">${escape(p.small)}</p>`,
    )
    .join("");
  const html = `<!doctype html><html><body style="margin:0;background:#f6f5f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2333"><span style="display:none;max-height:0;overflow:hidden">${escape(preview)}</span><div style="max-width:520px;margin:0 auto;padding:32px 24px"><p style="margin:0 0 24px;font-weight:700;font-size:18px">ovyko</p>${body}</div></body></html>`;
  return { subject, preview, text: `${text}\n\n— Ovyko`, html };
}

const school = (name: string) => name.trim() || "your activity provider";

export function spotOffered(p: { school: string; heldUntil: string; claimUrl: string }): Email {
  const from = school(p.school);
  return build(`A spot has opened at ${from}`, "Sign in to Ovyko to see it.", [
    `A spot has opened in a class at ${from}, and it's being held for your family until ${p.heldUntil}.`,
    { button: "See the spot", href: p.claimUrl },
    { small: "If you don't want it, you can say no thanks and it goes to another family." },
  ]);
}

export function lessonCancelled(p: { school: string; day: string; url: string }): Email {
  const from = school(p.school);
  return build(`A lesson at ${from} has been cancelled`, "Sign in to Ovyko to see the details.", [
    `${from} has cancelled a lesson on ${p.day}. Where make-ups are offered, your child has a make-up credit to use.`,
    { button: "See the details", href: p.url },
  ]);
}

export function skillAchieved(p: { school: string; url: string }): Email {
  const { subject, preview } = outboundMessage(p.school);
  return build(subject, preview, [
    `There's a new progress update from ${school(p.school)}.`,
    { button: "See it in Ovyko", href: p.url },
  ]);
}

export function lessonReminder(p: {
  school: string;
  lessons: { activity: string; time: string }[];
  url: string;
  settingsUrl: string;
}): Email {
  const from = school(p.school);
  const [first] = p.lessons;
  const subject =
    p.lessons.length === 1 && first
      ? `${first.activity} today at ${first.time}`
      : `${p.lessons.length} lessons today, from ${first?.time ?? ""}`;
  return build(subject, `From ${from}. Can't make it? Let them know in Ovyko.`, [
    `Today at ${from}:`,
    ...p.lessons.map((l) => `${l.activity} at ${l.time}`),
    "Can't make it? Let them know in Ovyko and you may get a make-up.",
    { button: "Open Ovyko", href: p.url },
    { small: `You get this on lesson days. Turn it off in Account: ${p.settingsUrl}` },
  ]);
}

export function invite(p: { school: string; family: string; joinUrl: string }): Email {
  const from = school(p.school);
  const family = p.family.replace(/ family$/i, "");
  return build(`${from} invited you to Ovyko`, "Join your family in one step.", [
    `${from} uses Ovyko for its classes, and has invited you to join the ${family} family.`,
    "You'll see your children's classes, tell them when they can't make it, and book make-ups, all in one place.",
    { button: "Join", href: p.joinUrl },
    {
      small:
        "This link works once, for 14 days. If you weren't expecting it, you can ignore this email.",
    },
  ]);
}

// Next term (M6e). Neutral like the rest: no child, class or place named.
export function reenrolmentAsk(p: {
  school: string;
  term: string;
  replyBy: string | null;
  url: string;
}): Email {
  const from = school(p.school);
  return build(`${from}: are you staying for ${p.term}?`, "Answer in one tap in Ovyko.", [
    `${from} is asking families whether they're keeping their places for ${p.term}.`,
    p.replyBy
      ? `Please answer by ${p.replyBy}. It takes one tap per child.`
      : "It takes one tap per child.",
    { button: "Answer in Ovyko", href: p.url },
    { small: "If you don't answer, your places are kept." },
  ]);
}

export function reenrolmentReminder(p: {
  school: string;
  term: string;
  replyBy: string | null;
  url: string;
}): Email {
  const from = school(p.school);
  return build(`Reminder: ${p.term} at ${from}`, "Let them know if you're staying.", [
    `${from} hasn't heard from you about ${p.term} yet.`,
    p.replyBy ? `Please answer by ${p.replyBy}.` : "Please answer when you can.",
    { button: "Answer in Ovyko", href: p.url },
    { small: "If you don't answer, your places are kept." },
  ]);
}

export function paymentReceipt(p: {
  school: string;
  amount: string;
  method: string;
  paidOn: string;
  reference: string;
  url: string;
}): Email {
  const from = school(p.school);
  return build(`Receipt from ${from}`, `Payment received: ${p.amount}.`, [
    `${from} has received your payment of ${p.amount}. Thank you.`,
    `Paid ${p.paidOn}, by ${p.method.toLowerCase()}. Reference: ${p.reference}.`,
    { button: "See your statement", href: p.url },
    { small: "Payments are made to your activity provider through Stripe." },
  ]);
}

export function feeReminder(p: {
  school: string;
  stage: "soon" | "due" | "overdue";
  amount: string;
  dueOn: string;
  url: string;
}): Email {
  const from = school(p.school);
  const lead = {
    soon: `You have ${p.amount} to pay to ${from}, due ${p.dueOn}.`,
    due: `${p.amount} is due to ${from} today.`,
    overdue: `${p.amount} was due to ${from} on ${p.dueOn} and hasn't been paid yet.`,
  }[p.stage];
  return build(
    p.stage === "overdue" ? `Fees overdue at ${from}` : `Fees from ${from}`,
    "See your fees in Ovyko.",
    [
      lead,
      { button: "See your fees", href: p.url },
      {
        small:
          p.stage === "overdue"
            ? "If you've paid in the last few days, thank you: it can take a little while to show."
            : `${from} sends fee reminders through Ovyko. If you've just paid, you can ignore this.`,
      },
    ],
  );
}

export function paymentFailed(p: {
  school: string;
  amount: string;
  url: string;
  method: "card" | "direct_debit";
  instalment: boolean;
}): Email {
  const from = school(p.school);
  const what = p.method === "card" ? "card payment" : "direct debit";
  return build("A payment didn't go through", "You can pay again in Ovyko.", [
    `Your ${p.instalment ? "instalment" : what} of ${p.amount} to ${from} didn't go through. Your ${p.method === "card" ? "card's bank" : "bank"} can tell you why.`,
    p.instalment
      ? "Nothing has been taken, and the rest of your instalments are cancelled. What's left is simply owed; you can pay it by card or direct debit."
      : "Nothing has been taken. You can pay again by card or direct debit.",
    { button: "Pay again", href: p.url },
  ]);
}
