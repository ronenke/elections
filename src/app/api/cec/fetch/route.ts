import { json } from "@/lib/api";
import { parseCecHtml, matchRows } from "@/lib/cec/parse";
import { getState } from "@/lib/store";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Fetch the CEC national results page server-side and return parsed rows for review. Nothing is saved here. */
export async function POST(req: Request) {
  const { url } = (await req.json().catch(() => ({}))) as { url?: string };
  const state = await getState();
  const target = (url || state.election.cecUrl || "").trim();
  if (!/^https:\/\/[a-z0-9.-]*bechirot\.gov\.il\//i.test(target)) {
    return json({ error: "כתובת לא חוקית — יש להשתמש בכתובת של אתר ועדת הבחירות (bechirot.gov.il)" }, { status: 400 });
  }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch(target, {
      signal: ctrl.signal,
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36", "Accept-Language": "he-IL,he;q=0.9" },
    });
    clearTimeout(t);
    if (!res.ok) return json({ error: `אתר ועדת הבחירות החזיר שגיאה ${res.status}` }, { status: 502 });
    const html = await res.text();
    const parsed = parseCecHtml(html);
    return json({ ...parsed, rows: matchRows(parsed.rows, state.parties), fetchedAt: new Date().toISOString(), url: target });
  } catch (e) {
    return json({ error: `לא ניתן להביא את הדף (${(e as Error).message}). נסו שוב, או העתיקו את הטבלה והדביקו אותה.` }, { status: 502 });
  }
}
