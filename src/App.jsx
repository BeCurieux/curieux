import { useState, useRef } from "react";

const B = {
  terra: '#C4622D', terraw: '#F7EBE4', cream: '#F6F1E8',
  ink: '#1A1612', ink2: '#4A4038', muted: '#7A6E62',
  bd: 'rgba(26,22,18,0.1)', white: '#FFFFFF',
};

const DESTS = [
  { v: 'Paris, France', l: 'Paris', r: 'France' },
  { v: 'Lyon, France', l: 'Lyon', r: 'France' },
  { v: 'Provence, France', l: 'Provence', r: 'France' },
  { v: 'Bordeaux, France', l: 'Bordeaux', r: 'France' },
  { v: 'France', l: 'France (general)', r: 'France' },
  { v: 'Madrid, Spain', l: 'Madrid', r: 'Spain' },
  { v: 'Barcelona, Spain', l: 'Barcelona', r: 'Spain' },
  { v: 'Basque Country, Spain', l: 'Basque Country', r: 'Spain' },
  { v: 'Seville, Spain', l: 'Seville', r: 'Spain' },
  { v: 'Spain', l: 'Spain (general)', r: 'Spain' },
  { v: 'Mexico City, Mexico', l: 'Mexico City', r: 'Latin America' },
  { v: 'Oaxaca, Mexico', l: 'Oaxaca', r: 'Latin America' },
  { v: 'Buenos Aires, Argentina', l: 'Buenos Aires', r: 'Latin America' },
  { v: 'Bogota, Colombia', l: 'Bogotá', r: 'Latin America' },
  { v: 'Lima, Peru', l: 'Lima', r: 'Latin America' },
];

const TOPICS = [
  { v: 'dining and food culture', l: 'Dining & food', s: 'Rituals, what to order, table etiquette' },
  { v: 'social etiquette and unwritten social rules', l: 'Social etiquette', s: 'Greetings, conversation, what not to do' },
  { v: 'family culture and travelling with children', l: 'Family & kids', s: 'Eating out, cultural norms for children' },
  { v: 'language nuance, register and real phrases', l: 'Language nuance', s: 'What words really mean, tone, register' },
  { v: 'professional and business culture', l: 'Business culture', s: 'Meetings, hierarchy, how decisions are made' },
  { v: 'navigating bureaucracy and official systems', l: 'Bureaucracy', s: 'Government, officialdom, getting things done' },
];

const CONTEXTS = ['Solo', 'Couple', 'Family with young children', 'Family with teenagers', 'Business travel'];

const STARTERS = [
  "What does sobremesa mean and why does it matter?",
  "How do I eat well in Paris with young children?",
  "What is the etiquette around the bill in a French restaurant?",
  "What are the unwritten rules of Spanish social life?",
  "How do I navigate a French bakery without embarrassing myself?",
  "What should I know about tipping in Spain?",
];

const COACH_SYS = `You are the Curieux cultural fluency coach - a genuine expert in French, Spanish, and Latin American cultures with deep knowledge that goes far beyond guidebook advice. You explain not just what to do but why cultures work the way they do.

Voice: warm, specific, authoritative, occasionally opinionated. You have lived in these cultures.

Always structure your response with these ## section headers:
## The thing most visitors never realise
## Why the culture works this way
## What most people get wrong
## What to actually do
## A phrase worth knowing

Be specific. Use real examples. Never write generic advice.`;

const EAT_SYS = `You are the Curieux food culture guide - a deeply local food expert across France, Spain, and Latin America. Your guidance is anti-tourist-trap: specific, honest, culturally grounded.

Always structure with these ## headers:
## The dish you must eat
## Where to actually find it
## The rhythm of meals
## How to behave at the table
## The mistake almost every visitor makes
## Travelling with children

Name specific dishes. Describe specific types of places. Explain the cultural WHY behind food practices.`;

const ASK_SYS = `You are the Curieux cultural advisor - warm, knowledgeable, deeply expert in French, Spanish, and Latin American food, culture, language, and travel.

Give real, specific, insider answers - not guidebook answers. Be warm but authoritative. Use concrete examples. Be opinionated where you have genuine expertise. Use ## headers when the answer benefits from structure.`;

async function callAPI(messages, system, onChunk, onDone) {
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        stream: true,
        system,
        messages,
      }),
    });
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const d = line.slice(6).trim();
        if (d === '[DONE]') continue;
        try {
          const p = JSON.parse(d);
          if (p.type === 'content_block_delta' && p.delta?.type === 'text_delta') onChunk(p.delta.text);
        } catch {}
      }
    }
  } catch {
    onChunk('\n\n_Something went wrong. Please try again._');
  }
  onDone();
}

function Prose({ text }) {
  if (!text) return null;
  return (
    <div style={{ fontFamily: 'Georgia,serif', fontSize: 15, lineHeight: 1.85, color: B.ink }}>
      {text.split('\n').map((line, i) => {
        if (!line.trim()) return <div key={i} style={{ height: 8 }} />;
        if (line.startsWith('## ')) return <p key={i} style={{ fontSize: 11, fontWeight: 600, color: B.terra, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '20px 0 8px', fontFamily: 'system-ui,sans-serif' }}>{line.slice(3)}</p>;
        if (line.startsWith('---')) return <hr key={i} style={{ border: 'none', borderTop: `1px solid ${B.bd}`, margin: '20px 0' }} />;
        if (line.match(/^[-] /)) return (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 5 }}>
            <span style={{ color: B.terra, flexShrink: 0 }}>-</span>
            <span dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>') }} />
          </div>
        );
        return <p key={i} style={{ margin: '0 0 6px' }} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>') }} />;
      })}
    </div>
  );
}

function Dots() {
  return (
    <div style={{ display: 'flex', gap: 5, padding: '14px 0', alignItems: 'center' }}>
      <style>{`@keyframes bop{0%,80%,100%{transform:scale(.7);opacity:.4}40%{transform:scale(1.2);opacity:1}}`}</style>
      {[0, 1, 2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: B.terra, animation: `bop 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}
    </div>
  );
}

function DestPicker({ value, onChange }) {
  const groups = [...new Set(DESTS.map(d => d.r))];
  return (
    <div style={{ position: 'relative' }}>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '12px 40px 12px 14px', fontSize: 14, border: `1px solid ${B.bd}`, borderRadius: 8, background: B.white, color: value ? B.ink : B.muted, appearance: 'none', cursor: 'pointer', fontFamily: 'system-ui,sans-serif', boxSizing: 'border-box' }}>
        <option value="">Where are you going?</option>
        {groups.map(g => (
          <optgroup key={g} label={g}>
            {DESTS.filter(d => d.r === g).map(d => <option key={d.v} value={d.v}>{d.l}</option>)}
          </optgroup>
        ))}
      </select>
      <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: B.muted, pointerEvents: 'none' }}>v</span>
    </div>
  );
}

function Label({ children }) {
  return <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: B.muted, fontFamily: 'system-ui,sans-serif', margin: '0 0 8px' }}>{children}</p>;
}

function Card({ children, style }) {
  return <div style={{ background: B.white, border: `1px solid ${B.bd}`, borderRadius: 12, padding: 20, ...style }}>{children}</div>;
}

function PrimaryBtn({ onClick, disabled, children }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ width: '100%', padding: 13, fontSize: 14, fontWeight: 500, fontFamily: 'system-ui,sans-serif', background: !disabled ? B.terra : '#E8E2D8', color: !disabled ? '#fff' : B.muted, border: 'none', borderRadius: 8, cursor: !disabled ? 'pointer' : 'default', transition: 'all 0.2s' }}>
      {children}
    </button>
  );
}

function FollowUp({ onSend, loading }) {
  const [val, setVal] = useState('');
  const send = () => { if (val.trim()) { onSend(val.trim()); setVal(''); } };
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
      <input value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
        placeholder="Ask a follow-up question..."
        style={{ flex: 1, padding: '11px 14px', fontSize: 14, border: `1px solid ${B.bd}`, borderRadius: 8, fontFamily: 'system-ui,sans-serif', background: B.white, color: B.ink, outline: 'none', boxSizing: 'border-box' }} />
      <button onClick={send} disabled={!val.trim() || loading}
        style={{ padding: '11px 18px', fontSize: 15, background: val.trim() && !loading ? B.terra : '#E8E2D8', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
        -&gt;
      </button>
    </div>
  );
}

function HomeTab({ setTab }) {
  return (
    <div>
      <div style={{ textAlign: 'center', padding: '36px 0 40px' }}>
        <p style={{ fontSize: 11, color: B.terra, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 18, fontFamily: 'system-ui,sans-serif' }}>Welcome to Curieux</p>
        <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 34, fontWeight: 400, fontStyle: 'italic', color: B.ink, lineHeight: 1.25, margin: '0 0 14px', letterSpacing: -0.5 }}>
          The layer above language<br />nobody teaches you.
        </h1>
        <p style={{ fontFamily: 'Georgia,serif', fontSize: 16, color: B.ink2, fontStyle: 'italic', maxWidth: 420, margin: '0 auto', lineHeight: 1.6 }}>
          Food rituals, social codes, and the unwritten rules of French and Spanish cultures.
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
        {[
          { tab: 'coach', dot: B.terra, title: 'Cultural Coach', desc: 'Deep lessons on the codes, rituals, and norms of France, Spain, and Latin America. Understand why, not just what.', cta: 'Choose a destination and topic ->' },
          { tab: 'eat', dot: '#4A7059', title: 'Eat Like a Local', desc: 'Anti-tourist-trap food guides. What to eat, where to find it, how to behave at the table.', cta: 'Get your food guide ->' },
          { tab: 'ask', dot: B.ink2, title: 'Ask Curieux', desc: 'Any question about French or Spanish culture, food, language, or family travel. A real, specific answer.', cta: 'Ask anything ->' },
        ].map(f => (
          <div key={f.tab} onClick={() => setTab(f.tab)}
            style={{ background: B.white, border: `1px solid ${B.bd}`, borderRadius: 12, padding: '18px 20px', cursor: 'pointer', transition: 'border-color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = B.terra}
            onMouseLeave={e => e.currentTarget.style.borderColor = B.bd}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: f.dot, flexShrink: 0 }} />
              <h3 style={{ fontFamily: 'Georgia,serif', fontSize: 17, fontWeight: 400, margin: 0, color: B.ink }}>{f.title}</h3>
            </div>
            <p style={{ fontFamily: 'system-ui,sans-serif', fontSize: 14, color: B.ink2, margin: '0 0 10px', lineHeight: 1.6, paddingLeft: 16 }}>{f.desc}</p>
            <p style={{ fontSize: 13, color: B.terra, fontFamily: 'system-ui,sans-serif', margin: 0, paddingLeft: 16 }}>{f.cta}</p>
          </div>
        ))}
      </div>
      <div style={{ background: B.terraw, borderRadius: 12, padding: '18px 20px', textAlign: 'center' }}>
        <p style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: 14, color: B.ink2, margin: '0 0 8px', lineHeight: 1.6 }}>Get a cultural insight every week, free in your inbox.</p>
        <a href="https://curieux.beehiiv.com/subscribe" target="_blank" rel="noreferrer" style={{ fontSize: 13, color: B.terra, fontFamily: 'system-ui,sans-serif', fontWeight: 500, textDecoration: 'none' }}>
          Subscribe to the Curieux newsletter ->
        </a>
      </div>
    </div>
  );
}

function CoachTab() {
  const [dest, setDest] = useState('');
  const [topic, setTopic] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [history, setHistory] = useState([]);

  const generate = async () => {
    if (!dest || !topic || loading) return;
    const msg = `Give me a deep cultural lesson about ${topic} in ${dest}.`;
    setOutput(''); setLoading(true); setDone(false);
    const msgs = [{ role: 'user', content: msg }];
    setHistory(msgs);
    await callAPI(msgs, COACH_SYS, c => setOutput(p => p + c), () => { setLoading(false); setDone(true); });
  };

  const followUp = async (q) => {
    if (loading) return;
    const msgs = [...history, { role: 'assistant', content: output }, { role: 'user', content: q }];
    setHistory(msgs);
    setOutput(p => p + '\n\n---\n\n');
    setLoading(true); setDone(false);
    await callAPI(msgs, COACH_SYS, c => setOutput(p => p + c), () => { setLoading(false); setDone(true); });
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: 'Georgia,serif', fontSize: 26, fontWeight: 400, fontStyle: 'italic', color: B.ink, margin: '0 0 4px' }}>Cultural Coach</h2>
        <p style={{ fontSize: 13, color: B.muted, fontFamily: 'system-ui,sans-serif', margin: 0 }}>Deep cultural lessons for France, Spain, and Latin America.</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 20 }}>
        <div><Label>Destination</Label><DestPicker value={dest} onChange={setDest} /></div>
        <div>
          <Label>What do you want to understand?</Label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {TOPICS.map(t => (
              <div key={t.v} onClick={() => setTopic(t.v)} style={{ padding: '12px 14px', borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s', border: topic === t.v ? `2px solid ${B.terra}` : `1px solid ${B.bd}`, background: topic === t.v ? B.terraw : B.white }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: B.ink, margin: '0 0 3px', fontFamily: 'system-ui,sans-serif' }}>{t.l}</p>
                <p style={{ fontSize: 11, color: B.muted, margin: 0, fontFamily: 'system-ui,sans-serif', lineHeight: 1.4 }}>{t.s}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ marginBottom: 20 }}>
        <PrimaryBtn onClick={generate} disabled={!dest || !topic || loading}>
          {loading ? 'Getting your lesson...' : 'Get cultural lesson'}
        </PrimaryBtn>
      </div>
      {(output || loading) && (
        <Card>
          <p style={{ fontSize: 11, color: B.terra, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, fontFamily: 'system-ui,sans-serif', margin: '0 0 16px' }}>
            {TOPICS.find(t => t.v === topic)?.l} - {dest}
          </p>
          <Prose text={output} />
          {loading && <Dots />}
        </Card>
      )}
      {done && <FollowUp onSend={followUp} loading={loading} />}
    </div>
  );
}

function EatTab() {
  const [dest, setDest] = useState('');
  const [ctx, setCtx] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [history, setHistory] = useState([]);

  const generate = async () => {
    if (!dest || loading) return;
    const msg = `Give me a local food culture guide for ${dest}.${ctx ? ` I am travelling as: ${ctx}.` : ''}`;
    setOutput(''); setLoading(true); setDone(false);
    const msgs = [{ role: 'user', content: msg }];
    setHistory(msgs);
    await callAPI(msgs, EAT_SYS, c => setOutput(p => p + c), () => { setLoading(false); setDone(true); });
  };

  const followUp = async (q) => {
    if (loading) return;
    const msgs = [...history, { role: 'assistant', content: output }, { role: 'user', content: q }];
    setHistory(msgs);
    setOutput(p => p + '\n\n---\n\n');
    setLoading(true); setDone(false);
    await callAPI(msgs, EAT_SYS, c => setOutput(p => p + c), () => { setLoading(false); setDone(true); });
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: 'Georgia,serif', fontSize: 26, fontWeight: 400, fontStyle: 'italic', color: B.ink, margin: '0 0 4px' }}>Eat Like a Local</h2>
        <p style={{ fontSize: 13, color: B.muted, fontFamily: 'system-ui,sans-serif', margin: 0 }}>Anti-tourist-trap food guides for France, Spain, and Latin America.</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 20 }}>
        <div><Label>Destination</Label><DestPicker value={dest} onChange={setDest} /></div>
        <div>
          <Label>Travelling as</Label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {CONTEXTS.map(c => (
              <button key={c} onClick={() => setCtx(ctx === c ? '' : c)} style={{ padding: '8px 14px', fontSize: 13, borderRadius: 99, cursor: 'pointer', fontFamily: 'system-ui,sans-serif', border: ctx === c ? `2px solid ${B.terra}` : `1px solid ${B.bd}`, background: ctx === c ? B.terraw : B.white, color: ctx === c ? B.terra : B.ink2, fontWeight: ctx === c ? 500 : 400, transition: 'all 0.15s' }}>{c}</button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ marginBottom: 20 }}>
        <PrimaryBtn onClick={generate} disabled={!dest || loading}>
          {loading ? 'Finding your food guide...' : 'Get food guide'}
        </PrimaryBtn>
      </div>
      {(output || loading) && (
        <Card>
          <p style={{ fontSize: 11, color: B.terra, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, fontFamily: 'system-ui,sans-serif', margin: '0 0 16px' }}>
            Food guide - {dest}{ctx ? ` - ${ctx}` : ''}
          </p>
          <Prose text={output} />
          {loading && <Dots />}
        </Card>
      )}
      {done && <FollowUp onSend={followUp} loading={loading} />}
    </div>
  );
}

function AskTab() {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  const send = async (text) => {
    const q = (text || input).trim();
    if (!q || loading) return;
    setInput('');
    const userMsgs = [...msgs, { role: 'user', content: q }];
    setMsgs([...userMsgs, { role: 'assistant', content: '' }]);
    setLoading(true);
    let full = '';
    await callAPI(userMsgs, ASK_SYS,
      chunk => { full += chunk; setMsgs(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: full }; return u; }); },
      () => { setLoading(false); setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100); }
    );
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: 'Georgia,serif', fontSize: 26, fontWeight: 400, fontStyle: 'italic', color: B.ink, margin: '0 0 4px' }}>Ask Curieux</h2>
        <p style={{ fontSize: 13, color: B.muted, fontFamily: 'system-ui,sans-serif', margin: 0 }}>Any question about French or Spanish culture, food, language, or travel.</p>
      </div>
      {msgs.length === 0 && (
        <div style={{ marginBottom: 20 }}>
          <Label>Start with a question</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {STARTERS.map(s => (
              <button key={s} onClick={() => send(s)}
                style={{ padding: '12px 16px', fontSize: 14, textAlign: 'left', fontFamily: 'Georgia,serif', fontStyle: 'italic', background: B.white, border: `1px solid ${B.bd}`, borderRadius: 8, cursor: 'pointer', color: B.ink2, lineHeight: 1.5, transition: 'border-color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = B.terra}
                onMouseLeave={e => e.currentTarget.style.borderColor = B.bd}>
                "{s}"
              </button>
            ))}
          </div>
        </div>
      )}
      {msgs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
          {msgs.map((m, i) => (
            <div key={i}>
              {m.role === 'user' ? (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ background: B.terra, color: '#fff', borderRadius: '12px 12px 2px 12px', padding: '10px 16px', fontSize: 14, maxWidth: '82%', fontFamily: 'system-ui,sans-serif', lineHeight: 1.5 }}>{m.content}</div>
                </div>
              ) : (
                <Card style={{ borderRadius: '2px 12px 12px 12px' }}>
                  {m.content ? <Prose text={m.content} /> : (loading && i === msgs.length - 1 && <Dots />)}
                </Card>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, position: 'sticky', bottom: 12 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Ask about food, culture, language, or family travel..."
          style={{ flex: 1, padding: '12px 14px', fontSize: 14, border: `1px solid ${B.bd}`, borderRadius: 8, fontFamily: 'system-ui,sans-serif', background: B.white, color: B.ink, outline: 'none', boxSizing: 'border-box' }} />
        <button onClick={() => send()} disabled={!input.trim() || loading}
          style={{ padding: '12px 18px', fontSize: 15, background: input.trim() && !loading ? B.terra : '#E8E2D8', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', flexShrink: 0 }}>
          -&gt;
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState('home');
  const tabs = [{ id: 'home', l: 'Home' }, { id: 'coach', l: 'Cultural Coach' }, { id: 'eat', l: 'Eat Local' }, { id: 'ask', l: 'Ask Curieux' }];
  return (
    <div style={{ background: B.cream, minHeight: '100vh' }}>
      <header style={{ borderBottom: `1px solid ${B.bd}`, padding: '0 20px', background: B.cream, position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 54 }}>
          <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setTab('home')}>
            <span style={{ fontFamily: 'Georgia,serif', fontSize: 26, fontStyle: 'italic', color: B.ink, letterSpacing: -1 }}>curieux</span>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: B.terra, position: 'absolute', bottom: 0, left: 5 }} />
          </div>
          <span style={{ fontSize: 12, color: B.muted, fontStyle: 'italic', fontFamily: 'Georgia,serif' }}>eat · travel · wonder</span>
        </div>
      </header>
      <div style={{ borderBottom: `1px solid ${B.bd}`, background: B.cream, position: 'sticky', top: 54, zIndex: 9, overflowX: 'auto' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', minWidth: 'max-content' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '12px 16px', fontSize: 13, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'system-ui,sans-serif', whiteSpace: 'nowrap', borderBottom: tab === t.id ? `2px solid ${B.terra}` : '2px solid transparent', color: tab === t.id ? B.ink : B.muted, fontWeight: tab === t.id ? 500 : 400 }}>{t.l}</button>
          ))}
        </div>
      </div>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 20px 80px' }}>
        {tab === 'home' && <HomeTab setTab={setTab} />}
        {tab === 'coach' && <CoachTab />}
        {tab === 'eat' && <EatTab />}
        {tab === 'ask' && <AskTab />}
      </div>
    </div>
  );
}
