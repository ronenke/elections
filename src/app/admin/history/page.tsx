"use client";
import { useEffect, useState } from "react";
import { useElection } from "@/components/useElection";
import { Toasts, useToast } from "@/components/Toast";
import { time, n, signed } from "@/lib/format";
import type { Computed } from "@/lib/compute";
import type { Snapshot } from "@/lib/types";

/** Every save is a snapshot. View any one, compare it to the current numbers, restore it. */
export default function HistoryPage() {
  const { data, reload } = useElection();
  const { toasts, push, remove } = useToast();
  const [list, setList] = useState<Omit<Snapshot, "data">[]>([]);
  const [sel, setSel] = useState<{ snapshot: Snapshot; computed: Computed } | null>(null);
  const [busy, setBusy] = useState(false);

  const loadList = async () => { const r = await fetch("/api/snapshots", { cache: "no-store" }); if (r.ok) setList((await r.json()).snapshots); };
  useEffect(() => { loadList(); }, []);

  async function view(id: number) {
    const r = await fetch(`/api/snapshots/${id}`, { cache: "no-store" });
    if (r.ok) setSel(await r.json());
  }
  async function restore(id: number) {
    if (!confirm(`לשחזר את גרסה #${id} כמצב הנוכחי? (הפעולה עצמה נשמרת בהיסטוריה)`)) return;
    setBusy(true);
    const r = await fetch(`/api/snapshots/${id}`, { method: "POST" });
    setBusy(false);
    if (r.ok) { push("ok", "שוחזר ופורסם"); await reload(); await loadList(); setSel(null); } else push("error", (await r.json().catch(() => ({}))).message ?? "השחזור נכשל");
  }

  return (
    <div className="space-y-5">
      <Toasts toasts={toasts} remove={remove} />
      <div><h1 className="text-2xl font-bold">היסטוריית עדכונים <span className="text-slate-400 font-normal text-lg">· {data?.state.election.name}</span></h1><p className="text-sm text-slate-500">כל שמירה נשמרת כגרסה. אפשר לצפות, להשוות למצב הנוכחי ולשחזר{data?.state.status === "closed" ? " (המערכת סגורה — שחזור אפשרי רק אחרי פתיחה מחדש)" : ""}.</p></div>
      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <div className="card overflow-hidden max-h-[40vh] lg:max-h-[75vh] overflow-y-auto">
          {list.length === 0 && <p className="p-4 text-sm text-slate-500">אין עדיין גרסאות.</p>}
          {list.map(s => (
            <button key={s.id} onClick={() => view(s.id)} className={`w-full text-right px-4 py-3 border-b border-slate-100 hover:bg-slate-50 ${sel?.snapshot.id === s.id ? "bg-blue-50" : ""}`}>
              <div className="flex items-center justify-between"><b className="text-sm">#{s.id}</b><span className="text-xs text-slate-500 num">{time(s.created_at)}</span></div>
              <div className="text-sm text-slate-700 mt-0.5">{s.note}</div>
            </button>
          ))}
        </div>
        <div className="card p-4">
          {!sel ? <p className="text-sm text-slate-500">בחרו גרסה מהרשימה.</p> : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div><b>גרסה #{sel.snapshot.id}</b> · <span className="text-slate-500 text-sm num">{time(sel.snapshot.created_at)}</span> · <span className="text-sm">{sel.snapshot.note}</span></div>
                <button className="btn-danger" onClick={() => restore(sel.snapshot.id)} disabled={busy || data?.state.status === "closed"}>שחזור גרסה זו</button>
              </div>
              <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-sm min-w-[520px]">
                <thead className="text-xs text-slate-500 bg-slate-50"><tr><th className="text-right px-3 py-2">רשימה</th><th className="text-right px-3 py-2">קולות בגרסה</th><th className="text-right px-3 py-2">לעומת עכשיו</th><th className="text-center px-3 py-2">מנדטים בגרסה</th><th className="text-center px-3 py-2">עכשיו</th></tr></thead>
                <tbody>
                  {sel.computed.rows.map(r => {
                    const now = data?.computed.rows.find(x => x.id === r.id);
                    return (
                      <tr key={r.id} className="border-t border-slate-100">
                        <td className="px-3 py-1.5 font-semibold">{r.name}</td>
                        <td className="px-3 py-1.5 num">{n(r.votes)}</td>
                        <td className="px-3 py-1.5 num text-slate-500">{now ? signed(r.votes - now.votes) : ""}</td>
                        <td className="px-3 py-1.5 text-center num font-bold">{r.seats}</td>
                        <td className={`px-3 py-1.5 text-center num ${now && now.seats !== r.seats ? "font-bold text-blue-700" : "text-slate-500"}`}>{now?.seats ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
