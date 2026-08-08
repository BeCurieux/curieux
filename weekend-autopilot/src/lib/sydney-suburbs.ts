/**
 * Suburb lookup for onboarding screen 1 (§9).
 *
 * A short local list rather than a geocoding call, for three reasons: it makes
 * the first screen instant, it costs nothing, and it means we never send a
 * customer's typed address to a third party just to turn it into a suburb.
 *
 * Coordinates are suburb centroids, approximate by design — the household
 * record stores them coarsened to roughly 100 m anyway (§51). Free text that
 * does not match falls through to a geocode on the server if one is
 * configured, or to the waitlist if the customer is not in a live market.
 */

export interface SuburbEntry {
  name: string;
  postcode: string;
  lat: number;
  lng: number;
}

export const SYDNEY_SUBURBS: readonly SuburbEntry[] = [
  { name: "Sydney CBD", postcode: "2000", lat: -33.8688, lng: 151.2093 },
  { name: "Surry Hills", postcode: "2010", lat: -33.8845, lng: 151.2115 },
  { name: "Newtown", postcode: "2042", lat: -33.8967, lng: 151.1794 },
  { name: "Marrickville", postcode: "2204", lat: -33.9114, lng: 151.1553 },
  { name: "Glebe", postcode: "2037", lat: -33.8797, lng: 151.1875 },
  { name: "Balmain", postcode: "2041", lat: -33.8576, lng: 151.1795 },
  { name: "Leichhardt", postcode: "2040", lat: -33.8836, lng: 151.1567 },
  { name: "Ashfield", postcode: "2131", lat: -33.8886, lng: 151.1257 },
  { name: "Burwood", postcode: "2134", lat: -33.8776, lng: 151.1039 },
  { name: "Strathfield", postcode: "2135", lat: -33.8736, lng: 151.0952 },
  { name: "Parramatta", postcode: "2150", lat: -33.815, lng: 151.0011 },
  { name: "Bondi", postcode: "2026", lat: -33.8915, lng: 151.2767 },
  { name: "Coogee", postcode: "2034", lat: -33.9205, lng: 151.2578 },
  { name: "Randwick", postcode: "2031", lat: -33.9146, lng: 151.2437 },
  { name: "Maroubra", postcode: "2035", lat: -33.9503, lng: 151.2361 },
  { name: "Paddington", postcode: "2021", lat: -33.8848, lng: 151.2264 },
  { name: "Double Bay", postcode: "2028", lat: -33.8776, lng: 151.2436 },
  { name: "Vaucluse", postcode: "2030", lat: -33.8567, lng: 151.2775 },
  { name: "Manly", postcode: "2095", lat: -33.7969, lng: 151.2876 },
  { name: "Mosman", postcode: "2088", lat: -33.8283, lng: 151.2445 },
  { name: "Neutral Bay", postcode: "2089", lat: -33.8384, lng: 151.2196 },
  { name: "North Sydney", postcode: "2060", lat: -33.8389, lng: 151.2073 },
  { name: "Chatswood", postcode: "2067", lat: -33.7969, lng: 151.1832 },
  { name: "Dee Why", postcode: "2099", lat: -33.7517, lng: 151.2874 },
  { name: "Hornsby", postcode: "2077", lat: -33.7048, lng: 151.0993 },
  { name: "Ryde", postcode: "2112", lat: -33.8148, lng: 151.1035 },
  { name: "Epping", postcode: "2121", lat: -33.7726, lng: 151.0817 },
  { name: "Hurstville", postcode: "2220", lat: -33.9675, lng: 151.1027 },
  { name: "Cronulla", postcode: "2230", lat: -34.0577, lng: 151.1543 },
  { name: "Sutherland", postcode: "2232", lat: -34.0311, lng: 151.0578 },
  { name: "Bankstown", postcode: "2200", lat: -33.9171, lng: 151.0353 },
  { name: "Liverpool", postcode: "2170", lat: -33.9203, lng: 150.9236 },
  { name: "Blacktown", postcode: "2148", lat: -33.7688, lng: 150.9063 },
  { name: "Penrith", postcode: "2750", lat: -33.7507, lng: 150.6942 },
  { name: "Castle Hill", postcode: "2154", lat: -33.7318, lng: 151.0055 },
  { name: "Alexandria", postcode: "2015", lat: -33.9048, lng: 151.1943 },
  { name: "Redfern", postcode: "2016", lat: -33.8928, lng: 151.2043 },
  { name: "Rozelle", postcode: "2039", lat: -33.8617, lng: 151.1707 },
  { name: "Annandale", postcode: "2038", lat: -33.8807, lng: 151.1701 },
  { name: "Erskineville", postcode: "2043", lat: -33.9016, lng: 151.1863 },
];

/** Match on suburb name or postcode, prefix-first so typing feels responsive. */
export function searchSuburbs(query: string, limit = 6): SuburbEntry[] {
  const term = query.trim().toLowerCase();
  if (term.length < 2) return [];

  const starts: SuburbEntry[] = [];
  const contains: SuburbEntry[] = [];

  for (const suburb of SYDNEY_SUBURBS) {
    const name = suburb.name.toLowerCase();
    if (name.startsWith(term) || suburb.postcode.startsWith(term)) starts.push(suburb);
    else if (name.includes(term)) contains.push(suburb);
  }

  return [...starts, ...contains].slice(0, limit);
}
