import { computeSeats, seatSensitivity, type EngineInput, type EngineResult } from "./engine/baderOfer";
import type { ElectionState } from "./types";

export interface PartyRow {
  id: string;
  name: string;
  letters: string;
  blocId: string | null;
  votes: number;
  percent: number;
  passed: boolean;
  /** votes above (+) or below (−) the threshold */
  thresholdMargin: number;
  seats: number;
  firstStageSeats: number;
  unitId: string | null;
  /** extra votes needed for one more seat (all other lists unchanged); null if unknown / out of range */
  toGain: number | null;
  /** votes this list could lose before losing a seat; null if it has no seats or out of range */
  toLose: number | null;
  /**
   * Effect of the list's surplus agreement: seats with the agreement minus seats without it
   * (other agreements unchanged). null = no agreement configured for this list.
   * 0 = has an agreement but it changed nothing (including when the partner failed the threshold).
   */
  agreementEffect: number | null;
  /**
   * How safe the list's last seat is, relative to the other lists with seats: 1 (safest, green) … 5 (most at risk, red).
   * Ranked by `toLose`; the lists are split into five equal groups by rank. null when the list has no seats.
   */
  dangerLevel: 1 | 2 | 3 | 4 | 5 | null;
}

export interface Computed {
  result: EngineResult;
  rows: PartyRow[];
  blocs: { id: string; name: string; color: string; seats: number; votes: number; partyIds: string[] }[];
  unassignedSeats: number;
  /** the party that needs the fewest extra votes for another seat, and the one closest to losing one */
  closestGain: PartyRow | null;
  closestLoss: PartyRow | null;
}

export function toEngineInput(state: ElectionState): EngineInput {
  return {
    lists: [...state.parties].sort((a, b) => a.order - b.order).map(p => ({ id: p.id, name: p.name, letters: p.letters, votes: state.votes[p.id] ?? 0 })),
    agreements: state.agreements.map(a => [a.a, a.b] as [string, string]),
    otherValidVotes: state.otherValidVotes ?? 0,
  };
}

/** seats with each agreement minus seats without that agreement, for both partners. */
export function agreementEffects(input: EngineInput, base: EngineResult): Map<string, number> {
  const out = new Map<string, number>();
  if (!base.ok) return out;
  const seatsOf = (r: EngineResult, id: string) => r.lists.find(l => l.id === id)?.seats ?? 0;
  for (const [a, b] of input.agreements) {
    const without = computeSeats({ ...input, agreements: input.agreements.filter(x => !(x[0] === a && x[1] === b)) });
    if (!without.ok) continue;
    out.set(a, seatsOf(base, a) - seatsOf(without, a));
    out.set(b, seatsOf(base, b) - seatsOf(without, b));
  }
  return out;
}

/**
 * Split lists that hold seats into five groups by how many votes they could lose before losing a seat.
 * Highest margin → level 1 (green), lowest → level 5 (red). With n lists, each level gets ~n/5 lists
 * (e.g. 10 lists → 2 per level), computed by rank so the scale is always relative to the field.
 */
export function dangerLevels(rows: { id: string; seats: number; toLose: number | null }[]): Map<string, 1 | 2 | 3 | 4 | 5> {
  const eligible = rows.filter(r => r.seats > 0 && r.toLose !== null).sort((a, b) => b.toLose! - a.toLose! || a.id.localeCompare(b.id));
  const out = new Map<string, 1 | 2 | 3 | 4 | 5>();
  const n = eligible.length;
  eligible.forEach((r, i) => {
    const level = Math.min(5, Math.floor((i * 5) / n) + 1) as 1 | 2 | 3 | 4 | 5;
    out.set(r.id, level);
  });
  return out;
}

export function compute(state: ElectionState, withSensitivity = true): Computed {
  const input = toEngineInput(state);
  const result = computeSeats(input);
  const effects = withSensitivity ? agreementEffects(input, result) : new Map<string, number>();
  const inAgreement = new Set(state.agreements.flatMap(a => [a.a, a.b]));
  const base: Omit<PartyRow, "dangerLevel">[] = result.lists.map(l => {
    const p = state.parties.find(x => x.id === l.id)!;
    const sens = withSensitivity && result.ok && l.votes > 0 ? seatSensitivity(input, l.id) : { toGain: null, toLose: null };
    return {
      id: l.id, name: l.name, letters: p.letters, blocId: p.blocId, votes: l.votes, percent: l.percent,
      passed: l.passedThreshold, thresholdMargin: l.votes - result.thresholdVotes,
      seats: l.seats, firstStageSeats: l.firstStageSeats, unitId: l.unitId, toGain: sens.toGain, toLose: sens.toLose,
      agreementEffect: inAgreement.has(l.id) ? (effects.get(l.id) ?? 0) : null,
    };
  });
  const danger = withSensitivity ? dangerLevels(base) : new Map();
  const rows: PartyRow[] = base.map(r => ({ ...r, dangerLevel: danger.get(r.id) ?? null }));
  const blocs = state.blocs.map(b => {
    const members = rows.filter(r => r.blocId === b.id);
    return { ...b, seats: members.reduce((s, r) => s + r.seats, 0), votes: members.reduce((s, r) => s + r.votes, 0), partyIds: members.map(m => m.id) };
  });
  const unassignedSeats = rows.filter(r => !r.blocId).reduce((s, r) => s + r.seats, 0);
  const withGain = rows.filter(r => r.toGain !== null).sort((a, b) => a.toGain! - b.toGain!);
  const withLoss = rows.filter(r => r.toLose !== null && r.seats > 0).sort((a, b) => a.toLose! - b.toLose!);
  return { result, rows, blocs, unassignedSeats, closestGain: withGain[0] ?? null, closestLoss: withLoss[0] ?? null };
}
