import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { promises as fs } from "fs";
import path from "path";
import type { ElectionState, Snapshot } from "./types";
import { seedState } from "./seed";

/**
 * Storage. In production: Supabase Postgres (service-role key, server-side only).
 * Locally without Supabase env vars: a JSON file under .data/ so you can develop and rehearse offline.
 */

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const useSupabase = !!(url && key);

let client: SupabaseClient | null = null;
function sb() {
  if (!client) client = createClient(url!, key!, { auth: { persistSession: false } });
  return client;
}

const dataDir = path.join(process.cwd(), ".data");
const stateFile = path.join(dataDir, "state.json");
const snapsFile = path.join(dataDir, "snapshots.json");

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try { return JSON.parse(await fs.readFile(file, "utf8")) as T; } catch { return fallback; }
}
async function writeJson(file: string, data: unknown) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2));
}

export function storageKind(): "supabase" | "file" {
  return useSupabase ? "supabase" : "file";
}

export async function getState(): Promise<ElectionState> {
  if (useSupabase) {
    const { data, error } = await sb().from("election_state").select("data").eq("id", 1).maybeSingle();
    if (error) throw new Error(`supabase read failed: ${error.message}`);
    if (data?.data) return data.data as ElectionState;
    const s = seedState();
    await saveState(s, "initial seed");
    return s;
  }
  const s = await readJson<ElectionState | null>(stateFile, null);
  if (s) return s;
  const seeded = seedState();
  await saveState(seeded, "initial seed");
  return seeded;
}

/** Save the state and record a snapshot. */
export async function saveState(state: ElectionState, note: string): Promise<ElectionState> {
  const next: ElectionState = { ...state, version: (state.version ?? 0) + 1, updatedAt: new Date().toISOString() };
  if (useSupabase) {
    const { error } = await sb().from("election_state").upsert({ id: 1, data: next, updated_at: next.updatedAt });
    if (error) throw new Error(`supabase write failed: ${error.message}`);
    const { error: e2 } = await sb().from("snapshots").insert({ note, data: next });
    if (e2) throw new Error(`supabase snapshot failed: ${e2.message}`);
    return next;
  }
  await writeJson(stateFile, next);
  const snaps = await readJson<Snapshot[]>(snapsFile, []);
  snaps.unshift({ id: (snaps[0]?.id ?? 0) + 1, created_at: next.updatedAt, note, data: next });
  await writeJson(snapsFile, snaps.slice(0, 500));
  return next;
}

export async function listSnapshots(limit = 100): Promise<Omit<Snapshot, "data">[]> {
  if (useSupabase) {
    const { data, error } = await sb().from("snapshots").select("id, created_at, note").order("id", { ascending: false }).limit(limit);
    if (error) throw new Error(error.message);
    return data as Omit<Snapshot, "data">[];
  }
  const snaps = await readJson<Snapshot[]>(snapsFile, []);
  return snaps.slice(0, limit).map(({ id, created_at, note }) => ({ id, created_at, note }));
}

export async function getSnapshot(id: number): Promise<Snapshot | null> {
  if (useSupabase) {
    const { data, error } = await sb().from("snapshots").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return (data as Snapshot) ?? null;
  }
  const snaps = await readJson<Snapshot[]>(snapsFile, []);
  return snaps.find(s => s.id === id) ?? null;
}
