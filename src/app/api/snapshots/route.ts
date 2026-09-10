import { NextResponse } from "next/server";
import { getState, listSnapshots } from "@/lib/store";
export const dynamic = "force-dynamic";
/** Snapshots of the active election. */
export async function GET() {
  const state = await getState();
  return NextResponse.json({ electionId: state.id, snapshots: await listSnapshots(state.id, 300) });
}
