import { json } from "@/lib/api";
import { getState, listSnapshots } from "@/lib/store";
export const dynamic = "force-dynamic";
export const revalidate = 0;
/** Snapshots of the active election. */
export async function GET() {
  const state = await getState();
  return json({ electionId: state.id, snapshots: await listSnapshots(state.id, 300) });
}
