// QR codes for "Hear this moment".
//
// Codes are rendered as inline SVG data URIs so the print PDF stays
// self-contained — no network fetch during rendering, nothing to expire
// between preflight and the press.

import QRCode from "qrcode";

/** The URL a printed code resolves to. Token-gated, no account required. */
export function listenUrl(token: string, memoryId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
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
