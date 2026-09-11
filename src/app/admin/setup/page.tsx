"use client";
import { useEffect, useState } from "react";
import { useElection } from "@/components/useElection";
import { Toasts, useToast } from "@/components/Toast";
import { useUnsavedGuard } from "@/components/useUnsavedGuard";
import type { ElectionState, Party } from "@/lib/types";
import { parseSetupText, applySetupPaste, type PasteParse } from "@/lib/setupPaste";
import { ClosedBanner } from "@/components/ClosedBanner";
import { MobileActionBar } from "@/components/MobileActionBar";

/** Parties, ballot letters, blocs and surplus agreements. Fill in before election night. */
export default function SetupPage() {
  const { data, error, save } = useElection();
  const { toasts, push, remove } = useToast();
  const [draft, setDraft] = useState<ElectionState | null>(null);
  const [saving, setSaving] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteMode, setPasteMode] = useState<"merge" | "replace">("merge");
  const [parsed, setParsed] = useState<PasteParse | null>(null);

  useEffect(() => { if (data && !draft) setDraft(data.state); }, [data, draft]);
  const dirty = !!(draft && data && JSON.stringify(draft) !== JSON.stringify(data.state));
  const closed = data?.state.status === "closed";
  useUnsavedGuard(dirty && !closed);
  if (!draft) return <p className="text-slate-500">{error ?? "טוען…"}</p>;

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
  function analyze() { setParsed(parseSetupText(pasteText)); }
  function applyPaste() {
    if (!parsed || parsed.errors.length) return;
    if (pasteMode === "replace" && !confirm("להחליף את כל הרשימות, הגושים וההסכמים במה שהודבק? כל הקולות שהוזנו יאופסו (ניתן לשחזר מההיסטוריה).")) return;
    setDraft(d => d && applySetupPaste(d, parsed.rows, pasteMode));
    setParsed(null); setPasteText(""); setPasteOpen(false);
    push("ok", pasteMode === "replace" ? "הרשימות הוחלפו — לחצו שמירה כדי לפרסם" : "הרשימות עודכנו — לחצו שמירה כדי לפרסם");
  }

  return (
    <div className="space-y-5">
      <Toasts toasts={toasts} remove={remove} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">רשימות, הסכמי עודפים וגושים</h1>
          <p className="text-sm text-slate-500">למלא לפני ליל הבחירות. אותיות הרשימות והסכמי העודפים — לפי פרסומי ועדת הבחירות המרכזית.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-secondary" onClick={() => setPasteOpen(o => !o)} disabled={closed}>טעינת רשימות מהדבקה</button>
          <button className="btn-primary hidden md:inline-flex" onClick={doSave} disabled={!dirty || saving || closed}>{saving ? "שומר…" : "שמירה"}</button>
        </div>
      </div>
      <MobileActionBar show={!closed}>
        <span className={`text-xs ${dirty ? "text-amber-700 font-semibold" : "text-slate-400"}`}>{dirty ? "שינויים שלא נשמרו" : "אין שינויים"}</span>
        <button className="btn-primary mr-auto" onClick={doSave} disabled={!dirty || saving}>{saving ? "שומר…" : "שמירה"}</button>
      </MobileActionBar>
      {closed && <ClosedBanner />}

      {pasteOpen && !closed && (
        <div className="card p-4 space-y-3 border-blue-300 ring-2 ring-blue-100">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold">טעינת רשימות מהדבקה</h2>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="inline-flex items-center gap-1.5"><input type="radio" name="pmode" checked={pasteMode === "merge"} onChange={() => setPasteMode("merge")} /> עדכון הרשימה הקיימת</label>
              <label className="inline-flex items-center gap-1.5"><input type="radio" name="pmode" checked={pasteMode === "replace"} onChange={() => setPasteMode("replace")} /> החלפה מלאה</label>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            שורה לכל רשימה, בפורמט: <code className="bg-slate-100 rounded px-1">שם המפלגה | אות | גוש | מפלגה שותפה להסכם עודפים</code> (מפריד: קו אנכי או טאב; גוש ושותפה אופציונליים; אפשר שורת כותרת ראשונה).
            את השותפה מציינים בשם או באותיות, ומספיק על אחת משתי השורות. גושים שלא קיימים ייווצרו אוטומטית.
            {pasteMode === "merge"
              ? " במצב עדכון: רשימה קיימת מזוהה לפי אותיות ואז לפי שם ומתעדכנת; רשימות חדשות נוספות; רשימות שלא הודבקו נשארות; הקולות נשמרים. שורה שהודבקה בלי שותפה מבטלת את ההסכם הקיים שלה."
              : " במצב החלפה: כל הרשימות, הגושים וההסכמים נבנים מחדש מההדבקה, והקולות מאופסים."}
          </p>
          <textarea className="input h-40" value={pasteText} onChange={e => { setPasteText(e.target.value); setParsed(null); }} placeholder={"שם המפלגה | אות | גוש | שותפה להסכם עודפים\nהליכוד | מחל | ימין | הציונות הדתית\nהציונות הדתית | ט | ימין |\nיש עתיד | פה | מרכז-שמאל |"} />
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn-secondary" onClick={analyze} disabled={!pasteText.trim()}>ניתוח הטקסט</button>
            {parsed && parsed.errors.length === 0 && <button className="btn-primary" onClick={applyPaste}>{pasteMode === "replace" ? "החלפת הרשימות" : "עדכון הרשימות"} ({parsed.rows.length})</button>}
            <button className="text-sm text-slate-500 hover:text-slate-800 mr-auto" onClick={() => { setPasteOpen(false); setParsed(null); }}>סגירה</button>
          </div>
          {parsed && (
            <div className="space-y-2">
              {parsed.errors.length > 0 && <div className="rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm p-3 space-y-0.5">{parsed.errors.map((e, i) => <div key={i}>✖ {e}</div>)}</div>}
              {parsed.warnings.length > 0 && <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm p-3 space-y-0.5">{parsed.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}</div>}
              {parsed.rows.length > 0 && (
                <div className="overflow-x-auto -mx-4 px-4"><table className="w-full text-sm min-w-[560px]">
                  <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="text-right px-3 py-1.5">שם</th><th className="text-right px-3 py-1.5">אות</th><th className="text-right px-3 py-1.5">גוש</th><th className="text-right px-3 py-1.5">הסכם עודפים עם</th><th className="text-right px-3 py-1.5">מצב</th></tr></thead>
                  <tbody>{parsed.rows.map((r, i) => {
                    const exists = draft.parties.some(p => (r.letters && p.letters === r.letters) || p.name.trim() === r.name.trim());
                    return <tr key={i} className="border-t border-slate-100"><td className="px-3 py-1 font-semibold">{r.name}</td><td className="px-3 py-1">{r.letters || "—"}</td><td className="px-3 py-1">{r.bloc || "—"}</td><td className="px-3 py-1">{r.partner || "—"}</td><td className="px-3 py-1 text-xs">{pasteMode === "replace" ? <span className="badge bg-slate-100 text-slate-600">חדש</span> : exists ? <span className="badge bg-blue-100 text-blue-800">עדכון</span> : <span className="badge bg-emerald-100 text-emerald-800">תוספת</span>}</td></tr>;
                  })}</tbody>
                </table></div>
              )}
            </div>
          )}
        </div>
      )}

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
        <div className="md:hidden divide-y divide-slate-100" data-mobile-cards>
          {parties.map((p, i) => {
            const ag = partnerOf(p.id);
            const partner = ag ? (ag.a === p.id ? ag.b : ag.a) : "";
            const taken = new Set(draft.agreements.flatMap(a => [a.a, a.b]).filter(x => x !== p.id && x !== partner));
            return (
              <div key={p.id} className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 w-5 text-center num">{i + 1}</span>
                  <input className="input font-semibold flex-1" aria-label="שם הרשימה" value={p.name} onChange={e => upd(p.id, { name: e.target.value })} />
                  <input className="input text-center w-16 shrink-0" aria-label="אותיות" placeholder="אות" value={p.letters} maxLength={4} onChange={e => upd(p.id, { letters: e.target.value.trim() })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">גוש</label>
                    <select className="input" value={p.blocId ?? ""} onChange={e => upd(p.id, { blocId: e.target.value || null })}>
                      <option value="">— ללא גוש —</option>
                      {draft.blocs.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">הסכם עודפים עם</label>
                    <select className="input" value={partner} onChange={e => setPartner(p.id, e.target.value)}>
                      <option value="">— אין הסכם —</option>
                      {parties.filter(q => q.id !== p.id && !taken.has(q.id)).map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-400">
                  <button className="px-2 py-1 rounded-lg hover:bg-slate-100 disabled:opacity-30" onClick={() => move(p.id, -1)} disabled={i === 0} title="למעלה">▲ למעלה</button>
                  <button className="px-2 py-1 rounded-lg hover:bg-slate-100 disabled:opacity-30" onClick={() => move(p.id, 1)} disabled={i === parties.length - 1} title="למטה">▼ למטה</button>
                  <button className="text-red-500 hover:text-red-700 text-xs mr-auto" onClick={() => removeParty(p.id)}>הסרה</button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
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
        </div>
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
            <div key={b.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 p-2">
              <input type="color" value={b.color} onChange={e => updBloc(b.id, { color: e.target.value })} className="h-9 w-9 rounded-lg border-0 bg-transparent cursor-pointer" />
              <input className="input flex-1 min-w-[140px]" value={b.name} onChange={e => updBloc(b.id, { name: e.target.value })} />
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
