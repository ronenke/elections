import { json } from "@/lib/api";
import { parseCecText, parseCecHtml, matchRows } from "@/lib/cec/parse";
import { getState } from "@/lib/store";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Parse text (or HTML) pasted by the admin. Nothing is saved here. */
export async function POST(req: Request) {
  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  if (!text?.trim()) return json({ error: "לא הודבק טקסט" }, { status: 400 });
  const state = await getState();
  const parsed = /<t[dr][\s>]/i.test(text) ? parseCecHtml(text) : parseCecText(text);
  return json({ ...parsed, rows: matchRows(parsed.rows, state.parties) });
}
