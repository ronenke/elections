"use client";
import Link from "next/link";
import { useElection } from "@/components/useElection";
import { n, pct, clock } from "@/lib/format";
import { AgreementBadge, DangerDot } from "@/components/Badges";
import { Hemicycle } from "@/components/Hemicycle";
import { useEffect, useState } from "react";

/**
 * The on-air board: what the presenter reads from. Large, calm, high contrast. Polls every 10 s.
 */
export default function Board() {
  const { data, error, loadedAt } = useElection(10_000);
  const [role, setRole] = useState<"admin" | "viewer" | null>(null);
  useEffect(() => { fetch("/api/me", { cache: "no-store" }).then(r => r.json()).then(b => setRole(b.role ?? null)).catch(() => {}); }, []);
  if (!data) return <main className="min-h-screen bg-[#0b1220] text-white grid place-items-center">{error ? <p className="text-red-300">{error}</p> : <p className="text-slate-400">טוען…</p>}</main>;

  const { state, computed } = data;
  const rows = [...computed.rows].sort((a, b) => b.seats - a.seats || b.votes - a.votes);
  const passed = rows.filter(r => r.passed);
  const failed = rows.filter(r => !r.passed && r.votes > 0);
  const notCounted = computed.result.totalValidVotes === 0;
  const blocs = computed.blocs;
  const blocColor = (id: string | null) => blocs.find(b => b.id === id)?.color ?? "#64748b";
  const problems = computed.result.errors;
  const closed = state.status === "closed";
  const groups = blocs.map(b => ({ id: b.id, label: b.name, color: b.color, seats: b.seats, parts: rows.filter(r => r.blocId === b.id && r.seats > 0).map(r => ({ id: r.id, label: r.name, seats: r.seats })) }));
  const unassigned = rows.filter(r => !r.blocId && r.seats > 0);
  const biggest = [...blocs].sort((a, b) => b.seats - a.seats)[0];

  return (
    <main className="min-h-screen bg-[#0b1220] text-white p-4 sm:p-6 md:p-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight flex items-center gap-3 flex-wrap">
            {state.election.name}
            {closed && <span className="text-sm font-bold bg-white text-[#0b1220] rounded-full px-3 py-1">תוצאות סופיות</span>}
          </h1>
          <p className="text-slate-400 mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm md:text-base">
            <span>{state.countedPercent !== null ? <>נספרו <b className="text-white num">{pct(state.countedPercent, 1)}</b> מהקולות</> : "טרם דווח אחוז ספירה"}</span>
            {!notCounted && <span>מנדט = <b className="text-white num">{n(Math.round(computed.result.measure))}</b> קולות</span>}
            {!notCounted && <span>אחוז חסימה <b className="text-white num">{n(computed.result.thresholdVotes)}</b> קולות</span>}
            <span>עודכן <b className="text-white num">{clock(state.updatedAt)}</b></span>
            {state.note && <span className="text-slate-300">{state.note}</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
          <span className="inline-flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${error ? "bg-red-400" : "bg-emerald-400"} animate-pulse`} />{error ? "אין קשר לשרת" : `חי · ${clock(loadedAt)}`}</span>
          {role === "admin" && <Link href="/admin" className="text-slate-300 hover:text-white underline underline-offset-4">ניהול</Link>}
          <form action="/api/logout" method="post"><button className="text-slate-400 hover:text-white underline underline-offset-4">יציאה</button></form>
        </div>
      </header>

      {problems.length > 0 && (
        <div className="mt-5 rounded-2xl bg-red-500/15 border border-red-400/40 p-4 text-red-200"><b>שימו לב:</b> {problems.join(" · ")}</div>
      )}
      {computed.result.warnings.length > 0 && (
        <div className="mt-5 rounded-2xl bg-amber-500/10 border border-amber-400/30 p-3 text-amber-200 text-sm">{computed.result.warnings.join(" · ")}</div>
      )}

      {notCounted ? (
        <div className="mt-16 text-center text-slate-400 text-xl">עדיין לא הוזנו קולות.</div>
      ) : (
        <>
          {/* parliament + bloc totals */}
          <section className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr] items-center">
            <div className="rounded-3xl bg-white/[0.04] border border-white/10 p-4 md:p-6">
              <Hemicycle groups={groups} />
            </div>
            <div className="grid gap-3">
              {blocs.map(b => (
                <div key={b.id} className={`rounded-2xl border p-4 flex items-center justify-between gap-4 ${b.id === biggest?.id && b.seats >= 61 ? "bg-white/[0.08] border-white/25" : "bg-white/[0.04] border-white/10"}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="h-10 w-2 rounded-full shrink-0" style={{ background: b.color }} />
                    <div className="min-w-0">
                      <div className="text-lg font-bold truncate">{b.name}</div>
                      <div className="text-slate-400 text-xs num">{b.partyIds.length} רשימות · {n(b.votes)} קולות{b.seats >= 61 ? " · רוב" : ""}</div>
                    </div>
                  </div>
                  <div className="text-4xl sm:text-5xl font-extrabold num leading-none" style={{ color: b.color }}>{b.seats}</div>
                </div>
              ))}
              {unassigned.length > 0 && (
                <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3"><span className="h-10 w-2 rounded-full shrink-0 bg-slate-500" /><div><div className="text-lg font-bold">ללא שיוך לגוש</div><div className="text-slate-400 text-xs">{unassigned.map(r => r.name).join(", ")}</div></div></div>
                  <div className="text-5xl font-extrabold num leading-none text-slate-300">{computed.unassignedSeats}</div>
                </div>
              )}
            </div>
          </section>

          {/* lists */}
          <section className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {passed.map(r => (
              <article key={r.id} className="rounded-2xl bg-white/[0.04] border border-white/10 overflow-hidden">
                <div className="px-4 sm:px-5 pt-4 pb-3 flex items-start gap-3 sm:gap-4">
                  <div className="h-16 w-1.5 rounded-full shrink-0 mt-1" style={{ background: blocColor(r.blocId) }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-xl sm:text-2xl font-bold leading-tight">{r.name}</span>
                      {r.letters && <span className="text-slate-400 text-base font-semibold">{r.letters}</span>}
                    </div>
                    <div className="text-slate-400 text-sm num mt-1">{n(r.votes)} קולות · {pct(r.percent)}</div>
                    <div className="mt-2 flex items-center gap-3">
                      <DangerDot level={r.dangerLevel} toLose={r.toLose} size={10} />
                      <AgreementBadge effect={r.agreementEffect} />
                    </div>
                  </div>
                  <div className="text-5xl sm:text-6xl font-extrabold num leading-none tracking-tight">{r.seats}</div>
                </div>
                {(r.toGain !== null || r.toLose !== null) && (
                  <div className="grid grid-cols-2 divide-x divide-x-reverse divide-white/10 border-t border-white/10 bg-black/20 text-sm">
                    <div className="px-5 py-2.5">
                      <div className="text-[11px] text-slate-500 uppercase tracking-wide">למנדט נוסף</div>
                      <div className="num font-semibold text-emerald-300">{r.toGain !== null ? <>עוד {n(r.toGain)}</> : "—"}</div>
                    </div>
                    <div className="px-5 py-2.5">
                      <div className="text-[11px] text-slate-500 uppercase tracking-wide">מרווח עד איבוד מנדט</div>
                      <div className="num font-semibold text-slate-200">{r.toLose !== null ? n(r.toLose) : "—"}</div>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </section>

          {/* threshold & next seat */}
          <section className="mt-8 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-5">
              <h2 className="font-bold text-slate-200">מתחת לאחוז החסימה</h2>
              {failed.length === 0 ? <p className="text-slate-500 text-sm mt-2">כל הרשימות שהוזנו עברו את אחוז החסימה.</p> : (
                <ul className="mt-3 space-y-2">
                  {failed.sort((a, b) => b.votes - a.votes).map(r => (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-sm">
                      <span><b>{r.name}</b> <span className="text-slate-400">{r.letters}</span></span>
                      <span className="num text-slate-300 whitespace-nowrap">{n(r.votes)} · {pct(r.percent)} · <span className="text-red-300">חסרים {n(-r.thresholdMargin)}</span></span>
                    </li>
                  ))}
                </ul>
              )}
              {passed.filter(r => r.thresholdMargin < 25000).length > 0 && (
                <p className="mt-3 text-xs text-amber-300">קרובות לאחוז החסימה: {passed.filter(r => r.thresholdMargin < 25000).map(r => `${r.name} (+${n(r.thresholdMargin)})`).join(", ")}</p>
              )}
            </div>
            <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-5">
              <h2 className="font-bold text-slate-200">המנדט הבא</h2>
              <dl className="mt-3 space-y-2 text-sm">
                {computed.closestGain && <div className="flex flex-wrap justify-between gap-x-3"><dt className="text-slate-400">הקרובה ביותר למנדט נוסף</dt><dd className="text-left"><b>{computed.closestGain.name}</b> — עוד <span className="num">{n(computed.closestGain.toGain)}</span> קולות</dd></div>}
                {computed.closestLoss && <div className="flex flex-wrap justify-between gap-x-3"><dt className="text-slate-400">הקרובה ביותר לאבד מנדט</dt><dd className="text-left"><b>{computed.closestLoss.name}</b> — מרווח <span className="num">{n(computed.closestLoss.toLose)}</span> קולות</dd></div>}
                <div className="flex justify-between"><dt className="text-slate-400">קולות כשרים</dt><dd className="num">{n(computed.result.totalValidVotes)}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-400">מנדטים בשלב הראשון / עודפים</dt><dd className="num">{computed.result.firstStageTotal} / {computed.result.totalSeats - computed.result.firstStageTotal}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-400">סה״כ מנדטים</dt><dd className={`num font-bold ${computed.result.totalSeats === 120 ? "text-emerald-300" : "text-red-300"}`}>{computed.result.totalSeats} / 120</dd></div>
              </dl>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
