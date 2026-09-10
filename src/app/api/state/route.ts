import { NextResponse } from "next/server";
import { getState, saveState } from "@/lib/store";
import { compute } from "@/lib/compute";
import type { ElectionState } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = await getState();
  return NextResponse.json({ state, computed: compute(state) });
}

/** Replace the whole state (admin screens send the full document). Records a snapshot. */
export async function PUT(req: Request) {
  const body = (await req.json()) as { state: ElectionState; note?: string; expectedVersion?: number };
  const current = await getState();
  if (body.expectedVersion !== undefined && body.expectedVersion !== current.version) {
    return NextResponse.json({ error: "conflict", message: "הנתונים השתנו בינתיים על ידי משתמש אחר. רעננו את הדף ונסו שוב.", current }, { status: 409 });
  }
  const s = body.state;
  // sanitize votes
  const votes: Record<string, number> = {};
  for (const p of s.parties) {
    const v = Number(s.votes?.[p.id] ?? 0);
    votes[p.id] = Number.isFinite(v) && v >= 0 ? Math.round(v) : 0;
  }
  const next: ElectionState = { ...s, votes, otherValidVotes: Math.max(0, Math.round(Number(s.otherValidVotes) || 0)) };
  const check = compute(next, false);
  if (!check.result.ok && check.result.errors.length) {
    return NextResponse.json({ error: "invalid", message: check.result.errors.join("; ") }, { status: 400 });
  }
  const saved = await saveState(next, body.note ?? "עדכון");
  return NextResponse.json({ state: saved, computed: compute(saved) });
}
