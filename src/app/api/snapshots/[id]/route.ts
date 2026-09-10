import { json } from "@/lib/api";
import { getSnapshot, saveState, StoreError } from "@/lib/store";
import { compute } from "@/lib/compute";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const snap = await getSnapshot(Number(params.id));
  if (!snap) return json({ error: "not found" }, { status: 404 });
  return json({ snapshot: snap, computed: compute(snap.data, false) });
}

/** Restore a snapshot as the current state of its election (refused when the election is closed). */
export async function POST(_: Request, { params }: { params: { id: string } }) {
  const snap = await getSnapshot(Number(params.id));
  if (!snap) return json({ error: "not found" }, { status: 404 });
  try {
    const saved = await saveState({ ...snap.data, status: "open", source: "restore" }, `שחזור גרסה #${snap.id}`);
    return json({ state: saved });
  } catch (e) {
    const err = e as StoreError;
    return json({ error: "store", message: err.message }, { status: err.status ?? 500 });
  }
}
