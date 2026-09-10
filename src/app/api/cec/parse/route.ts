import { NextResponse } from "next/server";
import { parseCecText, parseCecHtml, matchRows } from "@/lib/cec/parse";
import { getState } from "@/lib/store";
export const dynamic = "force-dynamic";

/** Parse text (or HTML) pasted by the admin. Nothing is saved here. */
export async function POST(req: Request) {
  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  if (!text?.trim()) return NextResponse.json({ error: "לא הודבק טקסט" }, { status: 400 });
  const state = await getState();
  const parsed = /<t[dr][\s>]/i.test(text) ? parseCecHtml(text) : parseCecText(text);
  return NextResponse.json({ ...parsed, rows: matchRows(parsed.rows, state.parties) });
}
