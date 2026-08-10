// QR codes for "Hear this moment".
//
// Codes are rendered as inline SVG data URIs so the print PDF stays
// self-contained — no network fetch during rendering, nothing to expire
// between preflight and the press.

import QRCode from "qrcode";

/**
 * The URL a printed code resolves to. Token-gated, no account required.
 *
 * This refuses rather than falls back, which is the opposite of everywhere
 * else that reads the host. Everywhere else, a wrong URL is a bad link
 * somebody reports and we fix in a deploy. Here it is ink: the code is
 * rendered into a PDF, printed, laminated and bound, and it will be scanned
 * by a grandparent in nine years. It used to default to localhost:3000 —
 * meaning a build with the variable unset would have produced a book full of
 * codes that resolve to nothing, and nothing anywhere would have said so.
 *
 * Failing the print run is recoverable. A shelf of dead QR codes is not.
 */
export function listenUrl(token: string, memoryId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL;
  if (!base) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL is not set, and this URL is about to be printed " +
        "into a book. Set it to the host the codes should resolve to."
    );
  }
  return `${base}/listen/${token}/${memoryId}`;
}

/**
 * A QR as an SVG data URI, at print quality.
 * Error correction level M survives the ink spread and matte lamination of
 * a hardcover page; level L is measurably less reliable once varnished.
 */
export async function qrDataUri(url: string): Promise<string> {
  const svg = await QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 0,
    color: { dark: "#1c1917", light: "#00000000" },
  });
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/**
 * Minimum printed size for a scannable code.
 * A QR needs roughly 0.6in at this data length to scan reliably from a
 * page held at arm's length; preflight rejects anything smaller.
 */
export const MIN_QR_INCHES = 0.6;

export function qrIsScannable(placedInches: number): boolean {
  return placedInches >= MIN_QR_INCHES;
}
