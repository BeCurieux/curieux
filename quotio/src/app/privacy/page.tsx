import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site/Chrome";
import { Clause, LegalFooterLinks, LegalNotice, LegalUpdated, Operator } from "@/components/site/Legal";
import { brand } from "@/config/brand";
import { currentUser, isRegistered } from "@/lib/auth/session";
import { EVENT_TYPES } from "@/lib/analytics/events";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What we hold, who it belongs to, and how to get rid of it.",
};

const UPDATED = "13 August 2026";

/**
 * The privacy policy.
 *
 * Written from what the code does rather than from a template, because a
 * policy describing a product we don't have is the same lie as a feature we
 * don't have (§41). Two things in particular are true here and not true of
 * most policies, and they are worth saying plainly rather than burying:
 * visitor analytics carry no cookie and no IP address, and deleting something
 * really deletes it.
 *
 * The event list is rendered from EVENT_TYPES, so this page cannot drift away
 * from what the product actually records — the same trick the docs page uses.
 */
export default async function PrivacyPage() {
  const user = await currentUser();

  return (
    <>
      <SiteHeader signedIn={isRegistered(user)} />

      <main className="mx-auto max-w-2xl px-5 py-14">
        <p className="eyebrow">Legal</p>
        <h1 className="mt-2 text-title">Privacy</h1>
        <p className="mt-3 leading-relaxed text-slate">
          What we hold, who it belongs to, and how to get rid of it.
        </p>
        <LegalUpdated date={UPDATED} />
        <LegalNotice />

        <Clause title="Two different jobs">
          <p>
            {brand.name} does two things with personal data, and they have different rules.
          </p>
          <p>
            <strong className="text-navy">Your account is ours to look after.</strong> When you
            sign up, <Operator /> decides what happens to your email address and the widgets you
            build. We&rsquo;re the controller for that.
          </p>
          <p>
            <strong className="text-navy">Your visitors&rsquo; details are yours.</strong> When
            somebody fills in one of your widgets, those details are collected for you, on your
            instructions. You decide what to ask for and what to do with the answers, which makes
            you the controller and us the processor. We don&rsquo;t market to them, sell them,
            profile them, or use them for anything except handing them to you.
          </p>
        </Clause>

        <Clause title="What we hold about you">
          <ul className="ml-4 list-disc space-y-1.5">
            <li>Your email address, and a hashed version of your password. We never store the password itself.</li>
            <li>The widgets you build, including drafts you never publish.</li>
            <li>Which plan you&rsquo;re on, and how many interactions you&rsquo;ve used this month.</li>
            <li>Sessions, so you stay signed in.</li>
            <li>
              What you type into the prompt box, which is sent to our AI provider to build the
              widget you asked for.
            </li>
          </ul>
        </Clause>

        <Clause title="What we hold about your visitors">
          <p>
            Only two things, and the first is deliberately anonymous.
          </p>
          <p>
            <strong className="text-navy">Analytics.</strong> {EVENT_TYPES.length} kinds of event,
            each carrying the widget, a random per-tab id, a timestamp, and the question where the
            event is about one. That id lives in{" "}
            <code className="font-mono text-xs">sessionStorage</code> and disappears when the tab
            closes. It exists so we can tell one person answering five questions from five people
            answering one.
          </p>
          <p>
            <strong className="text-navy">No cookies, no IP addresses, no third-party pixels, no
            cross-site tracking.</strong> A published widget sets nothing that survives the tab and
            records nothing that identifies the machine. This is a design decision, not a setting —
            there is nowhere in the product to turn it on.
          </p>
          <p>
            <strong className="text-navy">Leads.</strong> Whatever you configured your widget to
            ask for — some combination of name, email, phone and a message — plus the answers that
            produced their result, so the lead reaches you with its context attached. Nothing
            else is collected alongside it.
          </p>
        </Clause>

        <Clause title="Who else sees it">
          <p>
            As few as we can manage, and none of them for their own purposes:
          </p>
          <ul className="ml-4 list-disc space-y-1.5">
            <li>
              <strong className="text-navy">Our hosting and database provider</strong>, which stores
              everything above.
            </li>
            <li>
              <strong className="text-navy">Our AI provider</strong>, which receives what you type
              into the prompt box in order to build a widget. Visitor data is never sent to it.
            </li>
            <li>
              <strong className="text-navy">Our email provider</strong>, which receives the address
              a message is going to and its contents — password reset links, and the lead
              notifications you can switch off per widget.
            </li>
            <li>
              <strong className="text-navy">Our payment provider</strong>, if you upgrade. Card
              details go to them directly and never touch our servers.
            </li>
          </ul>
          <p>We don&rsquo;t sell data to anybody, and there is no advertising in this product.</p>
        </Clause>

        <Clause title="Getting rid of it">
          <p>
            Deletion here is real, not a flag we stop showing you:
          </p>
          <ul className="ml-4 list-disc space-y-1.5">
            <li>
              <strong className="text-navy">Delete a widget</strong> and its analytics and leads
              go with it.
            </li>
            <li>
              <strong className="text-navy">Close your account</strong> — from Settings — and your
              widgets, their analytics, every lead, and your sessions go too. Anything embedded
              on a page stops working immediately. We can&rsquo;t undo it.
            </li>
          </ul>
          <p>
            We keep what we need for as long as your account is open, and no longer. If you want a
            copy of what we hold, or want us to correct or delete something, write to{" "}
            <a href={`mailto:${brand.supportEmail}`} className="font-semibold text-purple">
              {brand.supportEmail}
            </a>{" "}
            and a person will answer.
          </p>
        </Clause>

        <Clause title="If you're the visitor">
          <p>
            You filled in a widget on somebody&rsquo;s website and your details came to us. The
            business that runs that widget decides what happens to them — ask them first. If you
            can&rsquo;t reach them, write to us and we&rsquo;ll help you get there.
          </p>
        </Clause>

        <Clause title="Your obligations, if you use this on your site">
          <p>
            You&rsquo;re the controller for the leads your widgets collect, which means the
            usual things are yours to do: tell your visitors what you&rsquo;re collecting and why,
            have a lawful basis for it, and honour their requests. Your widget&rsquo;s privacy note
            is editable for exactly this reason — the default text is a starting point, not advice.
          </p>
        </Clause>

        <LegalFooterLinks current="privacy" />
      </main>

      <SiteFooter />
    </>
  );
}
