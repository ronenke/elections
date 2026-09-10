"use client";
import { useEffect, useState } from "react";

/** Diagnostics: which storage backend the server is using, whether it can read and write, and what is active. */
export default function StatusPage() {
  const [d, setD] = useState<Record<string, unknown> | null>(null);
  const load = async () => { const r = await fetch("/api/status", { cache: "no-store" }); setD(await r.json()); };
  useEffect(() => { load(); }, []);
  if (!d) return <p className="text-slate-500">בודק…</p>;
  const bad = (v: unknown) => typeof v === "string" && /ERROR|MISMATCH/.test(v);
  const problems: string[] = [];
  if (d.fatal) problems.push(String(d.fatal));
  if (d.backend !== "supabase") problems.push("השרת לא משתמש ב-Supabase — הנתונים לא יישמרו. בדקו את משתני הסביבה ב-Vercel ובצעו Redeploy.");
  for (const [k, v] of Object.entries(d)) if (bad(v)) problems.push(`${k}: ${v}`);
  if (typeof d.table_elections === "string" && d.table_elections.startsWith("ERROR")) problems.push("הטבלה elections חסרה — יש להריץ את migration-002.sql ב-Supabase.");
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">מצב המערכת</h1><button className="btn-secondary" onClick={load}>בדיקה מחדש</button></div>
      {problems.length === 0
        ? <div className="rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 p-4">✅ הכול תקין: השרת קורא וכותב ל-Supabase, והמערכת הפעילה היא <b>{String((d.elections as { name: string; isActive: boolean }[] | undefined)?.find(e => e.isActive)?.name ?? d.activeElectionId)}</b>.</div>
        : <div className="rounded-2xl bg-red-50 border border-red-200 text-red-800 p-4 space-y-1"><b>נמצאו בעיות:</b>{problems.map((p, i) => <div key={i}>• {p}</div>)}</div>}
      <pre className="card p-4 text-xs overflow-x-auto" dir="ltr">{JSON.stringify(d, null, 2)}</pre>
      <p className="text-xs text-slate-500">אם משהו לא תקין — צלמו את המסך הזה ושלחו.</p>
    </div>
  );
}
