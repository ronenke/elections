/**
 * Parsing of results published by ועדת הבחירות המרכזית (votesNN.bechirot.gov.il).
 *
 * There is no official API. The national results page is an HTML table with, per list:
 * ballot letters, list name, votes and percent. The page also states how much has been counted.
 * We parse two inputs the same way:
 *   - the raw HTML of the page (fetched server-side), and
 *   - text pasted by the admin (copy the table from the browser and paste).
 * The result is a list of candidate rows that the admin reviews and maps to parties before applying.
 */

export interface ParsedRow {
  letters: string;
  name: string;
  votes: number;
  percent: number | null;
}

export interface ParsedResults {
  rows: ParsedRow[];
  countedPercent: number | null;
  totalValidVotes: number | null;
  warnings: string[];
}

const HEB = "א-ת";
const hebrewLetters = new RegExp(`^[${HEB}]{1,4}$`);

function toNumber(s: string): number | null {
  const t = s.replace(/[,\s ]/g, "");
  if (!/^\d+$/.test(t)) return null;
  return parseInt(t, 10);
}
function toPercent(s: string): number | null {
  const m = s.replace(/\s/g, "").match(/^(\d+(?:[.,]\d+)?)%?$/);
  if (!m) return null;
  const v = parseFloat(m[1].replace(",", "."));
  return Number.isFinite(v) ? v : null;
}

/** Normalize a Hebrew list name for matching: strip quotes/geresh/gershayim, hyphens, extra spaces, leading ה. */
export function normalizeName(s: string): string {
  return s
    .replace(/["'׳״״׳`]/g, "")
    .replace(/[-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^ה(?=[א-ת])/, "");
}

function htmlToRows(html: string): string[][] {
  const rows: string[][] = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m: RegExpExecArray | null;
  while ((m = trRe.exec(html))) {
    const cells: string[] = [];
    const tdRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let c: RegExpExecArray | null;
    while ((c = tdRe.exec(m[1]))) cells.push(stripTags(c[1]));
    if (cells.length) rows.push(cells);
  }
  return rows;
}

export function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/\s+/g, " ")
    .trim();
}

function textToRows(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => (l.includes("\t") ? l.split("\t") : l.split(/\s{2,}|\s*\|\s*/)).map(c => c.trim()).filter(Boolean));
}

/** Classify a row of cells into a ParsedRow if it looks like a results row. */
function classify(cells: string[]): ParsedRow | null {
  if (cells.length < 2) return null;
  let letters = "";
  let votes: number | null = null;
  let percent: number | null = null;
  const nameParts: string[] = [];
  for (const cell of cells) {
    const n = toNumber(cell);
    if (n !== null && votes === null && n >= 0 && !/%/.test(cell)) { votes = n; continue; }
    const p = /%/.test(cell) || /^\d+[.,]\d+$/.test(cell) ? toPercent(cell) : null;
    if (p !== null && percent === null) { percent = p; continue; }
    if (!letters && hebrewLetters.test(cell) && cells.length >= 3) { letters = cell; continue; }
    if (/[א-ת]/.test(cell)) nameParts.push(cell);
  }
  if (votes === null) return null;
  const name = nameParts.join(" ").trim();
  if (!name && !letters) return null;
  return { letters, name, votes, percent };
}

function findCounted(text: string): number | null {
  // e.g. "נספרו 87.4% מהקולות", "אחוז הקולות שנספרו: 100%"
  const m = text.match(/(?:נספר|ספיר|קלפיות|counted)[^%\d]{0,60}?(\d{1,3}(?:[.,]\d+)?)\s*%/i) ?? text.match(/(\d{1,3}(?:[.,]\d+)?)\s*%[^.\n]{0,40}(?:נספר|קלפיות)/i);
  return m ? parseFloat(m[1].replace(",", ".")) : null;
}
function findTotalValid(text: string): number | null {
  const m = text.match(/(?:קולות\s+כשרים|כשרים)[^\d]{0,40}(\d{1,3}(?:[,\s]\d{3})+|\d{4,})/);
  return m ? toNumber(m[1]) : null;
}

export function parseCecHtml(html: string): ParsedResults {
  const rows = htmlToRows(html).map(classify).filter((r): r is ParsedRow => !!r);
  const text = stripTags(html);
  return finish(rows, text);
}

export function parseCecText(text: string): ParsedResults {
  const rows = textToRows(text).map(classify).filter((r): r is ParsedRow => !!r);
  return finish(rows, text);
}

function finish(rows: ParsedRow[], text: string): ParsedResults {
  const warnings: string[] = [];
  // drop obvious non-list rows (totals)
  const filtered = rows.filter(r => !/סה[״"']?כ|סך|total/i.test(r.name));
  if (!filtered.length) warnings.push("לא זוהו שורות תוצאות. ודאו שהעתקתם את טבלת התוצאות הארצית (אותיות, שם, קולות, אחוז).");
  const seen = new Map<string, number>();
  for (const r of filtered) {
    const k = r.letters || normalizeName(r.name);
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  for (const [k, n] of seen) if (n > 1) warnings.push(`הרשימה "${k}" מופיעה ${n} פעמים`);
  return { rows: filtered, countedPercent: findCounted(text), totalValidVotes: findTotalValid(text), warnings };
}

/** Match parsed rows to configured parties by letters, then by normalized name. */
export function matchRows(rows: ParsedRow[], parties: { id: string; name: string; letters: string }[]) {
  const byLetters = new Map(parties.filter(p => p.letters).map(p => [p.letters.replace(/["'״׳]/g, ""), p.id]));
  const byName = new Map(parties.map(p => [normalizeName(p.name), p.id]));
  return rows.map(r => {
    const l = r.letters.replace(/["'״׳]/g, "");
    let partyId: string | null = (l && byLetters.get(l)) || null;
    if (!partyId) partyId = byName.get(normalizeName(r.name)) ?? null;
    if (!partyId) {
      // loose contains-match
      const n = normalizeName(r.name);
      for (const [pn, id] of byName) if (n && pn && (n.includes(pn) || pn.includes(n))) { partyId = id; break; }
    }
    return { ...r, partyId };
  });
}
