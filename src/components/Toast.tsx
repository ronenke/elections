"use client";
import { useEffect, useState } from "react";

export interface ToastMsg { kind: "ok" | "error"; text: string; id: number }

export function useToast() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const push = (kind: ToastMsg["kind"], text: string) => setToasts(t => [...t, { kind, text, id: Date.now() + Math.random() }]);
  const remove = (id: number) => setToasts(t => t.filter(x => x.id !== id));
  return { toasts, push, remove };
}

export function Toasts({ toasts, remove }: { toasts: ToastMsg[]; remove: (id: number) => void }) {
  return (
    <div className="fixed bottom-4 left-4 z-50 space-y-2">
      {toasts.map(t => <Toast key={t.id} t={t} remove={remove} />)}
    </div>
  );
}

function Toast({ t, remove }: { t: ToastMsg; remove: (id: number) => void }) {
  useEffect(() => { const h = setTimeout(() => remove(t.id), t.kind === "ok" ? 3500 : 8000); return () => clearTimeout(h); }, [t, remove]);
  return (
    <div className={`rounded-xl px-4 py-3 text-sm shadow-lg border ${t.kind === "ok" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"}`}>
      {t.text}
    </div>
  );
}
