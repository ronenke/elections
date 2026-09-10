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
  toGain: number | null;
  toLose: number | null;
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

export function compute(state: ElectionState, withSensitivity = true): Computed {
  const input = toEngineInput(state);
  const result = computeSeats(input);
  const rows: PartyRow[] = result.lists.map(l => {
    const p = state.parties.find(x => x.id === l.id)!;
    const sens = withSensitivity && result.ok && l.votes > 0 ? seatSensitivity(input, l.id) : { toGain: null, toLose: null };
    return {
      id: l.id, name: l.name, letters: p.letters, blocId: p.blocId, votes: l.votes, percent: l.percent,
      passed: l.passedThreshold, thresholdMargin: l.votes - result.thresholdVotes,
      seats: l.seats, firstStageSeats: l.firstStageSeats, unitId: l.unitId, toGain: sens.toGain, toLose: sens.toLose,
    };
  });
  const blocs = state.blocs.map(b => {
    const members = rows.filter(r => r.blocId === b.id);
    return { ...b, seats: members.reduce((s, r) => s + r.seats, 0), votes: members.reduce((s, r) => s + r.votes, 0), partyIds: members.map(m => m.id) };
  });
  const unassignedSeats = rows.filter(r => !r.blocId).reduce((s, r) => s + r.seats, 0);
  const withGain = rows.filter(r => r.toGain !== null).sort((a, b) => a.toGain! - b.toGain!);
  const withLoss = rows.filter(r => r.toLose !== null && r.seats > 0).sort((a, b) => a.toLose! - b.toLose!);
  return { result, rows, blocs, unassignedSeats, closestGain: withGain[0] ?? null, closestLoss: withLoss[0] ?? null };
}
