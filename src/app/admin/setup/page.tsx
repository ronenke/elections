"use client";
import { useEffect, useState } from "react";
import { useElection } from "@/components/useElection";
import { Toasts, useToast } from "@/components/Toast";
import type { ElectionState, Party } from "@/lib/types";
import { rehearsal2022, seedState } from "@/lib/seed";
import { ClosedBanner } from "@/components/ClosedBanner";

/** Parties, ballot letters, blocs and surplus agreements. Fill in before election night. */
export default function SetupPage() {
  const { data, error, save } = useElection();
  const { toasts, push, remove } = useToast();
  const [draft, setDraft] = useState<ElectionState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (data && !draft) setDraft(data.state); }, [data, draft]);
  if (!draft) return <p className="text-slate-500">{error ?? "טוען…"}</p>;

  const dirty = !!(data && JSON.stringify(draft) !== JSON.stringify(data.state));
  const closed = data?.state.status === "closed";
  const parties = [...draft.parties].sort((a, b) => a.order - b.order);
  const upd = (id: string, patch: Partial<Party>) => setDraft(d => d && { ...d, parties: d.parties.map(p => (p.id === id ? { ...p, ...patch } : p)) });
  const move = (id: string, dir: -1 | 1) => setDraft(d => {
    if (!d) return d;
    const ps = [...d.parties].sort((a, b) => a.order - b.order);
    const i = ps.findIndex(p => p.id === id);
    const j = i + dir;
    if (j < 0 || j >= ps.length) return d;
    [ps[i], ps[j]] = [ps[j], ps[i]];
    return { ...d, parties: ps.map((p, k) => ({ ...p, order: k })) };
  });
  const addParty = () => setDraft(d => {
    if (!d) return d;
    const id = `p${Date.now().toString(36)}`;
    return { ...d, parties: [...d.parties, { id, name: "רשימה חדשה", letters: "", blocId: null, order: d.parties.length }], votes: { ...d.votes, [id]: 0 } };
  });
  const removeParty = (id: string) => {
    const p = draft.parties.find(x => x.id === id);
    if (!confirm(`להסיר את "${p?.name}"? הקולות שהוזנו לרשימה זו יימחקו.`)) return;
    setDraft(d => d && { ...d, parties: d.parties.filter(x => x.id !== id), agreements: d.agreements.filter(a => a.a !== id && a.b !== id), votes: Object.fromEntries(Object.entries(d.votes).filter(([k]) => k !== id)) });
  };
  const partnerOf = (id: string) => draft.agreements.find(a => a.a === id || a.b === id);
  const setPartner = (id: string, other: string) => setDraft(d => {
    if (!d) return d;
    const rest = d.agreements.filter(a => a.a !== id && a.b !== id && a.a !== other && a.b !== other);
    return { ...d, agreements: other ? [...rest, { a: id, b: other }] : rest };
  });
  const updBloc = (id: string, patch: Partial<{ name: string; color: string }>) => setDraft(d => d && { ...d, blocs: d.blocs.map(b => (b.id === id ? { ...b, ...patch } : b)) });
  const addBloc = () => setDraft(d => d && { ...d, blocs: [...d.blocs, { id: `b${Date.now().toString(36)}`, name: "גוש חדש", color: "#7c3aed" }] });
  const removeBloc = (id: string) => setDraft(d => d && { ...d, blocs: d.blocs.filter(b => b.id !== id), parties: d.parties.map(p => (p.blocId === id ? { ...p, blocId: null } : p)) });

  async function doSave() {
    setSaving(true);
    try {
      const saved = await save(draft!, "עדכון רשימות/הסכמים/גושים");
      setDraft(saved.state);
      push("ok", "ההגדרות נשמרו");
    } catch (e) { push("error", (e as Error).message); } finally { setSaving(false); }
  }
  function loadPreset(kind: "2022" | "2026") {
    if (!confirm(kind === "2022" ? "לטעון את תוצאות 2022 לחזרה גנרלית? הנתונים הנוכחיים יוחלפו (ניתן לשחזר מההיסטוריה)." : "לאפס לרשימות 2026 ההתחלתיות? הקולות יימחקו (ניתן לשחזר מההיסטוריה).")) return;
    const s = kind === "2022" ? rehearsal2022() : seedState();
    // keep the identity of this election; replace only its content
    setDraft({ ...s, id: draft!.id, status: draft!.status, createdAt: draft!.createdAt, version: draft!.version });
  }

  return (
    <div className="space-y-5">
      <Toasts toasts={toasts} remove={remove} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">רשימות, הסכמי עודפים וגושים</h1>
          <p className="text-sm text-slate-500">למלא לפני ליל הבחירות. אותיות הרשימות והסכמי העודפים — לפי פרסומי ועדת הבחירות המרכזית.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary" onClick={() => loadPreset("2022")} disabled={closed}>טעינת חזרה גנרלית (2022)</button>
          <button className="btn-secondary" onClick={() => loadPreset("2026")} disabled={closed}>איפוס לרשימות 2026</button>
          <button className="btn-primary" onClick={doSave} disabled={!dirty || saving || closed}>{saving ? "שומר…" : "שמירה"}</button>
        </div>
      </div>
      {closed && <ClosedBanner />}

      <fieldset disabled={closed} className="contents">
      <div className="card p-4 grid gap-3 md:grid-cols-3">
        <div><label className="label">שם מערכת הבחירות</label><input className="input" value={draft.election.name} onChange={e => setDraft(d => d && { ...d, election: { ...d.election, name: e.target.value } })} /></div>
        <div><label className="label">תאריך</label><input className="input num" type="date" value={draft.election.date} onChange={e => setDraft(d => d && { ...d, election: { ...d.election, date: e.target.value } })} /></div>
        <div><label className="label">כתובת דף התוצאות של ועדת הבחירות</label><input className="input num" dir="ltr" value={draft.election.cecUrl} onChange={e => setDraft(d => d && { ...d, election: { ...d.election, cecUrl: e.target.value } })} /></div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h2 className="font-bold">רשימות ({parties.length})</h2>
          <button className="btn-secondary" onClick={addParty}>+ הוספת רשימה</button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs">
            <tr>
              <th className="px-3 py-2 w-16" />
              <th className="text-right px-2 py-2 font-semibold">שם הרשימה</th>
              <th className="text-right px-2 py-2 font-semibold w-24">אותיות</th>
              <th className="text-right px-2 py-2 font-semibold w-48">גוש</th>
              <th className="text-right px-2 py-2 font-semibold w-56">הסכם עודפים עם</th>
              <th className="px-2 py-2 w-16" />
            </tr>
          </thead>
          <tbody>
            {parties.map((p, i) => {
              const ag = partnerOf(p.id);
              const partner = ag ? (ag.a === p.id ? ag.b : ag.a) : "";
              const taken = new Set(draft.agreements.flatMap(a => [a.a, a.b]).filter(x => x !== p.id && x !== partner));
              return (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-3 py-1.5 text-slate-400 whitespace-nowrap">
                    <button className="hover:text-slate-800 disabled:opacity-30" onClick={() => move(p.id, -1)} disabled={i === 0} title="למעלה">▲</button>
                    <button className="hover:text-slate-800 disabled:opacity-30 mr-1" onClick={() => move(p.id, 1)} disabled={i === parties.length - 1} title="למטה">▼</button>
                  </td>
                  <td className="px-2 py-1.5"><input className="input font-semibold" value={p.name} onChange={e => upd(p.id, { name: e.target.value })} /></td>
                  <td className="px-2 py-1.5"><input className="input text-center" value={p.letters} maxLength={4} onChange={e => upd(p.id, { letters: e.target.value.trim() })} /></td>
                  <td className="px-2 py-1.5">
                    <select className="input" value={p.blocId ?? ""} onChange={e => upd(p.id, { blocId: e.target.value || null })}>
                      <option value="">— ללא גוש —</option>
                      {draft.blocs.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <select className="input" value={partner} onChange={e => setPartner(p.id, e.target.value)}>
                      <option value="">— אין הסכם —</option>
                      {parties.filter(q => q.id !== p.id && !taken.has(q.id)).map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1.5 text-left"><button className="text-red-500 hover:text-red-700 text-xs" onClick={() => removeParty(p.id)}>הסרה</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="px-4 py-3 text-xs text-slate-500 border-t border-slate-100">
          הסכם עודפים נחשב רק אם שתי הרשימות עוברות את אחוז החסימה; כל רשימה יכולה להיות בהסכם אחד בלבד. {draft.agreements.length} הסכמים מוגדרים.
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h2 className="font-bold">גושים</h2>
          <button className="btn-secondary" onClick={addBloc}>+ הוספת גוש</button>
        </div>
        <div className="p-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {draft.blocs.map(b => (
            <div key={b.id} className="flex items-center gap-2 rounded-xl border border-slate-200 p-2">
              <input type="color" value={b.color} onChange={e => updBloc(b.id, { color: e.target.value })} className="h-9 w-9 rounded-lg border-0 bg-transparent cursor-pointer" />
              <input className="input" value={b.name} onChange={e => updBloc(b.id, { name: e.target.value })} />
              <span className="text-xs text-slate-500 whitespace-nowrap">{parties.filter(p => p.blocId === b.id).length} רשימות</span>
              <button className="text-red-500 hover:text-red-700 text-xs" onClick={() => removeBloc(b.id)}>הסרה</button>
            </div>
          ))}
        </div>
      </div>
      </fieldset>
    </div>
  );
}
