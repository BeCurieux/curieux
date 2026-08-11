// The homepage, as content rather than as markup.
//
// The page is one continuous argument in eleven movements, and the argument
// is the part worth keeping in a module: what is claimed, in what order, and
// which claims are ours to make. Markup can be rewritten in an afternoon.
//
// Two things live here because they must not be improvised in JSX.
//
// **The forgotten details.** Every example of a "little thing" on this site
// is invented for Florence, the fictional family in the seed. They read like
// somebody's real child on purpose, which is exactly why they need to be in
// one place with that stated, rather than sprinkled through a page where the
// next person to edit one will assume they came from a customer.
//
// **The parent stories.** There are none, and the section renders nothing
// until there are. See below.

// FORGOTTEN lived here — five things a photograph does not hold. It was the
// same list as QOTIDIA_ALSO_KEEPS below, minus the foil that makes it land,
// and the two rendered two thousand pixels apart on one page. "The yellow
// boots" was in both, and in the demonstration between them. The contrast
// pair survived; the bare list did not.

/** What a photo book keeps. Uncontroversial, and the point of the contrast. */
export const A_PHOTOBOOK_KEEPS = [
  "The birthday",
  "The holiday",
  "Christmas",
  "The beach",
];

/** What this keeps as well. Same fictional family, same rule. */
export const QOTIDIA_ALSO_KEEPS = [
  "What she called the dog",
  "The cup she demanded every morning",
  "Her three-song phase",
  "Who she wanted when she was tired",
  "The yellow boots",
  "How she laughed",
  "What an ordinary Tuesday felt like",
];

/**
 * The signature demonstration, in four beats.
 *
 * photograph → the thing noticed → the question asked → the answer given →
 * the page it becomes. Every other way of describing this product reaches
 * for words like clustering and extraction, which are infrastructure. This
 * is what the customer experiences.
 *
 * The question is phrased the way the product actually phrases questions:
 * it states a count and asks whether there is a story, rather than telling
 * the parent what it means. See lib/prompts/engine.ts.
 */
export const DEMONSTRATION = {
  eyebrow: "Qotidia noticed",
  heading: ["The yellow boots", "kept showing up."],
  question:
    "Florence wore these in 17 photographs between March and June. Was there a story behind them?",
  answer:
    "She called them her jumping boots. For three months she insisted on " +
    "wearing them everywhere — including to bed, twice.",
  becomes: "The year of yellow boots",
  /** Said on the page, because the family in it is invented. */
  disclosure:
    "Florence is the made-up family in our own test data. The mechanism is " +
    "real; the child is not.",
};

export interface ParentStory {
  /** The specific thing they had forgotten. Never "amazing app, so easy". */
  quote: string;
  /** First name and relationship, as they gave it. */
  attribution: string;
  /** The slot in public/sample this story's photograph lives in. */
  image: string;
}

/**
 * Parent stories. Deliberately empty.
 *
 * This section renders nothing until there are real ones, and that is not a
 * placeholder waiting to be filled with something plausible. Inventing
 * "Anna, Florence's mum" and putting her beside a photograph on a page that
 * takes payment is a fabricated review — it does not stop being one because
 * the product is good or because everybody does it. It is also the single
 * worst thing this particular company could be caught doing, given that the
 * entire proposition is "we will not invent your family's memories".
 *
 * When there are real ones: get them in writing, with permission for the
 * quote and for the photograph, and keep the specific detail rather than
 * tidying it into marketing prose. "I could remember the holiday. I couldn't
 * remember what she called strawberries" is worth more than any adjective.
 */
export const PARENT_STORIES: ParentStory[] = [];
