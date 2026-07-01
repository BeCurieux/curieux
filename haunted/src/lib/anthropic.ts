// Anthropic wiring for the voice engine (CLAUDE.md §Guardrail 2, Layer 1 + 2b).
// Both line generation and the safety classifier use claude-haiku-4-5 — cheap,
// fast, built for this volume. Kept behind small interfaces so the engine and
// tests share one code path; tests never touch the network.

import Anthropic from '@anthropic-ai/sdk';
import type { Persona } from '@/config/personas';
import type { SafetyClassifier, SafetyVerdict } from '@/lib/guardrails';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

// A generator produces a single candidate line. Injected so the sender doesn't
// depend on Anthropic directly (tests pass a scripted generator).
export interface LineGenerator {
  generate(input: {
    persona: Persona;
    triggerContext: string;
    itemTitle: string;
  }): Promise<string>;
}

// Layer 1 — generation. System prompt encodes persona + hard constraints.
function generationSystemPrompt(persona: Persona): string {
  return `You are writing ONE short push-notification line (max ~90 chars) in the voice of a
saved product that misses its shopper. Warm, wistful, a little funny. Cozy ghost, not horror.

The item speaks in first person about ITSELF and its feelings. Never about watching,
tracking, knowing the shopper's whereabouts, or the shopper's body/home/schedule.

Persona: ${persona.description}

Return ONLY the line. No quotes${persona.allowEmoji ? '' : ', no emoji'}.`;
}

export const anthropicGenerator: LineGenerator = {
  async generate({ persona, triggerContext, itemTitle }) {
    const msg = await client().messages.create({
      model: MODEL,
      max_tokens: 64,
      system: generationSystemPrompt(persona),
      messages: [
        {
          role: 'user',
          content: `Trigger context: ${triggerContext}\nItem: ${itemTitle}`,
        },
      ],
    });
    return extractText(msg).trim().replace(/^["']|["']$/g, '');
  },
};

// Layer 2b — the cheap safety classifier. One word out.
export const anthropicClassifier: SafetyClassifier = {
  async classify(line: string): Promise<SafetyVerdict> {
    const msg = await client().messages.create({
      model: MODEL,
      max_tokens: 4,
      system:
        'Rate this product notification COZY or CREEPY. Creepy = surveillance, threat, ' +
        'invasion of the reader\'s space or body. Return one word.',
      messages: [{ role: 'user', content: line }],
    });
    const word = extractText(msg).trim().toUpperCase();
    // Fail closed: anything that isn't a clear COZY is treated as CREEPY.
    return word.startsWith('COZY') ? 'COZY' : 'CREEPY';
  },
};

function extractText(msg: Anthropic.Message): string {
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join(' ');
}
