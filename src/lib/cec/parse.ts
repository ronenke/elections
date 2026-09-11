/**
 * Parsing of results published by ועדת הבחירות המרכזית (votesNN.bechirot.gov.il).
 *
 * The national results table (as of the 25th Knesset site) has, per list:
 *   שם הרשימה | אותיות הרשימה | מנדטים (only once results are final) | אחוז קולות הרשימה | מספר הקולות הכשרים לרשימה
 * Columns are identified BY THEIR HEADER TEXT, never by position — the mandates column appears only for
 * final results and would otherwise be mistaken for votes. When no header can be found, a heuristic
 * is used (largest integer = votes, an integer ≤ 120 next to it = mandates) and the result is flagged.
 *
 * Every parse is then cross-checked: each row's percent must match votes ÷ total, and the sum of votes
 * must not exceed the published total. Inconsistencies are reported as `errors` and block the import.
 */

export interface ParsedRow {
  letters: string;
  name: string;
  votes: number;
  percent: number | null;
  /** mandates as published by the CEC (final results only) — used as a cross-check against our own calculation */
  seats: number | null;
}

export interface ParsedResults {
  rows: ParsedRow[];
  countedPercent: number | null;
  totalValidVotes: number | null;
  /** how columns were identified */
  method: "header" | "heuristic";
  warnings: string[];
  /** problems that make the numbers untrustworthy; the UI refuses to apply while any exist */
  errors: string[];
}

const hebrewLetters = /^[א-ת]{1,4}$/;

function toInt(s: string): number | null {
  const t = s.replace(/[,\s ]/g, "");
  if (!/^\d+$/.test(t)) return null;
  return parseInt(t, 10);
}
function toPercent(s: string): number | null {
  const m = s.replace(/[\s ]/g, "").match(/^(\d+(?:[.,]\d+)?)%$/);
  if (!m) return null;
  const v = parseFloat(m[1].replace(",", "."));
  return Number.isFinite(v) ? v : null;
}

/** Normalize a Hebrew list name for matching: strip quotes/geresh/gershayim, hyphens, extra spaces, leading ה. */
export function normalizeName(s: string): string {
  return s
    .replace(/["'׳״`]/g, "")
    .replace(/[-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^ה(?=[א-ת])/, "");
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

function textToRows(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => (l.includes("\t") ? l.split("\t") : l.split(/\s{2,}|\s*\|\s*/)).map(c => c.trim()).filter(Boolean));
}

// ---------------------------------------------------------------- column identification
type Col = "name" | "letters" | "seats" | "percent" | "votes";

/** Try to read a header row: returns column index per role when at least name+votes are found. */
function detectHeader(cells: string[]): Partial<Record<Col, number>> | null {
  const map: Partial<Record<Col, number>> = {};
  cells.forEach((cell, i) => {
    const t = cell.trim();
    if (!t || toInt(t) !== null) return;
    if (/אחוז/.test(t) || /%/.test(t)) { if (map.percent === undefined) map.percent = i; return; }
    if (/מנדט/.test(t)) { if (map.seats === undefined) map.seats = i; return; }
    if (/קולות/.test(t)) { if (map.votes === undefined) map.votes = i; return; }
    if (/אות/.test(t)) { if (map.letters === undefined) map.letters = i; return; }
    if (/שם|רשימה/.test(t)) { if (map.name === undefined) map.name = i; return; }
  });
  return map.votes !== undefined && map.name !== undefined ? map : null;
}

function rowByHeader(cells: string[], map: Partial<Record<Col, number>>): ParsedRow | null {
  const get = (c: Col) => (map[c] !== undefined ? cells[map[c]!] ?? "" : "");
  const votes = toInt(get("votes"));
  if (votes === null) return null;
  const name = get("name").trim();
  const letters = get("letters").trim();
  if (!name && !letters) return null;
  return {
    name, letters,
    votes,
    percent: map.percent !== undefined ? toPercent(get("percent")) ?? (get("percent").trim() ? parseFloat(get("percent")) || null : null) : null,
    seats: map.seats !== undefined ? toInt(get("seats")) : null,
  };
}

/** No header: percent = the cell with %, votes = the LARGEST integer, mandates = another integer ≤ 120 (if any). */
function rowHeuristic(cells: string[]): ParsedRow | null {
  if (cells.length < 2) return null;
  let letters = "";
  let percent: number | null = null;
  const ints: number[] = [];
  const nameParts: string[] = [];
  for (const cell of cells) {
    const p = toPercent(cell);
    if (p !== null && percent === null) { percent = p; continue; }
    const n = toInt(cell);
    if (n !== null) { ints.push(n); continue; }
    if (!letters && hebrewLetters.test(cell) && cells.length >= 3) { letters = cell; continue; }
    if (/[א-ת]/.test(cell)) nameParts.push(cell);
  }
  if (!ints.length) return null;
  const votes = Math.max(...ints);
  const others = ints.filter((_, i) => i !== ints.indexOf(votes));
  const seats = others.find(v => v <= 120) ?? null;
  const name = nameParts.join(" ").trim();
  if (!name && !letters) return null;
  return { letters, name, votes, percent, seats };
}

function findCounted(text: string): number | null {
  const m = text.match(/(?:נספר|ספיר|קלפיות|counted)[^%\d]{0,60}?(\d{1,3}(?:[.,]\d+)?)\s*%/i) ?? text.match(/(\d{1,3}(?:[.,]\d+)?)\s*%[^.\n]{0,40}(?:נספר|קלפיות)/i);
  return m ? parseFloat(m[1].replace(",", ".")) : null;
}
function findTotalValid(text: string): number | null {
  // e.g. 'סה"כ הקולות הכשרים שהוזנו - סופי 4,764,742'
  const m = text.match(/קולות\s+(?:ה)?כשרים[^\d]{0,60}?(\d{1,3}(?:[,\s ]\d{3})+|\d{4,})/);
  return m ? toInt(m[1]) : null;
}

function parseRows(rows: string[][]): { parsed: ParsedRow[]; method: "header" | "heuristic" } {
  let map: Partial<Record<Col, number>> | null = null;
  const parsed: ParsedRow[] = [];
  for (const cells of rows) {
    if (!map) {
      const h = detectHeader(cells);
      if (h) { map = h; continue; }
    }
    if (map) {
      const r = rowByHeader(cells, map);
      if (r) parsed.push(r);
    }
  }
  if (map) return { parsed, method: "header" };
  return { parsed: rows.map(rowHeuristic).filter((r): r is ParsedRow => !!r), method: "heuristic" };
}

export function parseCecHtml(html: string): ParsedResults {
  const { parsed, method } = parseRows(htmlToRows(html));
  return finish(parsed, stripTags(html), method);
}

export function parseCecText(text: string): ParsedResults {
  const { parsed, method } = parseRows(textToRows(text));
  return finish(parsed, text, method);
}

function finish(rowsIn: ParsedRow[], text: string, method: "header" | "heuristic"): ParsedResults {
  const warnings: string[] = [];
  const errors: string[] = [];
  const rows = rowsIn.filter(r => !/סה[״"']?כ|סך|total/i.test(r.name));
  const countedPercent = findCounted(text);
  const totalValidVotes = findTotalValid(text);

  if (!rows.length) {
    errors.push("לא זוהו שורות תוצאות. ודאו שהעתקתם את טבלת התוצאות הארצית (שם הרשימה, אותיות, אחוז, מספר הקולות).");
    return { rows, countedPercent, totalValidVotes, method, warnings, errors };
  }
  if (method === "heuristic") warnings.push("כותרות הטבלה לא זוהו — העמודות זוהו לפי ניחוש (המספר הגדול ביותר בשורה = קולות). בדקו את המספרים מול האתר לפני האישור.");

  // duplicates
  const seen = new Map<string, number>();
  for (const r of rows) { const k = r.letters || normalizeName(r.name); seen.set(k, (seen.get(k) ?? 0) + 1); }
  for (const [k, n] of seen) if (n > 1) warnings.push(`הרשימה "${k}" מופיעה ${n} פעמים`);

  // ---- cross-checks: the numbers must agree with each other
  const sum = rows.reduce((s, r) => s + r.votes, 0);
  const withPct = rows.filter(r => r.percent !== null);
  // 1. a list with a meaningful percent but tiny "votes" means we read the wrong column (e.g. mandates)
  for (const r of rows) {
    if (r.percent !== null && r.percent >= 0.5 && r.votes <= 200) errors.push(`"${r.name}": ${r.votes} קולות אבל ${r.percent}% — כנראה נקראה עמודה שגויה (מנדטים במקום קולות)`);
  }
  // 2. percent must equal votes / total (use published total, else the sum of the rows)
  // without a published total, the row sum can serve as the base only when the table is complete (percents ≈ 100)
  const pctSum = withPct.reduce((s, r) => s + r.percent!, 0);
  const base = totalValidVotes ?? (withPct.length >= 3 && pctSum >= 99 ? sum : null);
  if (base === null && withPct.length) warnings.push("סך הקולות הכשרים לא זוהה בטקסט — האחוזים לא אומתו מול מספרי הקולות");
  if (base && base > 0) {
    let bad = 0;
    for (const r of withPct) {
      const expected = (r.votes / base) * 100;
      if (Math.abs(expected - r.percent!) > 0.06) bad++;
    }
    if (bad > 0 && bad >= Math.ceil(withPct.length / 3)) errors.push(`האחוזים אינם תואמים למספרי הקולות ב-${bad} שורות — ייתכן שנקראה עמודה שגויה או שסך הקולות הכשרים שגוי`);
    else if (bad > 0) warnings.push(`האחוז אינו תואם למספר הקולות ב-${bad} שורות (סטייה של יותר מ-0.06%)`);
  }
  // 3. sum of rows may not exceed the published total
  if (totalValidVotes !== null && sum > totalValidVotes * 1.001) errors.push(`סכום הקולות בשורות (${sum.toLocaleString("he-IL")}) גדול מסך הקולות הכשרים שפורסם (${totalValidVotes.toLocaleString("he-IL")})`);
  // 4. mandates column sanity
  const seats = rows.filter(r => r.seats !== null);
  if (seats.length) {
    const seatSum = seats.reduce((s, r) => s + (r.seats ?? 0), 0);
    if (seatSum !== 120 && seatSum !== 0) warnings.push(`עמודת המנדטים באתר מסתכמת ל-${seatSum} ולא ל-120`);
    if (rows.some(r => (r.seats ?? 0) > 120)) errors.push("עמודת המנדטים מכילה ערכים גדולים מ-120 — זיהוי העמודות שגוי");
  }
  return { rows, countedPercent, totalValidVotes, method, warnings, errors };
}

/** Match parsed rows to configured parties by letters, then by normalized name. */
export function matchRows(rows: ParsedRow[], parties: { id: string; name: string; letters: string }[]) {
  const clean = (s: string) => s.replace(/["'״׳\s]/g, "");
  const byLetters = new Map(parties.filter(p => p.letters).map(p => [clean(p.letters), p.id]));
  const byName = new Map(parties.map(p => [normalizeName(p.name), p.id]));
  return rows.map(r => {
    const l = clean(r.letters);
    let partyId: string | null = (l && byLetters.get(l)) || null;
    if (!partyId) partyId = byName.get(normalizeName(r.name)) ?? null;
    if (!partyId) {
      const n = normalizeName(r.name);
      for (const [pn, id] of byName) if (n && pn && (n.includes(pn) || pn.includes(n))) { partyId = id; break; }
    }
    return { ...r, partyId };
  });
}
