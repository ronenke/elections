import { NextResponse } from "next/server";
import { createElection, listElections, setActive, getElection, StoreError } from "@/lib/store";
import { blankState, rehearsal2022, seedState } from "@/lib/seed";
import type { ElectionState } from "@/lib/types";
export const dynamic = "force-dynamic";

function fail(e: unknown) {
  const err = e as StoreError;
  return NextResponse.json({ error: "store", message: err.message }, { status: err.status ?? 500 });
}

export async function GET() {
  try { return NextResponse.json({ elections: await listElections() }); } catch (e) { return fail(e); }
}

/**
 * Create an election. body: { name, date?, cecUrl?, template: "blank" | "knesset26" | "knesset25" | "copy", copyFromId?, activate? }
 * "copy" duplicates lists/blocs/agreements of another election with zero votes.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { name?: string; date?: string; cecUrl?: string; template?: string; copyFromId?: string; activate?: boolean };
  const name = (body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "invalid", message: "יש לתת שם למערכת הבחירות" }, { status: 400 });
  try {
    let base: ElectionState;
    switch (body.template) {
      case "knesset26": base = seedState(); break;
      case "knesset25": base = rehearsal2022(); break;
      case "copy": {
        const src = body.copyFromId ? await getElection(body.copyFromId) : null;
        if (!src) return NextResponse.json({ error: "invalid", message: "מערכת הבחירות להעתקה לא נמצאה" }, { status: 400 });
        base = { ...blankState(name), parties: src.parties, blocs: src.blocs, agreements: src.agreements, votes: Object.fromEntries(src.parties.map(p => [p.id, 0])), election: { ...src.election } };
        break;
      }
      default: base = blankState(name);
    }
    const state: ElectionState = {
      ...base,
      election: { name, date: body.date ?? base.election.date ?? "", cecUrl: body.cecUrl ?? base.election.cecUrl ?? "" },
      note: "", countedPercent: base.countedPercent, source: "seed",
    };
    const created = await createElection(state);
    if (body.activate !== false) await setActive(created.id);
    return NextResponse.json({ election: created, elections: await listElections() });
  } catch (e) { return fail(e); }
}
