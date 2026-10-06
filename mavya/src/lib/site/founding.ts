// The founding-schools offer on /founding (docs/WAITLIST_PAGE.md). These
// are the owner of Ovyko's decisions: each part only shows on the page once
// it's filled in here. Nothing is promised publicly until it's decided.

export const FOUNDING = {
  // The area founding places are open in, e.g. "the Northern Beaches".
  area: null as string | null,
  // When founding places open, e.g. "Term 1, 2027".
  opensBefore: null as string | null,
  // How many founding places there are.
  places: null as number | null,
  // What founding schools get, one line each. Suggested in
  // docs/LAUNCH_90_DAYS.md: "Your school moved in from your current system,
  // free", "The first term free", "A$399 a month per location, held for two
  // years".
  offer: [] as string[],
  // Only once everything that touches personal data is confirmed to run in
  // Australia (docs/OWNER_TODO.md).
  dataInAustralia: false,
  // In the owner of Ovyko's own words, with their name.
  founderNote: null as { text: string; name: string } | null,
};
