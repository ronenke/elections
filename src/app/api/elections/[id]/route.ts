import { json } from "@/lib/api";
import { deleteElection, getElection, listElections, setActive, setStatus, updateMeta, StoreError } from "@/lib/store";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function fail(e: unknown) {
  const err = e as StoreError;
  return json({ error: "store", message: err.message }, { status: err.status ?? 500 });
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const s = await getElection(params.id);
  if (!s) return json({ error: "not found" }, { status: 404 });
  return json({ election: s });
}

/** body: { action: "activate" | "close" | "reopen" | "update", name?, date?, cecUrl? } */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = (await req.json().catch(() => ({}))) as { action?: string; name?: string; date?: string; cecUrl?: string };
  const { action } = body;
  try {
    if (action === "update") {
      if (!body.name?.trim()) return json({ error: "invalid", message: "יש לתת שם למערכת הבחירות" }, { status: 400 });
      await updateMeta(params.id, { name: body.name.trim(), date: body.date ?? "", cecUrl: (body.cecUrl ?? "").trim() });
    }
    else if (action === "activate") await setActive(params.id);
    else if (action === "close") await setStatus(params.id, "closed");
    else if (action === "reopen") await setStatus(params.id, "open");
    else return json({ error: "invalid", message: "פעולה לא מוכרת" }, { status: 400 });
    return json({ elections: await listElections() });
  } catch (e) { return fail(e); }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    await deleteElection(params.id);
    return json({ elections: await listElections() });
  } catch (e) { return fail(e); }
}
