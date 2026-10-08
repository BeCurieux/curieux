"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { EndCard, Picture } from "@/render/draw";
import { formatPrice, shortName } from "@/script/facts";
import type { Written } from "@/script/types";
import type { Product, ProductSource } from "@/product/types";
import AdCard from "./AdCard";
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
      const data = (await res.json()) as { ads?: Written[]; error?: string };
      if (!res.ok || !data.ads) throw new Error(data.error ?? "The ads couldn't be written.");
      setAds(data.ads);
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

  return (
    <main>
      <header className="top">
        <div className="mark">
          <span>reel</span>kit
        </div>
      </header>

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
            </button>
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
