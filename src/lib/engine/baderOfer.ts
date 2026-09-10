/**
 * Bader-Ofer seat allocation for the Knesset (חוק הבחירות לכנסת, סעיפים 81–82).
 *
 * All arithmetic is exact: integer comparisons are done by cross-multiplication with BigInt,
 * so no floating point ever touches a seat decision. (The legacy Excel lost seats to
 * E/(E/n) = n-ε rounding; this module cannot.)
 *
 * Rules implemented:
 *  1. Threshold: a list qualifies if votes >= 3.25% of all valid votes ("לפחות").
 *  2. Measure (מודד): Q = sum of qualifying votes; first stage seats_i = floor(votes_i * 120 / Q).
 *  3. Surplus agreements (הסכמי עודפים): two qualifying lists with an agreement compete as one
 *     unit for the remaining seats. If one partner fails the threshold the other stands alone.
 *  4. Remaining seats: repeatedly award one seat to the unit with the highest votes/(seats+1).
 *     Tie -> the unit with more votes; if equal votes too, the law prescribes a lottery: we
 *     award to the earlier unit and flag `tieBreakByLot` so a human can check.
 *  5. A pair's seats are split by the same method inside the pair: each partner gets
 *     floor(v_i * S / V); the leftover seat (0 or 1) goes to the partner with the higher
 *     v_i/(s_i+1); tie -> more votes; equal -> earlier, flagged.
 */

export const KNESSET_SEATS = 120;
/** threshold as a rational: 3.25% = 325 / 10000 */
export const THRESHOLD_NUM = 325n;
export const THRESHOLD_DEN = 10000n;

export interface ListInput {
  id: string;
  name: string;
  letters?: string;
  votes: number; // non-negative integer
}

export interface EngineInput {
  lists: ListInput[];
  /** pairs of list ids with a surplus-vote agreement. A list may appear in at most one pair. */
  agreements: [string, string][];
  /** valid votes cast for lists that are NOT in `lists` (optional; they still count for the threshold base) */
  otherValidVotes?: number;
  seats?: number;
}

export interface RoundTrace {
  round: number;
  quotients: { unitId: string; label: string; seatsBefore: number; quotient: number }[];
  winnerUnitId: string;
  tie: boolean;
  tieBreakByLot: boolean;
}

export interface PairSplitTrace {
  unitId: string;
  members: { id: string; votes: number; floorSeats: number; finalSeats: number; quotient: number }[];
  pairVotes: number;
  pairSeats: number;
  leftover: number;
  tie: boolean;
  tieBreakByLot: boolean;
}

export interface ListResult {
  id: string;
  name: string;
  letters?: string;
  votes: number;
  percent: number; // of all valid votes
  passedThreshold: boolean;
  firstStageSeats: number;
  unitId: string | null;
  seats: number;
}

export interface EngineResult {
  ok: boolean; // sum of seats equals target and no invalid input
  errors: string[];
  warnings: string[];
  totalValidVotes: number;
  thresholdVotes: number; // minimal votes that pass (ceil of 3.25%)
  qualifyingVotes: number;
  measure: number; // Q / seats (float, for display only)
  firstStageTotal: number;
  lists: ListResult[];
  units: { id: string; label: string; memberIds: string[]; votes: number; firstStageSeats: number; seats: number }[];
  rounds: RoundTrace[];
  pairSplits: PairSplitTrace[];
  totalSeats: number;
}

function big(n: number): bigint {
  return BigInt(Math.trunc(n));
}

/** compare a/b vs c/d exactly (b,d > 0). returns sign of (a/b - c/d) */
function cmpFrac(a: bigint, b: bigint, c: bigint, d: bigint): number {
  const l = a * d;
  const r = c * b;
  return l > r ? 1 : l < r ? -1 : 0;
}

export function thresholdVotes(totalValidVotes: number): number {
  // smallest integer v with v*10000 >= 325*total  ->  ceil(325*total/10000)
  const t = big(totalValidVotes) * THRESHOLD_NUM;
  return Number((t + THRESHOLD_DEN - 1n) / THRESHOLD_DEN);
}

export function computeSeats(input: EngineInput): EngineResult {
  const seatsTarget = input.seats ?? KNESSET_SEATS;
  const errors: string[] = [];
  const warnings: string[] = [];

  // ---- validate
  const ids = new Set<string>();
  for (const l of input.lists) {
    if (ids.has(l.id)) errors.push(`מזהה רשימה כפול: ${l.id}`);
    ids.add(l.id);
    if (!Number.isInteger(l.votes) || l.votes < 0) errors.push(`מספר קולות לא תקין עבור ${l.name}: ${l.votes}`);
  }
  const inPair = new Set<string>();
  for (const [a, b] of input.agreements) {
    if (a === b) errors.push(`הסכם עודפים של רשימה עם עצמה: ${a}`);
    if (!ids.has(a) || !ids.has(b)) errors.push(`הסכם עודפים מפנה לרשימה לא קיימת: ${a}/${b}`);
    if (inPair.has(a) || inPair.has(b)) errors.push(`רשימה מופיעה ביותר מהסכם עודפים אחד: ${a}/${b}`);
    inPair.add(a);
    inPair.add(b);
  }
  const other = input.otherValidVotes ?? 0;
  if (!Number.isInteger(other) || other < 0) errors.push(`ערך לא תקין ב"רשימות אחרות": ${other}`);

  const totalValidVotes = input.lists.reduce((s, l) => s + l.votes, 0) + other;
  const thr = thresholdVotes(totalValidVotes);

  const empty: EngineResult = {
    ok: false, errors, warnings, totalValidVotes, thresholdVotes: thr, qualifyingVotes: 0, measure: 0,
    firstStageTotal: 0, lists: [], units: [], rounds: [], pairSplits: [], totalSeats: 0,
  };
  if (errors.length) return empty;
  if (totalValidVotes === 0) {
    return { ...empty, lists: input.lists.map(l => ({ id: l.id, name: l.name, letters: l.letters, votes: 0, percent: 0, passedThreshold: false, firstStageSeats: 0, unitId: null, seats: 0 })) };
  }

  // ---- threshold
  const passed = new Map<string, boolean>();
  for (const l of input.lists) passed.set(l.id, l.votes >= thr && l.votes > 0);
  const qualifying = input.lists.filter(l => passed.get(l.id));
  const Q = qualifying.reduce((s, l) => s + l.votes, 0);
  if (Q === 0) {
    warnings.push("אף רשימה לא עברה את אחוז החסימה");
    return { ...empty, lists: input.lists.map(l => ({ id: l.id, name: l.name, letters: l.letters, votes: l.votes, percent: l.votes / totalValidVotes * 100, passedThreshold: false, firstStageSeats: 0, unitId: null, seats: 0 })) };
  }
  const bigQ = big(Q);
  const bigSeats = big(seatsTarget);

  // ---- first stage: floor(votes * seats / Q)
  const first = new Map<string, number>();
  for (const l of qualifying) first.set(l.id, Number((big(l.votes) * bigSeats) / bigQ));

  // ---- units
  const partner = new Map<string, string>();
  for (const [a, b] of input.agreements) {
    if (passed.get(a) && passed.get(b)) { partner.set(a, b); partner.set(b, a); }
    else if (passed.get(a) !== passed.get(b)) {
      const nameOf = (id: string) => input.lists.find(l => l.id === id)?.name ?? id;
      const [failed, alone] = passed.get(a) ? [b, a] : [a, b];
      warnings.push(`הסכם העודפים ${nameOf(a)}–${nameOf(b)}: ${nameOf(failed)} לא עברה את אחוז החסימה, ולכן ${nameOf(alone)} מחושבת לבדה`);
    }
  }
  type Unit = { id: string; label: string; memberIds: string[]; votes: number; firstStageSeats: number; seats: number };
  const units: Unit[] = [];
  const unitOf = new Map<string, string>();
  const seen = new Set<string>();
  for (const l of qualifying) {
    if (seen.has(l.id)) continue;
    const p = partner.get(l.id);
    const members = p ? [l, qualifying.find(x => x.id === p)!] : [l];
    members.forEach(m => seen.add(m.id));
    const u: Unit = {
      id: members.map(m => m.id).join("+"),
      label: members.map(m => m.name).join(" + "),
      memberIds: members.map(m => m.id),
      votes: members.reduce((s, m) => s + m.votes, 0),
      firstStageSeats: members.reduce((s, m) => s + first.get(m.id)!, 0),
      seats: 0,
    };
    u.seats = u.firstStageSeats;
    units.push(u);
    members.forEach(m => unitOf.set(m.id, u.id));
  }
  const firstStageTotal = units.reduce((s, u) => s + u.seats, 0);

  // ---- remaining seats, one at a time: max votes/(seats+1)
  const rounds: RoundTrace[] = [];
  let allocated = firstStageTotal;
  let round = 0;
  while (allocated < seatsTarget) {
    round++;
    let best: Unit | null = null;
    let tie = false;
    let byLot = false;
    const quotients = units.map(u => ({ unitId: u.id, label: u.label, seatsBefore: u.seats, quotient: u.votes / (u.seats + 1) }));
    for (const u of units) {
      if (!best) { best = u; continue; }
      const c = cmpFrac(big(u.votes), big(u.seats + 1), big(best.votes), big(best.seats + 1));
      if (c > 0) { best = u; tie = false; byLot = false; }
      else if (c === 0) {
        tie = true;
        if (u.votes > best.votes) { best = u; byLot = false; }
        else if (u.votes === best.votes) { byLot = true; }
      }
    }
    best!.seats++;
    allocated++;
    if (byLot) warnings.push(`סיבוב ${round}: שוויון מוחלט במודד ובקולות; המנדט ניתן ל"${best!.label}" — לפי החוק נדרשת הגרלה`);
    rounds.push({ round, quotients, winnerUnitId: best!.id, tie, tieBreakByLot: byLot });
    if (round > seatsTarget) { errors.push("החלוקה לא התכנסה"); break; }
  }

  // ---- split pairs
  const seatsOf = new Map<string, number>();
  const pairSplits: PairSplitTrace[] = [];
  for (const u of units) {
    if (u.memberIds.length === 1) { seatsOf.set(u.memberIds[0], u.seats); continue; }
    const V = big(u.votes);
    const S = big(u.seats);
    const members = u.memberIds.map(id => {
      const l = qualifying.find(x => x.id === id)!;
      const floorSeats = Number((big(l.votes) * S) / V);
      return { id, votes: l.votes, floorSeats, finalSeats: floorSeats, quotient: l.votes / (floorSeats + 1) };
    });
    let leftover = u.seats - members.reduce((s, m) => s + m.floorSeats, 0);
    let tie = false, byLot = false;
    while (leftover > 0) {
      let best = members[0];
      for (const m of members.slice(1)) {
        const c = cmpFrac(big(m.votes), big(m.finalSeats + 1), big(best.votes), big(best.finalSeats + 1));
        if (c > 0) { best = m; }
        else if (c === 0) { tie = true; if (m.votes > best.votes) best = m; else if (m.votes === best.votes) byLot = true; }
      }
      best.finalSeats++;
      leftover--;
    }
    if (byLot) warnings.push(`הזוג "${u.label}": שוויון מוחלט בחלוקת המנדט העודף — לפי החוק נדרשת הגרלה`);
    members.forEach(m => seatsOf.set(m.id, m.finalSeats));
    pairSplits.push({ unitId: u.id, members, pairVotes: u.votes, pairSeats: u.seats, leftover: u.seats - members.reduce((s, m) => s + m.floorSeats, 0), tie, tieBreakByLot: byLot });
  }

  const lists: ListResult[] = input.lists.map(l => ({
    id: l.id, name: l.name, letters: l.letters, votes: l.votes,
    percent: (l.votes / totalValidVotes) * 100,
    passedThreshold: !!passed.get(l.id),
    firstStageSeats: first.get(l.id) ?? 0,
    unitId: unitOf.get(l.id) ?? null,
    seats: seatsOf.get(l.id) ?? 0,
  }));
  const totalSeats = lists.reduce((s, l) => s + l.seats, 0);
  if (totalSeats !== seatsTarget) errors.push(`בדיקה עצמית נכשלה: חולקו ${totalSeats} מנדטים במקום ${seatsTarget}`);

  return {
    ok: errors.length === 0, errors, warnings, totalValidVotes, thresholdVotes: thr, qualifyingVotes: Q,
    measure: Q / seatsTarget, firstStageTotal, lists, units, rounds, pairSplits, totalSeats,
  };
}

/** Sensitivity: how many extra votes would give list `id` one more seat, and how many fewer would cost it one. */
export function seatSensitivity(input: EngineInput, id: string, maxDelta = 400_000): { toGain: number | null; toLose: number | null } {
  const base = computeSeats(input);
  const baseSeats = base.lists.find(l => l.id === id)?.seats ?? 0;
  const seatsWith = (delta: number) => {
    const lists = input.lists.map(l => (l.id === id ? { ...l, votes: Math.max(0, l.votes + delta) } : l));
    return computeSeats({ ...input, lists }).lists.find(l => l.id === id)?.seats ?? 0;
  };
  const search = (dir: 1 | -1): number | null => {
    const target = dir === 1 ? (s: number) => s > baseSeats : (s: number) => s < baseSeats;
    let lo = 0, hi = maxDelta;
    if (!target(seatsWith(dir * hi))) return null;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (target(seatsWith(dir * mid))) hi = mid; else lo = mid + 1;
    }
    return lo;
  };
  const current = input.lists.find(l => l.id === id);
  return { toGain: search(1), toLose: current && current.votes > 0 ? search(-1) : null };
}
