// Reading a mail as a memory.
//
// Almost everything in an email is not the thing somebody wanted to keep.
// Signatures, quoted threads, disclaimers a company appends, "Sent from my
// iPhone" — a book that prints those is a book somebody is embarrassed by,
// and the embarrassment arrives a year later when it is bound.

/**
 * The part of a mail somebody actually wrote.
 *
 * Cuts at the first quoted line, signature marker or reply header. Crude on
 * purpose: erring towards keeping too little is recoverable — the full text
 * is still on the sender's machine — while erring towards too much puts a
 * corporate footer on a page about a two-year-old.
 */
export function trimQuoted(text: string): string {
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*--\s*$/.test(line)) break;
    if (/^\s*>/.test(line)) break;
    if (/^\s*(On .+ wrote:|Sent from my |Get Outlook for )/i.test(line)) break;
    if (/^\s*_{5,}\s*$/.test(line)) break;
    out.push(line);
  }
  return out.join("\n").trim();
}
