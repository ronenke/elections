"use client";
import { useMemo, useState } from "react";
import { useElection } from "@/components/useElection";
import { Toasts, useToast } from "@/components/Toast";
import { compute } from "@/lib/compute";
import { n, pct, signed } from "@/lib/format";
import { ClosedBanner } from "@/components/ClosedBanner";

interface ReviewRow { letters: string; name: string; votes: number; percent: number | null; seats: number | null; partyId: string | null }
interface Parsed { rows: ReviewRow[]; countedPercent: number | null; totalValidVotes: number | null; method: "header" | "heuristic"; warnings: string[]; errors: string[]; fetchedAt?: string; url?: string }

/**
 * Import from ועדת הבחירות: fetch the results page server-side, or paste the table.
 * Rows are matched to parties, shown as a diff against the current numbers, and applied only on click.
 */
export default function ImportPage() {
  const { data, error, save } = useElection();
  const { toasts, push, remove } = useToast();
  const [busy, setBusy] = useState<"fetch" | "parse" | "apply" | null>(null);
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [mode, setMode] = useState<"fetch" | "paste">("fetch");

  const preview = useMemo(() => {
    if (!data || !parsed) return null;
    const votes = { ...data.state.votes };
    const matched = parsed.rows.filter(r => r.partyId);
    for (const r of matched) votes[r.partyId!] = r.votes;
    const unmatchedSum = parsed.rows.filter(r => !r.partyId).reduce((s, r) => s + r.votes, 0);
    const matchedSum = matched.reduce((s, r) => s + r.votes, 0);
    const other = parsed.totalValidVotes !== null ? Math.max(0, parsed.totalValidVotes - matchedSum) : unmatchedSum;
    const next = { ...data.state, votes, otherValidVotes: other, countedPercent: parsed.countedPercent ?? data.state.countedPercent };
    const computed = compute(next, false);
    // when the CEC publishes mandates (final results), our calculation must reproduce them exactly
    const cecSeats = matched.filter(r => r.seats !== null);
    const seatMismatches = cecSeats.filter(r => (computed.rows.find(x => x.id === r.partyId)?.seats ?? 0) !== r.seats);
    return { next, computed, unmatchedSum, matchedSum, cecSeats: cecSeats.length, seatMismatches };
  }, [data, parsed]);

  async function doFetch() {
    setBusy("fetch");
    try {
      const res = await fetch("/api/cec/fetch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: data?.state.election.cecUrl }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setParsed(body);
      if (!body.rows.length) push("error", "הדף נטען אך לא זוהתה בו טבלת תוצאות. נסו הדבקה ידנית.");
    } catch (e) { push("error", (e as Error).message); } finally { setBusy(null); }
  }
  async function doParse() {
    setBusy("parse");
    try {
      const res = await fetch("/api/cec/parse", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setParsed(body);
    } catch (e) { push("error", (e as Error).message); } finally { setBusy(null); }
  }
  async function doApply() {
    if (!preview || !data) return;
    setBusy("apply");
    try {
      const src = mode === "fetch" ? "cec-fetch" : "cec-paste";
      await save({ ...preview.next, source: src }, `ייבוא מוועדת הבחירות${parsed?.countedPercent !== null && parsed?.countedPercent !== undefined ? ` (${parsed.countedPercent}% נספרו)` : ""}`);
      push("ok", "התוצאות יובאו ופורסמו ללוח השידור");
      setParsed(null);
    } catch (e) { push("error", (e as Error).message); } finally { setBusy(null); }
  }
  const setMap = (i: number, partyId: string) => setParsed(p => p && { ...p, rows: p.rows.map((r, k) => (k === i ? { ...r, partyId: partyId || null } : r)) });

  if (!data) return <p className="text-slate-500">{error ?? "טוען…"}</p>;
  const parties = [...data.state.parties].sort((a, b) => a.order - b.order);
  const closed = data.state.status === "closed";

  return (
    <div className="space-y-5">
      <Toasts toasts={toasts} remove={remove} />
      <div>
        <h1 className="text-2xl font-bold">ייבוא תוצאות מוועדת הבחירות המרכזית</h1>
        <p className="text-sm text-slate-500">מערכת: <b>{data.state.election.name}</b>. לוועדה אין API רשמי. המערכת קוראת את טבלת התוצאות הארצית מדף התוצאות, או מטקסט שהעתקתם ממנו. שום דבר לא נשמר עד שתלחצו <b>אישור וייבוא</b>.</p>
      </div>

      {closed && <ClosedBanner />}
      <div className="card p-4">
        <div className="flex gap-2 mb-4">
          <button className={mode === "fetch" ? "btn-primary" : "btn-secondary"} onClick={() => setMode("fetch")}>משיכה מהאתר</button>
          <button className={mode === "paste" ? "btn-primary" : "btn-secondary"} onClick={() => setMode("paste")}>הדבקת טבלה</button>
        </div>
        {mode === "fetch" ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-slate-600">כתובת:</span>
            <code className="text-sm bg-slate-100 rounded-lg px-2 py-1" dir="ltr">{data.state.election.cecUrl || "(לא הוגדרה — ראו 'רשימות והסכמים')"}</code>
            <button className="btn-primary" onClick={doFetch} disabled={busy !== null || !data.state.election.cecUrl}>{busy === "fetch" ? "מושך…" : "משיכת תוצאות עכשיו"}</button>
            <span className="text-xs text-slate-500">אם האתר חוסם או עמוס — השתמשו בהדבקה.</span>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">באתר ועדת הבחירות סמנו את טבלת התוצאות <b>כולל שורת הכותרות</b> (שם הרשימה, אותיות, מנדטים אם יש, אחוז, מספר הקולות), העתיקו (Ctrl+C) והדביקו כאן. עדיף להעתיק את כל הדף — כך גם סך הקולות הכשרים נקרא ומשמש לאימות.</p>
            <textarea className="input h-40 num" dir="rtl" value={text} onChange={e => setText(e.target.value)} placeholder={"מחל\tהליכוד\t1,115,336\t23.41%\nפה\tיש עתיד\t847,435\t17.79%"} />
            <button className="btn-primary" onClick={doParse} disabled={busy !== null || !text.trim()}>{busy === "parse" ? "מנתח…" : "ניתוח הטקסט"}</button>
          </div>
        )}
      </div>

      {parsed && preview && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <b>{parsed.rows.length} שורות זוהו</b>
              {parsed.countedPercent !== null && <> · נספרו <span className="num">{pct(parsed.countedPercent, 1)}</span></>}
              {parsed.totalValidVotes !== null && <> · קולות כשרים <span className="num">{n(parsed.totalValidVotes)}</span></>}
              {parsed.fetchedAt && <> · נמשך {new Date(parsed.fetchedAt).toLocaleTimeString("he-IL")}</>}
              {" · "}<span className={parsed.method === "header" ? "text-emerald-700" : "text-amber-700"}>{parsed.method === "header" ? "עמודות זוהו לפי כותרות" : "עמודות זוהו לפי ניחוש"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`badge ${preview.computed.result.totalSeats === 120 ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"}`}>{preview.computed.result.totalSeats} / 120 מנדטים</span>
              <button className="btn-secondary" onClick={() => setParsed(null)}>ביטול</button>
              <button className="btn-primary" onClick={doApply} disabled={busy !== null || closed || parsed.errors.length > 0 || !preview.computed.result.ok || parsed.rows.filter(r => r.partyId).length === 0}>{busy === "apply" ? "מייבא…" : "אישור וייבוא"}</button>
            </div>
          </div>
          {parsed.errors.length > 0 && (
            <div className="px-4 py-3 bg-red-50 text-red-800 text-sm border-b border-red-200 space-y-1">
              <b>הייבוא חסום — המספרים לא עקביים:</b>
              {parsed.errors.map((e, i) => <div key={i}>✖ {e}</div>)}
              <div className="text-xs text-red-700 mt-1">בדקו את המספרים מול האתר. אפשר להזין ידנית במסך "הזנת קולות".</div>
            </div>
          )}
          {parsed.warnings.length > 0 && <div className="px-4 py-2 bg-amber-50 text-amber-800 text-sm border-b border-amber-100">{parsed.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}</div>}
          {preview.cecSeats > 0 && (
            preview.seatMismatches.length === 0
              ? <div className="px-4 py-2 bg-emerald-50 text-emerald-800 text-sm border-b border-emerald-100">✅ ועדת הבחירות פרסמה מנדטים ל-{preview.cecSeats} רשימות — החישוב שלנו זהה בכולן.</div>
              : <div className="px-4 py-3 bg-red-50 text-red-800 text-sm border-b border-red-200"><b>✖ אי-התאמה במנדטים מול פרסום ועדת הבחירות:</b> {preview.seatMismatches.map(r => `${r.name} (ועדה ${r.seats}, אצלנו ${preview.computed.rows.find(x => x.id === r.partyId)?.seats ?? 0})`).join(", ")}. בדקו הסכמי עודפים ורשימות חסרות לפני האישור.</div>
          )}
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs">
              <tr>
                <th className="text-right px-4 py-2 font-semibold">כפי שפורסם</th>
                <th className="text-right px-2 py-2 font-semibold w-28">קולות</th>
                <th className="text-right px-2 py-2 font-semibold w-52">רשימה במערכת</th>
                <th className="text-right px-2 py-2 font-semibold w-32">שינוי בקולות</th>
                <th className="text-center px-2 py-2 font-semibold w-28">מנדטים</th>
                {preview.cecSeats > 0 && <th className="text-center px-2 py-2 font-semibold w-24">מנדטים לפי הוועדה</th>}
              </tr>
            </thead>
            <tbody>
              {parsed.rows.map((r, i) => {
                const cur = r.partyId ? data.state.votes[r.partyId] ?? 0 : null;
                const before = r.partyId ? data.computed.rows.find(x => x.id === r.partyId)?.seats ?? 0 : null;
                const after = r.partyId ? preview.computed.rows.find(x => x.id === r.partyId)?.seats ?? 0 : null;
                return (
                  <tr key={i} className={`border-t border-slate-100 ${r.partyId ? "" : "bg-slate-50/70"}`}>
                    <td className="px-4 py-1.5"><span className="text-slate-500 ml-2">{r.letters}</span><b>{r.name || "—"}</b>{r.percent !== null && <span className="text-slate-400 num text-xs mr-2">{pct(r.percent)}</span>}</td>
                    <td className="px-2 py-1.5 num font-semibold">{n(r.votes)}</td>
                    <td className="px-2 py-1.5">
                      <select className={`input ${r.partyId ? "" : "border-amber-300 bg-amber-50"}`} value={r.partyId ?? ""} onChange={e => setMap(i, e.target.value)}>
                        <option value="">— לא משויך (נספר ב״רשימות אחרות״) —</option>
                        {parties.map(p => <option key={p.id} value={p.id}>{p.name}{p.letters ? ` (${p.letters})` : ""}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5 num text-slate-600">{cur !== null ? signed(r.votes - cur) : ""}</td>
                    <td className="px-2 py-1.5 text-center num">{before !== null && after !== null && (<><span className="text-slate-400">{before}</span> ← <b className={after !== before ? (after > before ? "text-emerald-600" : "text-red-600") : ""}>{after}</b></>)}</td>
                    {preview.cecSeats > 0 && <td className={`px-2 py-1.5 text-center num ${r.seats !== null && after !== null && r.seats !== after ? "bg-red-100 text-red-700 font-bold" : "text-slate-500"}`}>{r.seats ?? "—"}</td>}
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50 text-xs text-slate-600 border-t border-slate-200">
              <tr><td className="px-4 py-2" colSpan={5}>
                רשימות שלא שויכו: <span className="num">{n(preview.unmatchedSum)}</span> קולות — ייספרו כ״רשימות אחרות״ לצורך אחוז החסימה.
                {parsed.totalValidVotes !== null && <> סה״כ קולות כשרים לפי הפרסום: <span className="num">{n(parsed.totalValidVotes)}</span>.</>}
                {" "}רשימות שלא הופיעו בפרסום ישמרו את הערך הנוכחי שלהן.
              </td></tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
