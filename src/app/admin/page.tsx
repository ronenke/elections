"use client";
import { useEffect, useMemo, useState } from "react";
import { useElection } from "@/components/useElection";
import { Toasts, useToast } from "@/components/Toast";
import { compute } from "@/lib/compute";
import type { ElectionState } from "@/lib/types";
import { n, pct, time, signed } from "@/lib/format";

/**
 * Vote entry — the main working screen on election night.
 * Every keystroke recalculates locally (the engine is pure TypeScript); "שמירה" publishes to the board.
 */
export default function VotesPage() {
  const { data, error, save } = useElection();
  const { toasts, push, remove } = useToast();
  const [draft, setDraft] = useState<ElectionState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (data && !draft) setDraft(data.state); }, [data, draft]);

  const live = useMemo(() => (draft ? compute(draft, true) : null), [draft]);
  const published = data?.computed ?? null;
  const dirty = !!(draft && data && JSON.stringify(draft) !== JSON.stringify(data.state));

  if (!draft || !live) return <p className="text-slate-500">{error ?? "טוען…"}</p>;

  const setVotes = (id: string, v: string) => setDraft(d => d && { ...d, votes: { ...d.votes, [id]: v === "" ? 0 : Math.max(0, parseInt(v.replace(/[^\d]/g, ""), 10) || 0) } });
  const parties = [...draft.parties].sort((a, b) => a.order - b.order);
  const rowOf = (id: string) => live.rows.find(r => r.id === id)!;
  const pubSeats = (id: string) => published?.rows.find(r => r.id === id)?.seats ?? 0;

  async function doSave() {
    setSaving(true);
    try {
      const note = draft!.note?.trim() ? draft!.note.trim() : `עדכון ידני${draft!.countedPercent !== null ? ` (${draft!.countedPercent}% נספרו)` : ""}`;
      const saved = await save({ ...draft!, source: "manual" }, note);
      setDraft(saved.state);
      push("ok", "נשמר ופורסם ללוח השידור");
    } catch (e) {
      push("error", (e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  function discard() { if (data) setDraft(data.state); }

  return (
    <div className="space-y-5">
      <Toasts toasts={toasts} remove={remove} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">הזנת קולות</h1>
          <p className="text-sm text-slate-500">פורסם לאחרונה: <span className="num">{time(data?.state.updatedAt)}</span> · גרסה {data?.state.version} · מקור: {sourceLabel(data?.state.source)}</p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && <span className="badge bg-amber-100 text-amber-800">שינויים שלא נשמרו</span>}
          <button className="btn-secondary" onClick={discard} disabled={!dirty || saving}>ביטול שינויים</button>
          <button className="btn-primary" onClick={doSave} disabled={!dirty || saving || !live.result.ok}>{saving ? "שומר…" : "שמירה ופרסום"}</button>
        </div>
      </div>

      {!live.result.ok && live.result.errors.length > 0 && (
        <div className="rounded-2xl bg-red-50 border border-red-200 text-red-800 p-4 text-sm"><b>לא ניתן לשמור:</b> {live.result.errors.join(" · ")}</div>
      )}
      {live.result.warnings.length > 0 && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 p-3 text-sm">{live.result.warnings.join(" · ")}</div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs">
              <tr>
                <th className="text-right px-4 py-3 font-semibold">רשימה</th>
                <th className="text-right px-2 py-3 font-semibold w-16">אות</th>
                <th className="text-right px-2 py-3 font-semibold w-44">קולות</th>
                <th className="text-right px-2 py-3 font-semibold w-20">אחוז</th>
                <th className="text-right px-2 py-3 font-semibold w-24">חסימה</th>
                <th className="text-center px-2 py-3 font-semibold w-24">מנדטים</th>
                <th className="text-right px-2 py-3 font-semibold w-40">רגישות</th>
              </tr>
            </thead>
            <tbody>
              {parties.map(p => {
                const r = rowOf(p.id);
                const delta = r.seats - pubSeats(p.id);
                const bloc = draft.blocs.find(b => b.id === p.blocId);
                return (
                  <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span className="h-6 w-1 rounded-full" style={{ background: bloc?.color ?? "#cbd5e1" }} />
                        <span className="font-semibold">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-slate-500">{p.letters || "—"}</td>
                    <td className="px-2 py-2">
                      <input
                        inputMode="numeric"
                        className="input num text-base font-semibold"
                        value={draft.votes[p.id] ? n(draft.votes[p.id]) : ""}
                        placeholder="0"
                        onChange={e => setVotes(p.id, e.target.value)}
                        onFocus={e => e.target.select()}
                      />
                    </td>
                    <td className="px-2 py-2 num text-slate-600">{r.votes ? pct(r.percent) : "—"}</td>
                    <td className="px-2 py-2">
                      {r.votes === 0 ? <span className="text-slate-300">—</span> : r.passed
                        ? <span className={`badge ${r.thresholdMargin < 25000 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>עברה</span>
                        : <span className="badge bg-red-100 text-red-700">חסרים {n(-r.thresholdMargin)}</span>}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span className="text-2xl font-extrabold num">{r.seats}</span>
                      {delta !== 0 && <span className={`mr-1 text-xs font-bold ${delta > 0 ? "text-emerald-600" : "text-red-600"}`}>{signed(delta)}</span>}
                    </td>
                    <td className="px-2 py-2 text-xs text-slate-500 num">
                      {r.passed && r.toGain !== null && <div>+{n(r.toGain)} למנדט נוסף</div>}
                      {r.passed && r.toLose !== null && <div>−{n(r.toLose)} לאיבוד מנדט</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50 border-t border-slate-200 text-sm">
              <tr>
                <td className="px-4 py-3 font-semibold" colSpan={2}>רשימות אחרות (קולות כשרים שלא הוזנו לעיל)</td>
                <td className="px-2 py-2"><input inputMode="numeric" className="input num" value={draft.otherValidVotes ? n(draft.otherValidVotes) : ""} placeholder="0" onChange={e => setDraft(d => d && { ...d, otherValidVotes: parseInt(e.target.value.replace(/[^\d]/g, ""), 10) || 0 })} /></td>
                <td className="px-2 py-2 text-slate-500 text-xs" colSpan={2}>נספרות לצורך אחוז החסימה בלבד</td>
                <td className="px-2 py-2 text-center"><span className={`text-2xl font-extrabold num ${live.result.totalSeats === 120 || live.result.totalValidVotes === 0 ? "" : "text-red-600"}`}>{live.result.totalSeats}</span><span className="text-slate-400 text-xs"> /120</span></td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        <aside className="space-y-4">
          <div className="card p-4 space-y-3">
            <h2 className="font-bold">מצב הספירה</h2>
            <div>
              <label className="label">אחוז הקולות שנספרו (לפי ועדת הבחירות)</label>
              <input inputMode="decimal" className="input num" value={draft.countedPercent ?? ""} placeholder="למשל 87.5" onChange={e => setDraft(d => d && { ...d, countedPercent: e.target.value === "" ? null : Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)) })} />
            </div>
            <div>
              <label className="label">הערה (מוצגת בלוח השידור)</label>
              <input className="input" value={draft.note} onChange={e => setDraft(d => d && { ...d, note: e.target.value })} placeholder="למשל: אחרי ספירת המעטפות הכפולות" />
            </div>
          </div>
          <div className="card p-4 space-y-2 text-sm">
            <h2 className="font-bold">סיכום</h2>
            <Row k="קולות כשרים" v={n(live.result.totalValidVotes)} />
            <Row k="אחוז החסימה" v={`${n(live.result.thresholdVotes)} קולות`} />
            <Row k="מודד" v={n(Math.round(live.result.measure))} />
            <Row k="מנדטים בשלב הראשון" v={String(live.result.firstStageTotal)} />
            <Row k="חולקו לפי עודפים" v={String(live.result.totalSeats - live.result.firstStageTotal)} />
            <div className="border-t border-slate-100 pt-2 space-y-1">
              {live.blocs.map(b => <Row key={b.id} k={<span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: b.color }} />{b.name}</span>} v={<b className="text-lg">{b.seats}</b>} />)}
              {live.unassignedSeats > 0 && <Row k="ללא גוש" v={<b className="text-lg">{live.unassignedSeats}</b>} />}
            </div>
          </div>
          <div className="card p-4 text-xs text-slate-500 leading-relaxed">
            <b className="text-slate-700">איך זה עובד:</b> הזינו את מספר הקולות הכשרים של כל רשימה כפי שמפרסמת ועדת הבחירות. המנדטים מחושבים מיד; לוח השידור מתעדכן רק אחרי <b>שמירה ופרסום</b>. כל שמירה נשמרת בהיסטוריה וניתנת לשחזור.
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: React.ReactNode; v: React.ReactNode }) {
  return <div className="flex items-center justify-between"><span className="text-slate-500">{k}</span><span className="num font-semibold">{v}</span></div>;
}

function sourceLabel(s?: string) {
  return { manual: "הזנה ידנית", "cec-fetch": "ייבוא מאתר ועדת הבחירות", "cec-paste": "הדבקה מאתר ועדת הבחירות", restore: "שחזור מהיסטוריה", seed: "נתוני התחלה" }[s ?? ""] ?? s ?? "—";
}
