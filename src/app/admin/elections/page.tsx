"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Toasts, useToast } from "@/components/Toast";
import type { ElectionSummary } from "@/lib/types";
import { time } from "@/lib/format";

/**
 * Elections: create one (blank / Knesset 26 preset / 2022 rehearsal / copy of another), choose which is
 * active (the one all admin screens edit and the board shows), close when results are final, reopen, delete.
 */
export default function ElectionsPage() {
  const { toasts, push, remove } = useToast();
  const [list, setList] = useState<ElectionSummary[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [cecUrl, setCecUrl] = useState("");
  const [template, setTemplate] = useState<"blank" | "knesset26" | "knesset25" | "copy">("blank");
  const [copyFrom, setCopyFrom] = useState("");
  const [edit, setEdit] = useState<{ id: string; name: string; date: string; cecUrl: string } | null>(null);

  const load = async () => {
    const r = await fetch("/api/elections", { cache: "no-store" });
    if (r.status === 401) { window.location.href = "/login"; return; }
    setList((await r.json()).elections);
  };
  useEffect(() => { load(); }, []);

  async function call(url: string, init: RequestInit, okMsg: string, key: string) {
    setBusy(key);
    try {
      const r = await fetch(url, { headers: { "content-type": "application/json" }, ...init });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.message ?? body.error ?? `HTTP ${r.status}`);
      if (body.elections) setList(body.elections);
      push("ok", okMsg);
      return body;
    } catch (e) { push("error", (e as Error).message); } finally { setBusy(null); }
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    const body = await call("/api/elections", { method: "POST", body: JSON.stringify({ name, date, cecUrl, template, copyFromId: template === "copy" ? copyFrom : undefined, activate: true }) }, "מערכת הבחירות נוצרה והופעלה", "create");
    if (body) { setName(""); setDate(""); setCecUrl(""); }
  }
  const activate = (id: string) => call(`/api/elections/${id}`, { method: "PATCH", body: JSON.stringify({ action: "activate" }) }, "מערכת הבחירות הופעלה — לוח השידור ומסכי הניהול מציגים אותה עכשיו", id);
  const close = (el: ElectionSummary) => {
    if (!confirm(`לסגור את "${el.name}"?\n\nהתוצאות יסומנו כסופיות ולא ניתן יהיה לשנות קולות, רשימות או הסכמים עד לפתיחה מחדש.`)) return;
    return call(`/api/elections/${el.id}`, { method: "PATCH", body: JSON.stringify({ action: "close" }) }, "מערכת הבחירות נסגרה — התוצאות סופיות", el.id);
  };
  const reopen = (el: ElectionSummary) => {
    if (!confirm(`לפתוח מחדש את "${el.name}" לעריכה?`)) return;
    return call(`/api/elections/${el.id}`, { method: "PATCH", body: JSON.stringify({ action: "reopen" }) }, "מערכת הבחירות נפתחה מחדש", el.id);
  };
  async function startEdit(el: ElectionSummary) {
    const r = await fetch(`/api/elections/${el.id}`, { cache: "no-store" });
    const b = await r.json();
    setEdit({ id: el.id, name: b.election.election.name, date: b.election.election.date ?? "", cecUrl: b.election.election.cecUrl ?? "" });
  }
  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!edit) return;
    const ok = await call(`/api/elections/${edit.id}`, { method: "PATCH", body: JSON.stringify({ action: "update", name: edit.name, date: edit.date, cecUrl: edit.cecUrl }) }, "הפרטים נשמרו", edit.id);
    if (ok) setEdit(null);
  }
  const del = (el: ElectionSummary) => {
    if (!confirm(`למחוק לצמיתות את "${el.name}" כולל כל ההיסטוריה שלה?\n\nאין דרך לשחזר מחיקה.`)) return;
    if (!confirm(`בטוח? "${el.name}" תימחק לצמיתות.`)) return;
    return call(`/api/elections/${el.id}`, { method: "DELETE" }, "נמחק", el.id);
  };

  if (!list) return <p className="text-slate-500">טוען…</p>;
  const active = list.find(e => e.isActive);

  return (
    <div className="space-y-5">
      <Toasts toasts={toasts} remove={remove} />
      <div>
        <h1 className="text-2xl font-bold">מערכות בחירות</h1>
        <p className="text-sm text-slate-500">המערכת <b>הפעילה</b> היא זו שמסכי הניהול עורכים ולוח השידור מציג. סגירה מקפיאה את התוצאות כסופיות.</p>
      </div>

      <div className="card overflow-hidden">
        {list.map(el => (
          <div key={el.id} className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 ${el.isActive ? "bg-blue-50/60" : ""}`}>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-lg">{el.name || "(ללא שם)"}</span>
                {el.isActive && <span className="badge bg-blue-600 text-white">פעילה</span>}
                {el.status === "closed" ? <span className="badge bg-slate-800 text-white">🔒 סגורה — תוצאות סופיות</span> : <span className="badge bg-emerald-100 text-emerald-800">פתוחה</span>}
              </div>
              <div className="text-xs text-slate-500 mt-1 num">{el.date && <>תאריך {el.date} · </>}עודכן {time(el.updatedAt)} · גרסה {el.version}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button className="btn-secondary" disabled={busy !== null} onClick={() => startEdit(el)}>עריכת פרטים</button>
              {!el.isActive && <button className="btn-secondary" disabled={busy !== null} onClick={() => activate(el.id)}>הפעלה</button>}
              {el.status === "open"
                ? <button className="btn-danger" disabled={busy !== null} onClick={() => close(el)}>סגירה (תוצאות סופיות)</button>
                : <button className="btn-secondary" disabled={busy !== null} onClick={() => reopen(el)}>פתיחה מחדש</button>}
              {!el.isActive && <button className="text-red-500 hover:text-red-700 text-xs px-2" disabled={busy !== null} onClick={() => del(el)}>מחיקה</button>}
            </div>
          </div>
        ))}
      </div>

      {edit && (
        <form onSubmit={saveEdit} className="card p-4 space-y-4 border-blue-300 ring-2 ring-blue-100">
          <h2 className="font-bold">עריכת פרטי מערכת הבחירות</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <div><label className="label">שם *</label><input className="input" value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} required autoFocus /></div>
            <div><label className="label">תאריך</label><input className="input num" type="date" value={edit.date} onChange={e => setEdit({ ...edit, date: e.target.value })} /></div>
            <div><label className="label">כתובת דף התוצאות של ועדת הבחירות</label><input className="input num" dir="ltr" value={edit.cecUrl} onChange={e => setEdit({ ...edit, cecUrl: e.target.value })} placeholder="https://votes26.bechirot.gov.il/" /></div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">ניתן לערוך גם מערכת סגורה — אלה פרטים, לא תוצאות.</p>
            <div className="flex gap-2"><button type="button" className="btn-secondary" onClick={() => setEdit(null)}>ביטול</button><button className="btn-primary" disabled={busy !== null || !edit.name.trim()}>שמירה</button></div>
          </div>
        </form>
      )}

      <form onSubmit={create} className="card p-4 space-y-4">
        <h2 className="font-bold">יצירת מערכת בחירות חדשה</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <div><label className="label">שם *</label><input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="למשל: הבחירות לכנסת ה-27" required /></div>
          <div><label className="label">תאריך</label><input className="input num" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div><label className="label">כתובת דף התוצאות של ועדת הבחירות</label><input className="input num" dir="ltr" value={cecUrl} onChange={e => setCecUrl(e.target.value)} placeholder="https://votes27.bechirot.gov.il/" /></div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="label">להתחיל מ…</label>
            <select className="input" value={template} onChange={e => setTemplate(e.target.value as typeof template)}>
              <option value="blank">רשימה ריקה (להוסיף רשימות ידנית)</option>
              <option value="knesset26">רשימות הכנסת ה-26 (2026)</option>
              <option value="knesset25">תוצאות הכנסת ה-25 (2022) — לחזרה גנרלית</option>
              <option value="copy">העתקת רשימות/גושים/הסכמים ממערכת קיימת (ללא קולות)</option>
            </select>
          </div>
          {template === "copy" && (
            <div>
              <label className="label">להעתיק מ</label>
              <select className="input" value={copyFrom} onChange={e => setCopyFrom(e.target.value)} required>
                <option value="">— בחרו —</option>
                {list.map(el => <option key={el.id} value={el.id}>{el.name}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-slate-500">המערכת החדשה תהפוך לפעילה מיד. {active && <>המערכת הפעילה כרגע: <b>{active.name}</b>.</>}</p>
          <button className="btn-primary" disabled={busy !== null || !name.trim()}>{busy === "create" ? "יוצר…" : "יצירה והפעלה"}</button>
        </div>
      </form>
    </div>
  );
}
