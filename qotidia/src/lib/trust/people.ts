// Who is behind this, and how you can tell.
//
// The brief asked for named humans on the About page, and the reason it is
// worth doing is not the one people usually give. A name on your own About
// page is worth almost nothing — anybody can type a name, and a stock
// portrait under it costs eleven dollars. What a customer is actually trying
// to work out is whether a person exists who can be found and, if it comes to
// it, held to something.
//
// So the rule here is stricter than "put a name on the page":
//
//   **A person is only listed if they can be found somewhere that is not
//   us.** A personal site, a professional profile, a code repository —
//   anywhere the claim can be checked against something we do not control.
//   named() enforces it, and tests/about.test.ts checks that the page reads
//   through named() rather than the raw list.
//
//   **Nothing is invented.** No name, no portrait, no advisory board, no
//   "founded in" story. The list ships empty and its one seat is filled by
//   the person it describes. A fabricated human on the page whose job is to
//   prove a real human exists is the failure the page exists to prevent,
//   and it is a failure with a face on it.
//
// Until the seat is filled the About page still works: everything on it
// except the name is true today and says so. That is deliberate — an About
// page that cannot ship without a name would have pushed the whole thing
// behind one missing string.

import { FOUNDER } from "@/lib/trust/founder";

export interface Elsewhere {
  /** What the link is — "Personal site", "GitHub". */
  what: string;
  url: string;
}

export interface Person {
  name: string;
  /** What they actually do here, in ordinary words. Not a job title. */
  does: string;
  /**
   * Somewhere they exist that is not this website.
   *
   * Required. A name only we vouch for is a name we typed.
   */
  elsewhere: Elsewhere[];
}

/**
 * The people. One seat, and it is not filled in the repository.
 *
 * Fill in FOUNDER.name in lib/trust/founder.ts and add at least one link
 * below, and this person appears here, on /help, and on the foot of
 * /promise. Both halves are needed: a name with nowhere to check it does not
 * pass named().
 */
export const PEOPLE: Person[] = [
  {
    name: FOUNDER.name,
    does: "Writes the software, answers the email, and decides what gets built next.",
    elsewhere: [],
  },
];

/**
 * The ones we may actually name.
 *
 * A person needs a name and at least one place off this website. Anything
 * else is a claim about a human being that a reader has no way to test,
 * which is the same category of thing as a security badge.
 */
export const named = () => PEOPLE.filter((p) => p.name.trim() !== "" && p.elsewhere.length > 0);

/**
 * How many people work on this. One.
 *
 * Stated rather than implied, because the implication otherwise runs the
 * wrong way: a product with a privacy page, a printing pipeline and a
 * succession policy reads like a company, and a family should know it is
 * one person before they decide how much to depend on it.
 */
export const HOW_MANY = 1;

/** Where the working day is. Same source as the reply promise. */
export const WHERE = FOUNDER.timezone;
