import { json } from "@/lib/api";
import { getState, saveState, StoreError } from "@/lib/store";
import { compute } from "@/lib/compute";
import type { ElectionState } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function fail(e: unknown) {
  const err = e as StoreError;
  return json({ error: "store", message: err.message }, { status: err.status ?? 500 });
}

/** The active election, computed. */
export async function GET() {
  try {
    const state = await getState();
    return json({ state, computed: compute(state) });
  } catch (e) { return fail(e); }
}

/** Replace the active election's document (admin screens send the full document). Records a snapshot. */
export async function PUT(req: Request) {
  const body = (await req.json()) as { state: ElectionState; note?: string; expectedVersion?: number };
  try {
    const current = await getState();
    if (body.state.id !== current.id) {
      return json({ error: "conflict", message: "מערכת הבחירות הפעילה השתנתה. רעננו את הדף.", current }, { status: 409 });
    }
    if (body.expectedVersion !== undefined && body.expectedVersion !== current.version) {
      return json({ error: "conflict", message: "הנתונים השתנו בינתיים על ידי משתמש אחר. רעננו את הדף ונסו שוב.", current }, { status: 409 });
    }
    const s = body.state;
    const votes: Record<string, number> = {};
    for (const p of s.parties) {
      const v = Number(s.votes?.[p.id] ?? 0);
      votes[p.id] = Number.isFinite(v) && v >= 0 ? Math.round(v) : 0;
    }
    // status can only be changed through /api/elections/[id]
    const next: ElectionState = { ...s, status: current.status, votes, otherValidVotes: Math.max(0, Math.round(Number(s.otherValidVotes) || 0)) };
    const check = compute(next, false);
    if (!check.result.ok && check.result.errors.length) {
      return json({ error: "invalid", message: check.result.errors.join("; ") }, { status: 400 });
    }
    const saved = await saveState(next, body.note ?? "עדכון");
    return json({ state: saved, computed: compute(saved) });
  } catch (e) { return fail(e); }
}
