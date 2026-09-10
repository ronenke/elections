"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ElectionState } from "@/lib/types";
import type { Computed } from "@/lib/compute";

export interface Loaded { state: ElectionState; computed: Computed }

/** Loads /api/state and optionally polls it (for the on-air board). */
export function useElection(pollMs = 0) {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      if (res.status === 401) { window.location.href = "/login"; return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setLoadedAt(new Date().toISOString());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
    if (!pollMs) return;
    const tick = () => { timer.current = setTimeout(async () => { await load(); tick(); }, pollMs); };
    tick();
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [load, pollMs]);

  /** Save a full state document. Returns the saved data or throws with a Hebrew message. */
  const save = useCallback(async (state: ElectionState, note: string): Promise<Loaded> => {
    const res = await fetch("/api/state", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ state, note, expectedVersion: state.version }) });
    const body = await res.json();
    if (!res.ok) throw new Error(body.message ?? body.error ?? `HTTP ${res.status}`);
    setData(body);
    setLoadedAt(new Date().toISOString());
    return body as Loaded;
  }, []);

  return { data, error, loadedAt, reload: load, save, setData };
}
