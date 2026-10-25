import { createHmac, timingSafeEqual } from "node:crypto";

// The checkout link carries `empire_ref`, a signed copy of the buyer's user
// id, so a purchase made with a different email still lands on the right
// account. Signed so nobody can attach their purchase to — or claim —
// another account by editing the link.

const sign = (userId: string, secret: string) =>
  createHmac("sha256", secret).update(`empire-ref:${userId}`).digest("base64url").slice(0, 32);

export function makeRef(userId: string, secret: string): string {
  return `${Buffer.from(userId).toString("base64url")}.${sign(userId, secret)}`;
}

export function readRef(ref: string | null, secret: string): string | null {
  if (!ref) return null;
  const [encoded, signature] = ref.split(".");
  if (!encoded || !signature) return null;
  const userId = Buffer.from(encoded, "base64url").toString("utf8");
  const expected = Buffer.from(sign(userId, secret));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given) ? userId : null;
}
