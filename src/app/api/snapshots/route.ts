import { NextResponse } from "next/server";
import { listSnapshots } from "@/lib/store";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json({ snapshots: await listSnapshots(200) });
}
