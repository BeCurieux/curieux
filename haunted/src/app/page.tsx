'use client';

import { useEffect, useState } from 'react';
import { PERSONAS, PERSONA_KEYS } from '@/config/personas';
import { ALL_TRIGGERS } from '@/lib/types';
import type { Cadence, PersonaKey, Trigger } from '@/lib/types';
import { apiGet, apiPost } from '@/lib/appbridge';

interface Settings {
  persona: PersonaKey;
  cadence: Cadence;
  triggers: Record<Trigger, boolean>;
}
interface Dashboard {
  haunted: number;
  openedPct: number;
  reunions: number;
  recoveredCents: number;
  recentReunions: Array<{ title: string; at: string }>;
}

const CADENCES: Cadence[] = ['gentle', 'normal', 'persistent'];
const TRIGGER_LABELS: Record<Trigger, string> = {
  price_drop: 'Price drop',
  back_in_stock: 'Back in stock',
  been_a_while: "It's been a while",
  low_stock: 'Low stock',
  abandoned_saved: 'Saved but never returned',
};
// low_stock / abandoned_saved are wired but off by default (CLAUDE.md).
const ADVANCED: Trigger[] = ['low_stock', 'abandoned_saved'];

export default function Admin() {
  const [s, setS] = useState<Settings | null>(null);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [saving, setSaving] = useState(false);
  const [testMsg, setTestMsg] = useState('');

  useEffect(() => {
    apiGet<Settings>('/api/admin/settings').then(setS).catch(() => setS(defaultSettings()));
    apiGet<Dashboard>('/api/admin/dashboard').then(setDash).catch(() => setDash(emptyDash()));
  }, []);

  async function save(next: Settings) {
    setS(next);
    setSaving(true);
    try {
      await apiPost('/api/admin/settings', next);
    } finally {
      setSaving(false);
    }
  }

  if (!s) return <div className="wrap">Lighting the candles…</div>;

  return (
    <div className="wrap">
      <h1>👻 Haunted Wishlist</h1>
      <p className="sub">Saved items whisper their way back — cozy, well-timed, never creepy.</p>

      <h2>Voice</h2>
      <div className="grid">
        {PERSONA_KEYS.map((key) => {
          const p = PERSONAS[key];
          return (
            <div
              key={key}
              className={`card persona ${s.persona === key ? 'sel' : ''}`}
              onClick={() => save({ ...s, persona: key })}
            >
              <div className="label">{p.label}</div>
              <div className="sample">“{p.sampleLine}”</div>
            </div>
          );
        })}
      </div>

      <h2>Cadence</h2>
      <div className="pill-row">
        {CADENCES.map((c) => (
          <button
            key={c}
            className={`pill ${s.cadence === c ? 'sel' : ''}`}
            onClick={() => save({ ...s, cadence: c })}
          >
            {c[0]!.toUpperCase() + c.slice(1)}
            {c === 'normal' ? <span className="rec">recommended</span> : null}
          </button>
        ))}
      </div>
      <p className="reassure">We cap every level so it never becomes spam.</p>

      <h2>When items haunt</h2>
      <div className="card">
        {ALL_TRIGGERS.map((t) => (
          <div key={t} className={`toggle ${ADVANCED.includes(t) ? '' : ''}`}>
            <span>
              {TRIGGER_LABELS[t]}
              {ADVANCED.includes(t) ? <span className="reassure"> · advanced</span> : null}
            </span>
            <button
              className={`switch ${s.triggers[t] ? 'on' : ''}`}
              aria-pressed={s.triggers[t]}
              onClick={() => save({ ...s, triggers: { ...s.triggers, [t]: !s.triggers[t] } })}
            >
              <span className="knob" />
            </button>
          </div>
        ))}
      </div>

      <h2>Since we last spoke</h2>
      <div className="metrics">
        <Metric k="Items haunted" n={dash?.haunted ?? 0} />
        <Metric k="Opened" n={`${dash?.openedPct ?? 0}%`} />
        <Metric k="Reunions" n={dash?.reunions ?? 0} />
        <Metric k="Recovered" n={`$${((dash?.recoveredCents ?? 0) / 100).toFixed(0)}`} />
      </div>

      {dash && dash.recentReunions.length > 0 ? (
        <>
          <h2>Recent reunions</h2>
          <ul className="feed">
            {dash.recentReunions.map((r, i) => (
              <li key={i}>
                <span className="who">{r.title}</span> came home
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <h2>Try it</h2>
      <div className="pill-row">
        <button
          className="btn"
          onClick={async () => {
            setTestMsg('Sending…');
            try {
              const r = await apiPost<{ outcome: string; line?: string }>('/api/admin/test-haunt', {});
              setTestMsg(r.line ? `“${r.line}” (${r.outcome})` : r.outcome);
            } catch {
              setTestMsg('No subscriber yet — save an item on your store first.');
            }
          }}
        >
          Send a test haunt to myself
        </button>
        {saving ? <span className="reassure">saving…</span> : null}
      </div>
      {testMsg ? <p className="reassure">{testMsg}</p> : null}
    </div>
  );
}

function Metric({ k, n }: { k: string; n: number | string }) {
  return (
    <div className="card metric">
      <div className="n">{n}</div>
      <div className="k">{k}</div>
    </div>
  );
}

function defaultSettings(): Settings {
  return {
    persona: 'clingy_ex',
    cadence: 'normal',
    triggers: {
      price_drop: true,
      back_in_stock: true,
      been_a_while: true,
      low_stock: false,
      abandoned_saved: false,
    },
  };
}
function emptyDash(): Dashboard {
  return { haunted: 0, openedPct: 0, reunions: 0, recoveredCents: 0, recentReunions: [] };
}
