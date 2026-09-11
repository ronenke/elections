import type { Agreement, Bloc, ElectionState, Party } from "./types";
import { normalizeName } from "./cec/parse";

/**
 * Lists/blocs/agreements from pasted text. One list per line:
 *   שם המפלגה | אות | גוש | מפלגה שותפה להסכם עודפים
 * Separators: "|" or tab (or 2+ spaces). Columns 3–4 optional. A header line with column names may be
 * present in any order and is used to map columns; without it the fixed order above is assumed.
 * The agreement partner may be given by name or letters; it is enough to state it on one of the two lines.
 */

export interface PastedList {
  name: string;
  letters: string;
  bloc: string;
  partner: string;
}

export interface PasteParse {
  rows: PastedList[];
  warnings: string[];
  errors: string[];
}

type Col = "name" | "letters" | "bloc" | "partner";

function splitLine(l: string): string[] {
  const cells = l.includes("|") ? l.split("|") : l.includes("\t") ? l.split("\t") : l.split(/\s{2,}/);
  return cells.map(c => c.trim());
}

function detectHeader(cells: string[]): Record<Col, number> | null {
  const m: Partial<Record<Col, number>> = {};
  cells.forEach((c, i) => {
    if (/שות|הסכם|עודפ/.test(c)) { if (m.partner === undefined) m.partner = i; return; }
    if (/גוש/.test(c)) { if (m.bloc === undefined) m.bloc = i; return; }
    if (/אות/.test(c)) { if (m.letters === undefined) m.letters = i; return; }
    if (/שם|מפלגה|רשימה/.test(c)) { if (m.name === undefined) m.name = i; return; }
  });
  // a header must name at least two columns — a list called "הרשימה המשותפת" on the first line is data, not a header
  const recognised = Object.keys(m).length;
  if (m.name === undefined || recognised < 2) return null;
  return { name: m.name, letters: m.letters ?? -1, bloc: m.bloc ?? -1, partner: m.partner ?? -1 };
}

export function parseSetupText(text: string): PasteParse {
  const warnings: string[] = [];
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let map: Record<Col, number> = { name: 0, letters: 1, bloc: 2, partner: 3 };
  const rows: PastedList[] = [];
  lines.forEach((line, idx) => {
    const cells = splitLine(line);
    if (idx === 0) { const h = detectHeader(cells); if (h) { map = h; return; } }
    const get = (c: Col) => (map[c] >= 0 ? cells[map[c]] ?? "" : "").trim();
    const name = get("name");
    if (!name) { warnings.push(`שורה ${idx + 1} ללא שם — דולגה`); return; }
    const letters = get("letters").replace(/["'״׳]/g, "");
    if (letters && !/^[א-ת]{1,4}$/.test(letters)) warnings.push(`"${name}": האותיות "${letters}" לא נראות כאותיות רשימה`);
    rows.push({ name, letters, bloc: get("bloc"), partner: get("partner") });
  });
  if (!rows.length) errors.push("לא זוהו רשימות. כל שורה: שם המפלגה | אות | גוש | שותפה להסכם עודפים");
  // duplicates
  const seen = new Map<string, number>();
  for (const r of rows) { const k = normalizeName(r.name); seen.set(k, (seen.get(k) ?? 0) + 1); }
  for (const [k, n] of seen) if (n > 1) errors.push(`הרשימה "${k}" מופיעה ${n} פעמים`);
  const lettersSeen = new Map<string, number>();
  for (const r of rows) if (r.letters) lettersSeen.set(r.letters, (lettersSeen.get(r.letters) ?? 0) + 1);
  for (const [k, n] of lettersSeen) if (n > 1) errors.push(`האותיות "${k}" מופיעות ב-${n} רשימות`);
  // partners must resolve, and be consistent
  const find = (ref: string) => rows.find(r => (r.letters && r.letters === ref.replace(/["'״׳]/g, "")) || normalizeName(r.name) === normalizeName(ref));
  for (const r of rows) {
    if (!r.partner) continue;
    const p = find(r.partner);
    if (!p) errors.push(`"${r.name}": השותפה להסכם "${r.partner}" לא נמצאה ברשימה`);
    else if (p === r) errors.push(`"${r.name}": הסכם עודפים עם עצמה`);
    else if (p.partner && find(p.partner) !== r) errors.push(`"${r.name}" מציינת הסכם עם "${p.name}", אבל "${p.name}" מציינת הסכם עם "${p.partner}"`);
  }
  // a list can be in one agreement only
  const partnerCount = new Map<string, Set<string>>();
  for (const r of rows) { if (!r.partner) continue; const p = find(r.partner); if (!p) continue; const key = normalizeName(p.name); const set = partnerCount.get(key) ?? new Set(); set.add(normalizeName(r.name)); partnerCount.set(key, set); }
  for (const [k, set] of partnerCount) if (set.size > 1) errors.push(`"${k}" מצוינת כשותפה של יותר מרשימה אחת: ${[...set].join(", ")}`);
  return { rows, warnings, errors };
}

const PALETTE = ["#3b82f6", "#d97706", "#0d9488", "#7c3aed", "#db2777", "#65a30d", "#0891b2", "#9f1239"];

/**
 * Apply pasted lists to an election.
 *  mode "replace": lists, blocs and agreements are rebuilt from the paste; all votes reset to 0.
 *  mode "merge":   existing lists are matched (letters, then name) and updated; new ones added; lists not in
 *                  the paste are kept; blocs are added as needed; agreements of pasted lists are replaced by
 *                  what the paste says (a pasted list with an empty partner column loses its agreement); votes kept.
 */
export function applySetupPaste(state: ElectionState, rows: PastedList[], mode: "replace" | "merge"): ElectionState {
  const blocs: Bloc[] = mode === "replace" ? [] : [...state.blocs];
  const blocByName = new Map(blocs.map(b => [normalizeName(b.name), b]));
  const ensureBloc = (name: string): string | null => {
    const n = normalizeName(name);
    if (!n) return null;
    let b = blocByName.get(n);
    if (!b) { b = { id: `b${Date.now().toString(36)}${blocs.length}`, name: name.trim(), color: PALETTE[blocs.length % PALETTE.length] }; blocs.push(b); blocByName.set(n, b); }
    return b.id;
  };
  const existing = mode === "replace" ? [] : [...state.parties];
  const clean = (s: string) => s.replace(/["'״׳\s]/g, "");
  const matchExisting = (r: PastedList) => existing.find(p => (r.letters && p.letters && clean(p.letters) === clean(r.letters)) || normalizeName(p.name) === normalizeName(r.name));

  const parties: Party[] = mode === "replace" ? [] : existing.map(p => ({ ...p }));
  const pastedIds: string[] = [];
  rows.forEach((r, i) => {
    const found = mode === "merge" ? matchExisting(r) : undefined;
    const blocId = r.bloc ? ensureBloc(r.bloc) : found?.blocId ?? null;
    if (found) {
      const idx = parties.findIndex(p => p.id === found.id);
      parties[idx] = { ...parties[idx], name: r.name, letters: r.letters || parties[idx].letters, blocId };
      pastedIds.push(found.id);
    } else {
      const id = `p${Date.now().toString(36)}${i}`;
      parties.push({ id, name: r.name, letters: r.letters, blocId, order: parties.length });
      pastedIds.push(id);
    }
  });
  // order: pasted order first (replace) / keep existing order and append (merge)
  const ordered = mode === "replace" ? parties.map((p, k) => ({ ...p, order: k })) : parties.map((p, k) => ({ ...p, order: k }));

  // agreements
  const idOf = (ref: string) => {
    const r = rows.find(x => (x.letters && x.letters === clean(ref)) || normalizeName(x.name) === normalizeName(ref));
    return r ? pastedIds[rows.indexOf(r)] : null;
  };
  const pairs = new Map<string, Agreement>();
  rows.forEach((r, i) => {
    if (!r.partner) return;
    const a = pastedIds[i], b = idOf(r.partner);
    if (!b || a === b) return;
    const key = [a, b].sort().join("+");
    pairs.set(key, { a, b });
  });
  const pastedSet = new Set(pastedIds);
  const kept = mode === "merge" ? state.agreements.filter(ag => !pastedSet.has(ag.a) && !pastedSet.has(ag.b)) : [];
  const agreements = [...kept, ...pairs.values()];

  const votes: Record<string, number> = {};
  for (const p of ordered) votes[p.id] = mode === "replace" ? 0 : state.votes[p.id] ?? 0;
  return { ...state, parties: ordered, blocs, agreements, votes, otherValidVotes: mode === "replace" ? 0 : state.otherValidVotes };
}
