import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { promises as fs } from "fs";
import path from "path";
import type { ElectionState, ElectionSummary, Snapshot } from "./types";
import { seedState } from "./seed";

/**
 * Storage for several elections. Exactly one election is "active": the one the admin screens
 * edit and the on-air board shows. Every save records a snapshot for that election.
 *
 * Production: Supabase Postgres (service-role key, server-side only) — tables `elections`, `snapshots`, `app_settings`.
 * Local without Supabase env vars: JSON files under .data/ so you can develop and rehearse offline.
 */

const url = process.env.SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const useSupabase = !!(url && key);
/** On Vercel the filesystem is ephemeral and per-instance: a file fallback would silently lose data. Refuse. */
const onVercel = !!process.env.VERCEL;
if (onVercel && !useSupabase) {
  // eslint-disable-next-line no-console
  console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set — refusing to use file storage on Vercel");
}
function assertBackend() {
  if (onVercel && !useSupabase) throw new StoreError("חסרות הגדרות Supabase בשרת (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY). בדקו ב-Vercel → Settings → Environment Variables ובצעו Redeploy.", 500);
}

let client: SupabaseClient | null = null;
function sb() {
  // Next.js caches fetch() inside route handlers; the database must never be read from that cache.
  if (!client) client = createClient(url!, key!, { auth: { persistSession: false }, global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) } });
  return client;
}

export class StoreError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

// ---------------------------------------------------------------- file backend
const dataDir = path.join(process.cwd(), ".data");
const dbFile = path.join(dataDir, "db.json");
interface FileDb { activeId: string | null; elections: Record<string, ElectionState>; snapshots: Snapshot[] }

async function readDb(): Promise<FileDb> {
  try { return JSON.parse(await fs.readFile(dbFile, "utf8")) as FileDb; } catch { return { activeId: null, elections: {}, snapshots: [] }; }
}
async function writeDb(db: FileDb) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(dbFile, JSON.stringify(db, null, 2));
}

// ---------------------------------------------------------------- helpers
function summary(s: ElectionState, isActive: boolean): ElectionSummary {
  return { id: s.id, name: s.election.name, date: s.election.date, status: s.status, isActive, createdAt: s.createdAt, updatedAt: s.updatedAt, version: s.version };
}

export function storageKind(): "supabase" | "file" {
  return useSupabase ? "supabase" : "file";
}

// ---------------------------------------------------------------- active election
export async function getActiveId(): Promise<string | null> {
  assertBackend();
  if (useSupabase) {
    const { data, error } = await sb().from("app_settings").select("value").eq("key", "active_election").maybeSingle();
    if (error) throw new StoreError(`supabase read failed: ${error.message}`, 500);
    return (data?.value as string) ?? null;
  }
  return (await readDb()).activeId;
}

export async function setActive(id: string): Promise<void> {
  const s = await getElection(id);
  if (!s) throw new StoreError("מערכת הבחירות לא נמצאה", 404);
  if (useSupabase) {
    const { error } = await sb().from("app_settings").upsert({ key: "active_election", value: id });
    if (error) throw new StoreError(error.message, 500);
    return;
  }
  const db = await readDb();
  db.activeId = id;
  await writeDb(db);
}

/** The active election; creates a seeded one on a brand-new install. */
export async function getState(): Promise<ElectionState> {
  const id = await getActiveId();
  if (id) {
    const s = await getElection(id);
    if (s) return s;
  }
  // nothing active: pick the most recent, or seed
  const all = await listElections();
  if (all.length) { await setActive(all[0].id); return (await getElection(all[0].id))!; }
  const seeded = await createElection(seedState(), "יצירת מערכת בחירות");
  await setActive(seeded.id);
  return seeded;
}

// ---------------------------------------------------------------- CRUD
export async function listElections(): Promise<ElectionSummary[]> {
  assertBackend();
  const activeId = await getActiveId();
  if (useSupabase) {
    const { data, error } = await sb().from("elections").select("data").order("created_at", { ascending: false });
    if (error) throw new StoreError(`supabase read failed: ${error.message}`, 500);
    return (data ?? []).map(r => summary(r.data as ElectionState, (r.data as ElectionState).id === activeId));
  }
  const db = await readDb();
  return Object.values(db.elections).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(s => summary(s, s.id === activeId));
}

export async function getElection(id: string): Promise<ElectionState | null> {
  assertBackend();
  if (useSupabase) {
    const { data, error } = await sb().from("elections").select("data").eq("id", id).maybeSingle();
    if (error) throw new StoreError(`supabase read failed: ${error.message}`, 500);
    return (data?.data as ElectionState) ?? null;
  }
  return (await readDb()).elections[id] ?? null;
}

async function persist(next: ElectionState, note: string): Promise<void> {
  assertBackend();
  if (useSupabase) {
    const { error } = await sb().from("elections").upsert({ id: next.id, name: next.election.name, status: next.status, data: next, updated_at: next.updatedAt, created_at: next.createdAt });
    if (error) throw new StoreError(`supabase write failed: ${error.message}`, 500);
    const { error: e2 } = await sb().from("snapshots").insert({ election_id: next.id, note, data: next });
    if (e2) throw new StoreError(`supabase snapshot failed: ${e2.message}`, 500);
    return;
  }
  const db = await readDb();
  db.elections[next.id] = next;
  db.snapshots.unshift({ id: (db.snapshots[0]?.id ?? 0) + 1, election_id: next.id, created_at: next.updatedAt, note, data: next });
  db.snapshots = db.snapshots.slice(0, 2000);
  await writeDb(db);
}

export async function createElection(state: ElectionState, note = "יצירת מערכת בחירות"): Promise<ElectionState> {
  const now = new Date().toISOString();
  const next: ElectionState = { ...state, status: "open", createdAt: now, updatedAt: now, version: 1 };
  await persist(next, note);
  return next;
}

/**
 * Save a new version of an election's results/settings and record a snapshot.
 * Refuses when the election is closed (results are final) unless `allowClosed` is set
 * (used only by close/reopen itself).
 */
export async function saveState(state: ElectionState, note: string, opts: { allowClosed?: boolean } = {}): Promise<ElectionState> {
  const current = await getElection(state.id);
  if (!current) throw new StoreError("מערכת הבחירות לא נמצאה", 404);
  if (current.status === "closed" && !opts.allowClosed) throw new StoreError("מערכת הבחירות סגורה — התוצאות סופיות. כדי לערוך יש לפתוח אותה מחדש במסך 'מערכות בחירות'.", 423);
  const next: ElectionState = { ...state, createdAt: current.createdAt, version: (current.version ?? 0) + 1, updatedAt: new Date().toISOString() };
  await persist(next, note);
  return next;
}

export async function setStatus(id: string, status: "open" | "closed"): Promise<ElectionState> {
  const s = await getElection(id);
  if (!s) throw new StoreError("מערכת הבחירות לא נמצאה", 404);
  return saveState({ ...s, status }, status === "closed" ? "סגירת מערכת הבחירות — תוצאות סופיות" : "פתיחה מחדש של מערכת הבחירות", { allowClosed: true });
}

export async function deleteElection(id: string): Promise<void> {
  const activeId = await getActiveId();
  if (id === activeId) throw new StoreError("לא ניתן למחוק את מערכת הבחירות הפעילה — הפעילו אחרת קודם", 400);
  if (useSupabase) {
    const { error } = await sb().from("snapshots").delete().eq("election_id", id);
    if (error) throw new StoreError(error.message, 500);
    const { error: e2 } = await sb().from("elections").delete().eq("id", id);
    if (e2) throw new StoreError(e2.message, 500);
    return;
  }
  const db = await readDb();
  delete db.elections[id];
  db.snapshots = db.snapshots.filter(s => s.election_id !== id);
  await writeDb(db);
}

// ---------------------------------------------------------------- snapshots
export async function listSnapshots(electionId: string, limit = 200): Promise<Omit<Snapshot, "data">[]> {
  if (useSupabase) {
    const { data, error } = await sb().from("snapshots").select("id, election_id, created_at, note").eq("election_id", electionId).order("id", { ascending: false }).limit(limit);
    if (error) throw new StoreError(error.message, 500);
    return data as Omit<Snapshot, "data">[];
  }
  const db = await readDb();
  return db.snapshots.filter(s => s.election_id === electionId).slice(0, limit).map(({ id, election_id, created_at, note }) => ({ id, election_id, created_at, note }));
}

export async function getSnapshot(id: number): Promise<Snapshot | null> {
  if (useSupabase) {
    const { data, error } = await sb().from("snapshots").select("*").eq("id", id).maybeSingle();
    if (error) throw new StoreError(error.message, 500);
    return (data as Snapshot) ?? null;
  }
  return (await readDb()).snapshots.find(s => s.id === id) ?? null;
}

/** Self-test for the diagnostics page: which backend, can we read, can we write, what is active. */
export async function diagnostics(): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {
    backend: storageKind(),
    onVercel,
    env: { SUPABASE_URL: !!url, SUPABASE_SERVICE_ROLE_KEY: !!key, ADMIN_USERNAME: !!process.env.ADMIN_USERNAME, ADMIN_PASSWORD: !!process.env.ADMIN_PASSWORD, SESSION_SECRET: !!process.env.SESSION_SECRET },
    supabaseHost: url ? new URL(url).host : null,
    region: process.env.VERCEL_REGION ?? null,
    deployment: process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    time: new Date().toISOString(),
  };
  try {
    out.activeElectionId = await getActiveId();
    const list = await listElections();
    out.elections = list.map(e => ({ id: e.id, name: e.name, status: e.status, isActive: e.isActive, version: e.version }));
  } catch (e) { out.readError = (e as Error).message; }
  if (useSupabase) {
    for (const t of ["elections", "snapshots", "app_settings", "election_state"]) {
      const { error, count } = await sb().from(t).select("*", { count: "exact", head: true });
      (out as Record<string, unknown>)[`table_${t}`] = error ? `ERROR: ${error.message}` : `ok (${count} rows)`;
    }
    // write round-trip on app_settings
    const probe = `probe-${Date.now()}`;
    const { error: w } = await sb().from("app_settings").upsert({ key: "diagnostics_probe", value: probe });
    if (w) out.writeTest = `ERROR: ${w.message}`;
    else {
      const { data, error: r } = await sb().from("app_settings").select("value").eq("key", "diagnostics_probe").maybeSingle();
      out.writeTest = r ? `ERROR: ${r.message}` : data?.value === probe ? "ok (write + read back)" : `MISMATCH: wrote ${probe}, read ${data?.value}`;
    }
  } else {
    try { await fs.mkdir(dataDir, { recursive: true }); await fs.writeFile(path.join(dataDir, ".probe"), "1"); out.writeTest = `ok (file: ${dataDir})`; } catch (e) { out.writeTest = `ERROR: ${(e as Error).message}`; }
  }
  return out;
}
