import { NextResponse } from "next/server";
import { getSnapshot, saveState } from "@/lib/store";
import { compute } from "@/lib/compute";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const snap = await getSnapshot(Number(params.id));
  if (!snap) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ snapshot: snap, computed: compute(snap.data, false) });
}

/** Restore a snapshot as the current state. */
export async function POST(_: Request, { params }: { params: { id: string } }) {
  const snap = await getSnapshot(Number(params.id));
  if (!snap) return NextResponse.json({ error: "not found" }, { status: 404 });
  const saved = await saveState({ ...snap.data, source: "restore" }, `שחזור גרסה #${snap.id}`);
  return NextResponse.json({ state: saved });
}
