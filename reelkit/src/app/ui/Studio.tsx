"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { EndCard, Picture } from "@/render/draw";
import { formatPrice, shortName } from "@/script/facts";
import type { Written } from "@/script/types";
import type { Product, ProductSource } from "@/product/types";
import AdCard from "./AdCard";
import { AccountBar, BuyCredits, SignIn, useMe } from "./account";
import { fontsReady, loadPicture } from "./pictures";

type Photo = { id: string; view: string; on: boolean; uploaded: boolean };

type Draft = {
  source: ProductSource;
  url?: string;
  title: string;
  description: string;
  amount: string;
  currency: string;
  shop: string;
};

const EMPTY: Draft = { source: "manual", title: "", description: "", amount: "", currency: "USD", shop: "" };
const MAX_PHOTOS = 8;

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "ad";

export default function Studio() {
  const [link, setLink] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [writing, setWriting] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [ads, setAds] = useState<Written[] | null>(null);
  const [pictures, setPictures] = useState<Picture[]>([]);
  const { me, refresh, setCredits } = useMe();
  const [dialog, setDialog] = useState<{ kind: "signin" | "buy"; reason?: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** Set when sign-in interrupted "Make my ads", so it carries on afterwards. */
  const [resume, setResume] = useState(false);

  // Back from Stripe Checkout. The webhook usually lands before the browser
  // does, but not always, so look again a few times.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const purchase = q.get("purchase");
    const signin = q.get("signin");
    if (!purchase && !signin) return;
    window.history.replaceState(null, "", window.location.pathname);
    if (signin === "expired") setNotice("That sign-in link has expired. Ask for a new code.");
    if (purchase === "cancelled") setNotice("Checkout cancelled — nothing was charged.");
    if (purchase === "done") {
      setNotice("Payment received. Your credits are being added…");
      let tries = 0;
      const t = setInterval(() => {
        tries++;
        void refresh();
        if (tries >= 5) {
          clearInterval(t);
          setNotice("Payment received — thank you. Your credits are in your balance above.");
        }
      }, 1500);
      return () => clearInterval(t);
    }
  }, [refresh]);

  const chosen = useMemo(() => photos.filter((p) => p.on), [photos]);

  // Decode the chosen photos (and make sure the ad font is loaded) before
  // anything draws, so the first preview frame is the real one.
  useEffect(() => {
    let live = true;
    Promise.all([fontsReady(), ...chosen.map((p) => loadPicture(p.view).catch(() => null))]).then(([, ...pics]) => {
      if (live) setPictures(pics.filter((p): p is Picture => p !== null));
    });
    return () => {
      live = false;
    };
  }, [chosen]);

  async function importLink(e: FormEvent) {
    e.preventDefault();
    setImporting(true);
    setImportError(null);
    setAds(null);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: link }),
      });
      const data = (await res.json()) as { product?: Product; views?: string[]; error?: string; manual?: boolean };
      if (!res.ok || !data.product) {
        setImportError(data.error ?? "That link couldn't be imported.");
        if (data.manual) startManual();
        return;
      }
      const p = data.product;
      setDraft({
        source: p.source,
        ...(p.url ? { url: p.url } : {}),
        title: p.title,
        description: p.description,
        amount: p.price?.amount ?? "",
        currency: p.price?.currency ?? "USD",
        shop: p.shop ?? "",
      });
      setPhotos((data.views ?? []).map((view, i) => ({ id: `i${i}`, view, on: i < 5, uploaded: false })));
    } catch {
      setImportError("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setImporting(false);
    }
  }

  function startManual() {
    setDraft((d) => d ?? { ...EMPTY, source: link.includes("etsy.") ? "etsy" : "manual" });
  }

  function addFiles(files: FileList | null) {
    if (!files) return;
    const room = MAX_PHOTOS - photos.length;
    const added = [...files]
      .filter((f) => f.type.startsWith("image/") && f.type !== "image/svg+xml")
      .slice(0, Math.max(0, room))
      .map((f, i) => ({ id: `u${Date.now()}${i}`, view: URL.createObjectURL(f), on: true, uploaded: true }));
    setPhotos((ps) => [...ps, ...added]);
  }

  function toggle(id: string) {
    setPhotos((ps) => ps.map((p) => (p.id === id ? { ...p, on: !p.on } : p)));
  }

  function makeFirst(id: string) {
    setPhotos((ps) => {
      const p = ps.find((x) => x.id === id);
      return p ? [{ ...p, on: true }, ...ps.filter((x) => x.id !== id)] : ps;
    });
  }

  const price = draft && /^\d+([.,]\d{1,3})?$/.test(draft.amount.trim()) && /^[A-Z]{3}$/.test(draft.currency)
    ? { amount: draft.amount.trim().replace(",", "."), currency: draft.currency }
    : undefined;

  async function write() {
    if (!draft) return;
    if (me?.accounts && me.ai && !me.viewer) {
      setResume(true);
      setDialog({ kind: "signin", reason: "Sign in to write your ads." });
      return;
    }
    setWriting(true);
    setWriteError(null);
    try {
      const res = await fetch("/api/scripts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: draft.source,
          title: draft.title.trim(),
          description: draft.description,
          ...(price ? { price } : {}),
          ...(draft.shop.trim() ? { shop: draft.shop.trim() } : {}),
          imageCount: chosen.length,
        }),
      });
      const data = (await res.json()) as {
        ads?: Written[];
        error?: string;
        credits?: number;
        refunded?: boolean;
        signIn?: boolean;
        buy?: boolean;
      };
      if (typeof data.credits === "number") setCredits(data.credits);
      if (res.status === 401 && data.signIn) {
        setResume(true);
        setDialog({ kind: "signin", reason: "Your session ended. Sign in again to write your ads." });
        return;
      }
      if (res.status === 402) {
        setDialog({ kind: "buy", reason: "You've used all your credits. Pick a pack to keep making ads." });
        return;
      }
      if (!res.ok || !data.ads) throw new Error(data.error ?? "The ads couldn't be written.");
      setAds(data.ads);
      setNotice(data.refunded ? "The AI writer was unavailable, so these came from your listing's own words. Your credit was given back." : null);
      requestAnimationFrame(() => document.getElementById("ads")?.scrollIntoView({ behavior: "smooth" }));
    } catch (e) {
      setWriteError(e instanceof Error ? e.message : "The ads couldn't be written.");
    } finally {
      setWriting(false);
    }
  }

  const card: EndCard = useMemo(
    () => ({
      name: shortName(draft?.title ?? ""),
      ...(price ? { price: formatPrice(price.amount, price.currency) } : {}),
      ...(draft?.shop.trim() ? { shop: draft.shop.trim() } : {}),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft?.title, draft?.shop, price?.amount, price?.currency],
  );

  const ready = !!draft && draft.title.trim().length > 0 && chosen.length > 0;
  const costs = Boolean(me?.accounts && me.ai);

  // Signed in from the "Make my ads" button: carry on where they were.
  useEffect(() => {
    if (resume && me?.viewer) {
      setResume(false);
      void write();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resume, me?.viewer]);

  return (
    <main>
      <header className="top">
        <div className="mark">
          <span>reel</span>kit
        </div>
        <AccountBar
          me={me}
          onSignIn={() => setDialog({ kind: "signin" })}
          onBuy={() => setDialog({ kind: "buy" })}
          onSignedOut={() => {
            setResume(false);
            void refresh();
          }}
        />
      </header>
      {notice && (
        <p className="notice" role="status">
          {notice}
          <button type="button" className="link" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </p>
      )}
      {me && dialog?.kind === "signin" && (
        <SignIn
          open
          me={me}
          {...(dialog.reason ? { reason: dialog.reason } : {})}
          onClose={() => {
            setDialog(null);
            setResume(false);
          }}
          onSignedIn={() => {
            setDialog(null);
            void refresh();
          }}
        />
      )}
      {me && dialog?.kind === "buy" && (
        <BuyCredits open me={me} {...(dialog.reason ? { reason: dialog.reason } : {})} onClose={() => setDialog(null)} />
      )}

      <h1>Your product link in, three video ads out.</h1>
      <p className="lede">
        Paste an Etsy or Shopify listing. You get short ads for Reels, TikTok and Facebook, made from your own photos
        and your own words.
      </p>

      <section className="panel">
        <div className="step">Step 1</div>
        <h2>Paste your product link</h2>
        <form className="link" onSubmit={importLink}>
          <input
            type="url"
            inputMode="url"
            placeholder="https://www.etsy.com/listing/… or https://yourshop.com/products/…"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            aria-label="Product link"
            required
          />
          <button type="submit" disabled={importing}>
            {importing ? "Reading…" : "Import"}
          </button>
        </form>
        {importError && <p className="error">{importError}</p>}
        {!draft && (
          <p className="note">
            No link handy?{" "}
            <button className="link" onClick={startManual} type="button">
              Enter the details yourself
            </button>
          </p>
        )}
      </section>

      {draft && (
        <section className="panel">
          <div className="step">Step 2</div>
          <h2>Check the details</h2>
          <p className="note">The ads only say what's written here, so this is the place to fix anything.</p>

          <div className="fields">
            <label className="field wide">
              Product name
              <input value={draft.title} maxLength={140} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </label>
            <label className="field">
              Price <small>leave blank to keep it out of the ads</small>
              <span className="price">
                <input
                  value={draft.amount}
                  inputMode="decimal"
                  placeholder="24.00"
                  onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                  aria-label="Price amount"
                />
                <input
                  value={draft.currency}
                  maxLength={3}
                  onChange={(e) => setDraft({ ...draft, currency: e.target.value.toUpperCase() })}
                  aria-label="Currency code"
                />
              </span>
            </label>
            <label className="field">
              Shop name <small>optional, shown on the last frame</small>
              <input value={draft.shop} maxLength={80} onChange={(e) => setDraft({ ...draft, shop: e.target.value })} />
            </label>
            <label className="field wide">
              Description <small>bullet points make the best captions</small>
              <textarea
                value={draft.description}
                maxLength={4000}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </label>
          </div>

          <div style={{ marginTop: 20 }}>
            <strong>Photos</strong>
            <p className="note">Tap to include or leave out; double-tap to make one the first. Use photos you own.</p>
            <div className="photos">
              {photos.map((p) => {
                const n = chosen.findIndex((c) => c.id === p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`photo ${p.on ? "on" : "off"}`}
                    onClick={() => toggle(p.id)}
                    onDoubleClick={() => makeFirst(p.id)}
                    aria-pressed={p.on}
                    aria-label={p.on ? `Photo ${n + 1}, included` : "Photo, left out"}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- proxied or blob URLs, not optimisable */}
                    <img src={p.view} alt="" />
                    {p.on && <span className="badge">{n + 1}</span>}
                  </button>
                );
              })}
              {photos.length < MAX_PHOTOS && (
                <label className="photo add">
                  + Add photos
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => addFiles(e.target.files)} />
                </label>
              )}
            </div>
          </div>

          <div className="actions">
            <button className="primary" onClick={write} disabled={!ready || writing}>
              {writing ? "Writing your ads…" : ads ? "Write them again" : "Make my 3 ads"}
              {costs && !writing ? " · 1 credit" : ""}
            </button>
            {costs && !me?.viewer && <span className="note">Your first {me?.freeCredits} are free.</span>}
            {!ready && <span className="note">Add a product name and at least one photo.</span>}
          </div>
          {writeError && <p className="error">{writeError}</p>}
        </section>
      )}

      {ads && draft && (
        <section id="ads">
          <div className="step">Step 3</div>
          <h2 style={{ marginBottom: 16 }}>Your ads</h2>
          <div className="ads">
            {ads.map((ad, i) => (
              <AdCard
                key={ad.angle}
                ad={ad}
                pictures={pictures}
                card={card}
                slug={slugify(card.name)}
                onChange={(next) => setAds(ads.map((a, j) => (j === i ? next : a)))}
              />
            ))}
          </div>
          <p className="note">Videos are made on your device. Nothing is uploaded and nothing is posted for you.</p>
        </section>
      )}

      <footer>Reelkit works with links to your own listings. Silent videos for now; add music in the app you post from.</footer>
    </main>
  );
}
