"use client";
import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginForm() {
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password }) });
    if (res.ok) {
      const body = await res.json().catch(() => ({}));
      const next = params.get("next");
      const home = body.home ?? "/admin";
      window.location.href = body.role === "admin" && next && next.startsWith("/") ? next : home;
      return;
    }
    const body = await res.json().catch(() => ({}));
    setError(body.error ?? "שגיאה בהתחברות");
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="card w-full max-w-sm p-8 space-y-5">
      <div className="text-center space-y-1">
        <div className="mx-auto h-12 w-12 rounded-2xl bg-blue-600 text-white grid place-items-center text-2xl font-extrabold">120</div>
        <h1 className="text-xl font-bold">חישוב מנדטים</h1>
        <p className="text-sm text-slate-500">כניסה למערכת</p>
      </div>
      <div>
        <label className="label" htmlFor="u">שם משתמש</label>
        <input id="u" className="input" autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} required autoFocus />
      </div>
      <div>
        <label className="label" htmlFor="p">סיסמה</label>
        <input id="p" className="input" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}
      <button className="btn-primary w-full justify-center" disabled={busy}>{busy ? "מתחבר…" : "כניסה"}</button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen grid place-items-center p-4 bg-gradient-to-b from-slate-100 to-slate-200">
      <Suspense><LoginForm /></Suspense>
    </main>
  );
}
