// The host a printed QR points at.
//
// listenUrl() already refuses when NEXT_PUBLIC_APP_URL is unset. This is the
// quieter failure: a host that is set and wrong. Every case below produces a
// perfectly valid QR code — the file passes every other preflight rule, the
// press run completes, and the book is wrong in the one way that cannot be
// fixed afterwards.
//
// No test here touches the network. The resolver is injected, which is the
// whole reason it is a parameter.

import { describe, expect, it } from "vitest";
import { checkPrintableHost, dnsResolver, type Resolver } from "@/lib/listen/host";
import { runPreflight } from "@/lib/pdf/preflight";
import { FORMAT } from "@/lib/book/format";

const resolves: Resolver = async () => true;
const resolvesNot: Resolver = async () => false;

describe("the host a code is printed against", () => {
  it("passes a registered https host", async () => {
    const v = await checkPrintableHost("https://qotidia.com", resolves);
    expect(v.ok).toBe(true);
    expect(v.host).toBe("qotidia.com");
  });

  it("refuses a host that does not resolve", async () => {
    // The case in front of us: the domain is decided but not yet bought. Every
    // code would be printed pointing at nothing — and at a name somebody else
    // can still register.
    const v = await checkPrintableHost("https://qotidia.com", resolvesNot);
    expect(v.ok).toBe(false);
    expect(v.code).toBe("unresolved");
    expect(v.message).toMatch(/registered/);
  });

  it("refuses when nothing is configured", async () => {
    const v = await checkPrintableHost(undefined, resolves);
    expect(v.ok).toBe(false);
    expect(v.code).toBe("unset");
  });

  it("refuses hosts that only exist on the machine that built the file", async () => {
    // These resolve. That is exactly why they need naming: a resolver check
    // alone would wave localhost straight through to the press.
    for (const url of [
      "http://localhost:3000",
      "https://127.0.0.1",
      "https://qotidia.local",
      "https://10.0.0.5",
      "https://192.168.1.10",
      "https://172.16.0.9",
    ]) {
      const v = await checkPrintableHost(url, resolves);
      expect(v.ok, url).toBe(false);
      expect(v.code, url).toBe("unreachable");
    }
  });

  it("refuses http, because the code opens a child's recording", async () => {
    const v = await checkPrintableHost("http://qotidia.com", resolves);
    expect(v.ok).toBe(false);
    expect(v.code).toBe("insecure");
  });

  it("refuses something that is not a URL at all", async () => {
    const v = await checkPrintableHost("qotidia.com", resolves);
    expect(v.ok).toBe(false);
    expect(v.code).toBe("malformed");
  });

  it("says what it checked, in words the person fixing it can act on", async () => {
    // These messages surface in a failed print job. "unresolved" is not a
    // thing anybody can do something about at 6pm before a press deadline.
    const v = await checkPrintableHost("https://qotidia.com", resolvesNot);
    expect(v.message).toContain("qotidia.com");
    expect(v.message.length).toBeGreaterThan(40);
  });
});

describe("preflight refuses the press file", () => {
  const base = () => ({
    interiorPages: FORMAT.targetInteriorPages,
    pageWidthMm: FORMAT.trimWidthMm,
    pageHeightMm: FORMAT.trimHeightMm,
    bleedAdded: false,
    cropMarksAdded: false,
    images: [],
    fontsEmbedded: true,
    colourSpace: FORMAT.colourSpace,
    transparencyFlattened: true,
    overflowPages: [],
    safeAreaViolations: [],
    spreadPages: [],
    blankPages: [],
    uncitedBlocks: 0,
  });

  it("passes a book with no listen marks at all", () => {
    // Most books have none. The rule must not invent a requirement for them.
    expect(runPreflight(base()).passed).toBe(true);
  });

  it("passes when the host is good", async () => {
    const listenHost = await checkPrintableHost("https://qotidia.com", resolves);
    expect(runPreflight({ ...base(), listenHost }).passed).toBe(true);
  });

  it("fails, as an error rather than a warning, when the host is not printable", async () => {
    const listenHost = await checkPrintableHost("https://qotidia.com", resolvesNot);
    const r = runPreflight({ ...base(), listenHost });
    expect(r.passed).toBe(false);
    const issue = r.issues.find((i) => i.code === "listen_host_unresolved");
    expect(issue?.severity).toBe("error");
  });
});

describe("the real resolver", () => {
  it("is a function that takes a hostname", () => {
    // Deliberately not exercised against the network: a test that fails when
    // the CI runner has no DNS is a test that teaches people to ignore it.
    // What matters is that the injected shape and the real one agree.
    expect(typeof dnsResolver).toBe("function");
    expect(dnsResolver.length).toBe(1);
  });
});
