// Where sign-in may send someone afterwards. Only an invite link, so the
// parameter can't be used to send people anywhere else.
export function safeNext(value: unknown): string | null {
  return typeof value === "string" && /^\/join\/[0-9a-f]{64}$/.test(value) ? value : null;
}
