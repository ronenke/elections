"use client";
import { useElection } from "@/components/useElection";
import { n, pct } from "@/lib/format";

/** The full calculation trace — the equivalent of the old Excel's columns, generated. */
export default function AuditPage() {
  const { data, error } = useElection();
  if (!data) return <p className="text-slate-500">{error ?? "טוען…"}</p>;
  const { result } = data.computed;
  const nameOf = (id: string) => data.state.parties.find(p => p.id === id)?.name ?? id;
  const unitLabel = (uid: string) => result.units.find(u => u.id === uid)?.label ?? uid;

  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-bold">פירוט החישוב (בדר-עופר)</h1><p className="text-sm text-slate-500">כל שלב בחישוב, כדי שאפשר יהיה לאמת ידנית. מבוסס על המצב שפורסם (גרסה {data.state.version}).</p></div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-5 text-sm">
        <Stat k="קולות כשרים" v={n(result.totalValidVotes)} />
        <Stat k="אחוז חסימה (3.25%)" v={`${n(result.thresholdVotes)} קולות`} />
        <Stat k="קולות הרשימות שעברו" v={n(result.qualifyingVotes)} />
        <Stat k="מודד = קולות שעברו ÷ 120" v={result.measure.toLocaleString("he-IL", { maximumFractionDigits: 2 })} />
        <Stat k="שלב ראשון / סופי" v={`${result.firstStageTotal} / ${result.totalSeats}`} />
      </div>

      <section className="card overflow-hidden">
        <h2 className="font-bold px-4 py-3 border-b border-slate-100">שלב 1 — אחוז חסימה וחלוקה ראשונית (INT של קולות ÷ מודד)</h2>
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="text-right px-4 py-2">רשימה</th><th className="text-right px-2 py-2">קולות</th><th className="text-right px-2 py-2">אחוז</th><th className="text-right px-2 py-2">חסימה</th><th className="text-right px-2 py-2">יחידת חישוב (הסכם עודפים)</th><th className="text-center px-2 py-2">מנדטים בשלב הראשון</th><th className="text-center px-2 py-2">סופי</th></tr></thead>
          <tbody>
            {result.lists.map(l => (
              <tr key={l.id} className="border-t border-slate-100">
                <td className="px-4 py-1.5 font-semibold">{l.name}</td>
                <td className="px-2 py-1.5 num">{n(l.votes)}</td>
                <td className="px-2 py-1.5 num">{pct(l.percent)}</td>
                <td className="px-2 py-1.5">{l.passedThreshold ? <span className="badge bg-emerald-100 text-emerald-800">עברה</span> : <span className="badge bg-slate-100 text-slate-500">לא עברה</span>}</td>
                <td className="px-2 py-1.5 text-slate-600">{l.unitId ? unitLabel(l.unitId) : "—"}</td>
                <td className="px-2 py-1.5 text-center num">{l.passedThreshold ? l.firstStageSeats : "—"}</td>
                <td className="px-2 py-1.5 text-center num font-bold">{l.seats}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>

      <section className="card overflow-hidden">
        <h2 className="font-bold px-4 py-3 border-b border-slate-100">שלב 2 — חלוקת {result.rounds.length} המנדטים העודפים: בכל סיבוב, המנדט ליחידה עם המודד הגבוה ביותר (קולות ÷ (מנדטים+1))</h2>
        {result.rounds.length === 0 ? <p className="p-4 text-sm text-slate-500">אין מנדטים עודפים לחלוקה.</p> : (
          <div className="overflow-x-auto">
            <table className="text-sm min-w-full">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr><th className="text-right px-4 py-2 sticky right-0 bg-slate-50">יחידה</th>{result.rounds.map(r => <th key={r.round} className="px-2 py-2 text-center whitespace-nowrap">סיבוב {r.round}{r.tie ? " ⚖" : ""}</th>)}</tr>
              </thead>
              <tbody>
                {result.units.map(u => (
                  <tr key={u.id} className="border-t border-slate-100">
                    <td className="px-4 py-1.5 font-semibold sticky right-0 bg-white whitespace-nowrap">{u.label}<div className="text-xs text-slate-400 num">{n(u.votes)} קולות · {u.firstStageSeats} → {u.seats}</div></td>
                    {result.rounds.map(r => {
                      const q = r.quotients.find(x => x.unitId === u.id)!;
                      const win = r.winnerUnitId === u.id;
                      return <td key={r.round} className={`px-2 py-1.5 text-center num whitespace-nowrap ${win ? "bg-emerald-50 font-bold text-emerald-800" : "text-slate-600"}`}>{n(Math.round(q.quotient))}<div className="text-[10px] text-slate-400">{q.seatsBefore}{win ? `→${q.seatsBefore + 1}` : ""}</div></td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {result.pairSplits.length > 0 && (
        <section className="card overflow-hidden">
          <h2 className="font-bold px-4 py-3 border-b border-slate-100">שלב 3 — חלוקת המנדטים בתוך הסכמי העודפים (מודד הזוג = קולות הזוג ÷ מנדטי הזוג)</h2>
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="text-right px-4 py-2">זוג</th><th className="text-right px-2 py-2">רשימה</th><th className="text-right px-2 py-2">קולות</th><th className="text-center px-2 py-2">INT(קולות ÷ מודד הזוג)</th><th className="text-right px-2 py-2">קולות ÷ (מנדטים+1)</th><th className="text-center px-2 py-2">סופי</th></tr></thead>
            <tbody>
              {result.pairSplits.map(ps => ps.members.map((m, i) => (
                <tr key={ps.unitId + m.id} className="border-t border-slate-100">
                  {i === 0 && <td className="px-4 py-1.5 font-semibold align-top" rowSpan={ps.members.length}>{unitLabel(ps.unitId)}<div className="text-xs text-slate-400 num">{n(ps.pairVotes)} קולות · {ps.pairSeats} מנדטים · מודד {n(Math.round(ps.pairVotes / ps.pairSeats))}{ps.leftover ? ` · ${ps.leftover} מנדט עודף` : ""}{ps.tieBreakByLot ? " · ⚖ שוויון" : ""}</div></td>}
                  <td className="px-2 py-1.5">{nameOf(m.id)}</td>
                  <td className="px-2 py-1.5 num">{n(m.votes)}</td>
                  <td className="px-2 py-1.5 text-center num">{m.floorSeats}</td>
                  <td className="px-2 py-1.5 num text-slate-600">{n(Math.round(m.quotient))}</td>
                  <td className={`px-2 py-1.5 text-center num font-bold ${m.finalSeats > m.floorSeats ? "text-emerald-700" : ""}`}>{m.finalSeats}</td>
                </tr>
              )))}
            </tbody>
          </table>
          </div>
        </section>
      )}

      {(result.warnings.length > 0 || result.errors.length > 0) && (
        <div className="card p-4 text-sm space-y-1">
          {result.errors.map((e, i) => <p key={i} className="text-red-700">✖ {e}</p>)}
          {result.warnings.map((w, i) => <p key={i} className="text-amber-700">⚠ {w}</p>)}
        </div>
      )}
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return <div className="card p-3"><div className="text-xs text-slate-500">{k}</div><div className="font-bold num mt-1">{v}</div></div>;
}