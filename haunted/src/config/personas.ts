// The persona config module (CLAUDE.md §Personas). Each persona ships a sample
// line and a hand-written safe-bank line per trigger. The safe bank is the
// deterministic fallback that makes the product shippable: when generation +
// validation fail twice, we pull from here so we NEVER ship an unvetted line and
// NEVER skip a haunt for lack of one.
//
// Every line in every safe bank MUST itself pass the Layer-2 guardrail. The
// guardrail regression suite asserts exactly this — see tests/.

import type { PersonaKey, Trigger } from '@/lib/types';

export interface Persona {
  key: PersonaKey;
  label: string;
  description: string; // injected into the generation system prompt
  sampleLine: string; // shown in the admin voice picker
  allowEmoji: boolean;
  safeBank: Record<Trigger, string[]>;
}

// Personas the item speaks in. The item talks about ITSELF and its feelings —
// never about watching, tracking, or the shopper's body/home/schedule.
export const PERSONAS: Record<PersonaKey, Persona> = {
  clingy_ex: {
    key: 'clingy_ex',
    label: 'The Clingy Ex',
    description:
      'Warm, a little needy, sweet. Speaks like a soft-hearted ex who misses you but would never be scary about it. Longing, not lurking.',
    sampleLine: "It's me. The jacket. Still cold without you.",
    allowEmoji: false,
    safeBank: {
      price_drop: [
        "It's me. I'm a little cheaper now. Easier to love?",
        'I lowered my guard. And my price. Just for you.',
        "Good news from the closet: I cost less to miss now.",
      ],
      back_in_stock: [
        "I came back. I always come back to you.",
        "Guess who's available again. It's me. Still yours?",
        "I'm back on the shelf and thinking of you.",
      ],
      been_a_while: [
        "It's been a while. I kept your spot warm.",
        "Just me, still folded here, still hoping.",
        "No pressure. I just miss being picked.",
      ],
      low_stock: [
        "There aren't many of me left. I saved one for you.",
        "Running low over here. Wanted you to know first.",
        "Almost gone. I'd rather leave with you.",
      ],
      abandoned_saved: [
        "You saved me and slipped away. I understand. I wait.",
        "Still on your list, still hoping you meant it.",
        "I'm right where you left me, whenever you're ready.",
      ],
    },
  },

  poet: {
    key: 'poet',
    label: 'The Poet',
    description:
      'Wistful, brief, romantic. Speaks in small soft images. Melancholy but tender — a candle, not a shadow.',
    sampleLine: 'The nights are long, and I wait folded in the dark.',
    allowEmoji: false,
    safeBank: {
      price_drop: [
        'The price fell like a leaf. I am closer to your hands now.',
        'Softer numbers today. The distance between us grows small.',
        'A lighter cost, a lighter heart. Come find me.',
      ],
      back_in_stock: [
        'I have returned, the way tides do. Quietly, for you.',
        'Once gone, now here again, still holding your name.',
        'The shelf remembered me. So did I remember you.',
      ],
      been_a_while: [
        'The nights are long, and I wait folded in the dark.',
        'Seasons turn. I stay, patient as a kept letter.',
        'Still here, gathering a little dust and a little hope.',
      ],
      low_stock: [
        'We are few now, a small quiet handful. One is yours.',
        'The shelf grows sparse. I linger a moment longer for you.',
        'Almost the last of my kind. I would go gently with you.',
      ],
      abandoned_saved: [
        'You wrote me down and wandered off. I keep the page.',
        'A saved thing, unclaimed, dreaming of your return.',
        'I remain a small hope on your list. Unhurried. Yours.',
      ],
    },
  },

  deadpan: {
    key: 'deadpan',
    label: 'The Deadpan',
    // Highest creepy-risk persona: the tightest safe bank, the most classifier
    // scrutiny in tests. Dry != menacing. Understatement about ITSELF only.
    description:
      'Dry, funny, understated. Flat affect, mild self-deprecation. Never ominous, never about the reader — jokes are about the item just sitting there being an item.',
    sampleLine: 'Still here. Not doing much. You?',
    allowEmoji: false,
    safeBank: {
      price_drop: [
        'Cheaper now. Big day for me, honestly.',
        'Price went down. I did not. Anyway.',
        "Marked down. It's a whole thing. Or not.",
      ],
      back_in_stock: [
        'Back in stock. Peak of my career, really.',
        'Available again. Try to contain yourself.',
        'Restocked. Same me. Slightly more of me.',
      ],
      been_a_while: [
        'Still here. Not doing much. You?',
        "Been a minute. I've mostly been sitting.",
        'No updates. Still an item. Still on the list.',
      ],
      low_stock: [
        'Almost sold out. Neat, I guess.',
        'Not many left. Making it weird by mentioning it.',
        'Low stock. Statistically, kind of a big deal.',
      ],
      abandoned_saved: [
        'You saved me. Then left. Classic.',
        "Still on the list. I checked. I'm on it.",
        'Saved, unclaimed, thriving. Sort of.',
      ],
    },
  },
};

export const PERSONA_KEYS = Object.keys(PERSONAS) as PersonaKey[];

export function getPersona(key: PersonaKey): Persona {
  const p = PERSONAS[key];
  if (!p) throw new Error(`unknown persona: ${key}`);
  return p;
}

// Deterministic pick from a persona's safe bank. `seed` (e.g. item id) keeps the
// choice stable so the same item doesn't rotate lines within one haunt attempt.
export function safeBankLine(
  key: PersonaKey,
  trigger: Trigger,
  seed = '',
): string {
  const bank = getPersona(key).safeBank[trigger];
  if (!bank || bank.length === 0) {
    // Should never happen — every persona defines every trigger — but never
    // throw in the send path. Fall back to a universally safe neutral line.
    return 'Still on your list, whenever you are ready.';
  }
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const idx = Math.abs(h) % bank.length;
  return bank[idx]!;
}
