"use client";
import Link from "next/link";
import { useElection } from "@/components/useElection";
import { n, pct, clock } from "@/lib/format";

/**
 * The on-air board: what the presenter reads from. Large, calm, high contrast. Polls every 10 s.
 */
export default function Board() {
  const { data, error, loadedAt } = useElection(10_000);
  if (!data) return <main className="min-h-screen bg-[#0b1220] text-white grid place-items-center">{error ? <p className="text-red-300">{error}</p> : <p className="text-slate-400">טוען…</p>}</main>;

  const { state, computed } = data;
  const rows = [...computed.rows].sort((a, b) => b.seats - a.seats || b.votes - a.votes);
  const passed = rows.filter(r => r.passed);
  const failed = rows.filter(r => !r.passed && r.votes > 0);
  const notCounted = computed.result.totalValidVotes === 0;
  const blocs = computed.blocs;
  const blocColor = (id: string | null) => blocs.find(b => b.id === id)?.color ?? "#64748b";
  const problems = computed.result.errors;

  return (
    <main className="min-h-screen bg-[#0b1220] text-white p-6 md:p-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">{state.election.name}</h1>
          <p className="text-slate-400 mt-1">
            חלוקת מנדטים לפי שיטת בדר-עופר · {state.countedPercent !== null ? <>נספרו <b className="text-white num">{pct(state.countedPercent, 1)}</b> מהקולות</> : "טרם דווח אחוז ספירה"}
            {" · "}עודכן <span className="num">{clock(state.updatedAt)}</span>
            {state.note && <> · {state.note}</>}
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <span className="inline-flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${error ? "bg-red-400" : "bg-emerald-400"} animate-pulse`} />{error ? "אין קשר לשרת" : `חי · ${clock(loadedAt)}`}</span>
          <Link href="/admin" className="text-slate-300 hover:text-white underline underline-offset-4">ניהול</Link>
        </div>
      </header>

      {problems.length > 0 && (
        <div className="mt-5 rounded-2xl bg-red-500/15 border border-red-400/40 p-4 text-red-200">
          <b>שימו לב:</b> {problems.join(" · ")}
        </div>
      )}
      {computed.result.warnings.length > 0 && (
        <div className="mt-5 rounded-2xl bg-amber-500/10 border border-amber-400/30 p-3 text-amber-200 text-sm">{computed.result.warnings.join(" · ")}</div>
      )}

      {notCounted ? (
        <div className="mt-16 text-center text-slate-400 text-xl">עדיין לא הוזנו קולות.</div>
      ) : (
        <>
          {/* blocs */}
          <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {blocs.map(b => (
              <div key={b.id} className="rounded-2xl bg-white/5 border border-white/10 p-5 flex items-center justify-between">
                <div>
                  <div className="text-slate-300 text-sm">{b.name}</div>
                  <div className="text-slate-500 text-xs mt-1">{b.partyIds.length} רשימות · {n(b.votes)} קולות</div>
                </div>
                <div className="text-5xl font-extrabold num" style={{ color: b.color }}>{b.seats}</div>
              </div>
            ))}
            {computed.unassignedSeats > 0 && (
              <div className="rounded-2xl bg-white/5 border border-white/10 p-5 flex items-center justify-between">
                <div className="text-slate-300 text-sm">ללא שיוך לגוש</div>
                <div className="text-5xl font-extrabold num text-slate-300">{computed.unassignedSeats}</div>
              </div>
            )}
          </section>

          {/* seat bar */}
          <div className="mt-6 h-4 w-full rounded-full overflow-hidden flex bg-white/10" title="120 מנדטים">
            {blocs.map(b => b.seats > 0 && <div key={b.id} style={{ width: `${(b.seats / 120) * 100}%`, background: b.color }} />)}
            {computed.unassignedSeats > 0 && <div style={{ width: `${(computed.unassignedSeats / 120) * 100}%`, background: "#64748b" }} />}
          </div>
          <div className="mt-1 flex justify-between text-xs text-slate-500"><span>0</span><span>61</span><span>120</span></div>

          {/* parties */}
          <section className="mt-8 grid gap-3 md:grid-cols-2">
            {passed.map(r => (
              <div key={r.id} className="rounded-2xl bg-white/5 border border-white/10 px-5 py-4 flex items-center gap-4">
                <div className="h-14 w-1.5 rounded-full shrink-0" style={{ background: blocColor(r.blocId) }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl md:text-2xl font-bold leading-tight">{r.name}</span>
                    {r.letters && <span className="text-slate-400 text-lg">{r.letters}</span>}
                  </div>
                  <div className="text-slate-400 text-sm num mt-0.5">{n(r.votes)} קולות · {pct(r.percent)}</div>
                </div>
                <div className="text-right">
                  <div className="text-5xl font-extrabold num leading-none">{r.seats}</div>
                  <div className="text-[11px] text-slate-500 mt-1 num">
                    {r.toGain !== null && <span title="קולות נוספים למנדט הבא">+{n(r.toGain)} למנדט</span>}
                    {r.toGain !== null && r.toLose !== null && " · "}
                    {r.toLose !== null && <span title="קולות שיאבדו מנדט">−{n(r.toLose)} לאיבוד</span>}
                  </div>
                </div>
              </div>
            ))}
          </section>

          {/* threshold & next seat */}
          <section className="mt-8 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
              <h2 className="font-bold text-slate-200">אחוז החסימה — <span className="num">{n(computed.result.thresholdVotes)}</span> קולות (3.25%)</h2>
              {failed.length === 0 ? <p className="text-slate-500 text-sm mt-2">כל הרשימות שהוזנו עברו את אחוז החסימה.</p> : (
                <ul className="mt-3 space-y-2">
                  {failed.sort((a, b) => b.votes - a.votes).map(r => (
                    <li key={r.id} className="flex items-center justify-between text-sm">
                      <span><b>{r.name}</b> <span className="text-slate-400">{r.letters}</span></span>
                      <span className="num text-slate-300">{n(r.votes)} · {pct(r.percent)} · <span className="text-red-300">חסרים {n(-r.thresholdMargin)}</span></span>
                    </li>
                  ))}
                </ul>
              )}
              {passed.filter(r => r.thresholdMargin < 25000).length > 0 && (
                <p className="mt-3 text-xs text-amber-300">קרובות לאחוז החסימה: {passed.filter(r => r.thresholdMargin < 25000).map(r => `${r.name} (+${n(r.thresholdMargin)})`).join(", ")}</p>
              )}
            </div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
              <h2 className="font-bold text-slate-200">המנדט הבא</h2>
              <dl className="mt-3 space-y-2 text-sm">
                {computed.closestGain && <div className="flex justify-between"><dt className="text-slate-400">הקרובה ביותר לזכות במנדט נוסף</dt><dd><b>{computed.closestGain.name}</b> — עוד <span className="num">{n(computed.closestGain.toGain)}</span> קולות</dd></div>}
                {computed.closestLoss && <div className="flex justify-between"><dt className="text-slate-400">הקרובה ביותר לאבד מנדט</dt><dd><b>{computed.closestLoss.name}</b> — פחות <span className="num">{n(computed.closestLoss.toLose)}</span> קולות</dd></div>}
                <div className="flex justify-between"><dt className="text-slate-400">מודד (קולות למנדט)</dt><dd className="num">{n(Math.round(computed.result.measure))}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-400">קולות כשרים</dt><dd className="num">{n(computed.result.totalValidVotes)}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-400">סה״כ מנדטים</dt><dd className={`num font-bold ${computed.result.totalSeats === 120 ? "text-emerald-300" : "text-red-300"}`}>{computed.result.totalSeats} / 120</dd></div>
              </dl>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
