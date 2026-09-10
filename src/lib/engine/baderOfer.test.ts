import { describe, it, expect } from "vitest";
import { computeSeats, thresholdVotes, seatSensitivity, type EngineInput } from "./baderOfer";

// ---------- official results ----------
const k24: EngineInput = {
  // 24th Knesset (March 2021). All lists, including those below the threshold.
  lists: [
    { id: "likud", name: "הליכוד", votes: 1066892 },
    { id: "rz", name: "הציונות הדתית", votes: 225641 },
    { id: "ya", name: "יש עתיד", votes: 614112 },
    { id: "yb", name: "ישראל ביתנו", votes: 248370 },
    { id: "shas", name: "ש\"ס", votes: 316008 },
    { id: "utj", name: "יהדות התורה", votes: 248391 },
    { id: "bw", name: "כחול לבן", votes: 292257 },
    { id: "yamina", name: "ימינה", votes: 273836 },
    { id: "nh", name: "תקווה חדשה", votes: 209161 },
    { id: "labor", name: "העבודה", votes: 268767 },
    { id: "meretz", name: "מרצ", votes: 202218 },
    { id: "joint", name: "הרשימה המשותפת", votes: 212583 },
    { id: "raam", name: "רע\"ם", votes: 167064 },
    { id: "econ", name: "הכלכלית", votes: 34883 },
  ],
  agreements: [["likud", "rz"], ["ya", "yb"], ["shas", "utj"], ["yamina", "nh"], ["labor", "meretz"]],
  otherValidVotes: 4410052 - (1066892 + 225641 + 614112 + 248370 + 316008 + 248391 + 292257 + 273836 + 209161 + 268767 + 202218 + 212583 + 167064 + 34883),
};
const k24Expected: Record<string, number> = { likud: 30, ya: 17, shas: 9, bw: 8, yamina: 7, labor: 7, utj: 7, yb: 7, rz: 6, joint: 6, nh: 6, meretz: 6, raam: 4, econ: 0 };

const k25: EngineInput = {
  // 25th Knesset (November 2022)
  lists: [
    { id: "likud", name: "הליכוד", votes: 1115336 },
    { id: "ya", name: "יש עתיד", votes: 847435 },
    { id: "rz", name: "הציונות הדתית", votes: 516470 },
    { id: "nu", name: "המחנה הממלכתי", votes: 432482 },
    { id: "shas", name: "ש\"ס", votes: 392964 },
    { id: "utj", name: "יהדות התורה", votes: 280194 },
    { id: "yb", name: "ישראל ביתנו", votes: 213687 },
    { id: "raam", name: "רע\"ם", votes: 194047 },
    { id: "hadash", name: "חד\"ש-תע\"ל", votes: 178735 },
    { id: "labor", name: "העבודה", votes: 175992 },
    { id: "meretz", name: "מרצ", votes: 150793 },
    { id: "balad", name: "בל\"ד", votes: 138617 },
    { id: "jh", name: "הבית היהודי", votes: 56775 },
  ],
  agreements: [["labor", "meretz"], ["likud", "rz"], ["nu", "ya"], ["shas", "utj"]],
  otherValidVotes: 4764742 - (1115336 + 847435 + 516470 + 432482 + 392964 + 280194 + 213687 + 194047 + 178735 + 175992 + 150793 + 138617 + 56775),
};
const k25Expected: Record<string, number> = { likud: 32, ya: 24, rz: 14, nu: 12, shas: 11, utj: 7, yb: 6, raam: 5, hadash: 5, labor: 4, meretz: 0, balad: 0, jh: 0 };

function seatsMap(r: ReturnType<typeof computeSeats>) {
  return Object.fromEntries(r.lists.map(l => [l.id, l.seats]));
}

describe("official results", () => {
  it("reproduces the 24th Knesset (2021)", () => {
    const r = computeSeats(k24);
    expect(r.ok).toBe(true);
    expect(seatsMap(r)).toEqual(k24Expected);
    expect(r.totalSeats).toBe(120);
    expect(r.firstStageTotal).toBe(112);
  });
  it("reproduces the 25th Knesset (2022)", () => {
    const r = computeSeats(k25);
    expect(r.ok).toBe(true);
    expect(seatsMap(r)).toEqual(k25Expected);
    expect(r.lists.find(l => l.id === "meretz")!.passedThreshold).toBe(false);
    expect(r.warnings.some(w => w.includes("מרצ") && w.includes("אחוז החסימה"))).toBe(true);
  });
});

describe("threshold", () => {
  it("uses >= 3.25% (לפחות)", () => {
    expect(thresholdVotes(4410052)).toBe(143327); // 143326.69 -> 143327
    expect(thresholdVotes(10000)).toBe(325);
    const r = computeSeats({ lists: [{ id: "a", name: "a", votes: 9675 }, { id: "b", name: "b", votes: 325 }], agreements: [] });
    expect(r.lists.find(l => l.id === "b")!.passedThreshold).toBe(true);
    const r2 = computeSeats({ lists: [{ id: "a", name: "a", votes: 9676 }, { id: "b", name: "b", votes: 324 }], agreements: [] });
    expect(r2.lists.find(l => l.id === "b")!.passedThreshold).toBe(false);
  });
});

describe("floating point immunity", () => {
  it("does not lose a seat where E/(E/n) rounds down (the legacy Excel bug)", () => {
    // 150004 / (150004/7) = 6.999999999999999 in doubles
    const r = computeSeats({
      lists: [
        { id: "a", name: "a", votes: 150004 },
        { id: "b", name: "b", votes: 150004 * 16 },
        { id: "c", name: "c", votes: 5 },
      ],
      agreements: [],
    });
    expect(r.ok).toBe(true);
    expect(r.totalSeats).toBe(120);
    expect(r.lists.find(l => l.id === "c")!.seats).toBe(0);
  });
});

describe("ties", () => {
  it("awards a tied remainder seat to the unit with more votes, and flags exact ties", () => {
    // two lists, identical quotients at some round: 3 seats, votes 200/100 -> quotients 200/2=100 vs 100/1=100
    const r = computeSeats({ lists: [{ id: "a", name: "a", votes: 200 }, { id: "b", name: "b", votes: 100 }], agreements: [], seats: 3 });
    expect(r.ok).toBe(true);
    expect(seatsMap(r)).toEqual({ a: 2, b: 1 });
    const r2 = computeSeats({ lists: [{ id: "a", name: "a", votes: 100 }, { id: "b", name: "b", votes: 100 }], agreements: [], seats: 3 });
    expect(r2.totalSeats).toBe(3);
    expect(r2.warnings.some(w => w.includes("הגרלה"))).toBe(true);
  });
});

describe("agreements", () => {
  it("rejects a list in two agreements", () => {
    const r = computeSeats({ ...k25, agreements: [["likud", "rz"], ["likud", "shas"]] });
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });
  it("pair order does not matter", () => {
    const r = computeSeats({ ...k25, agreements: k25.agreements.map(([a, b]) => [b, a] as [string, string]) });
    expect(seatsMap(r)).toEqual(k25Expected);
  });
  it("list order does not matter", () => {
    const r = computeSeats({ ...k25, lists: [...k25.lists].reverse() });
    expect(seatsMap(r)).toEqual(k25Expected);
  });
});

// ---------- fuzz against an exact rational oracle (independent, simpler implementation) ----------
function oracle(input: EngineInput): Record<string, number> {
  const total = input.lists.reduce((s, l) => s + l.votes, 0) + (input.otherValidVotes ?? 0);
  const passed = input.lists.filter(l => BigInt(l.votes) * 10000n >= 325n * BigInt(total) && l.votes > 0);
  const Q = passed.reduce((s, l) => s + l.votes, 0);
  const partner = new Map<string, string>();
  for (const [a, b] of input.agreements) if (passed.some(l => l.id === a) && passed.some(l => l.id === b)) { partner.set(a, b); partner.set(b, a); }
  type U = { ids: string[]; votes: number; seats: number };
  const units: U[] = []; const seen = new Set<string>();
  for (const l of passed) {
    if (seen.has(l.id)) continue;
    const ids = partner.has(l.id) ? [l.id, partner.get(l.id)!] : [l.id];
    ids.forEach(i => seen.add(i));
    units.push({ ids, votes: ids.reduce((s, i) => s + passed.find(x => x.id === i)!.votes, 0), seats: 0 });
  }
  const dhondt = (us: U[], n: number, first: (u: U) => number) => {
    us.forEach(u => (u.seats = first(u)));
    while (us.reduce((s, u) => s + u.seats, 0) < n) {
      let best = us[0];
      for (const u of us.slice(1)) {
        const l = BigInt(u.votes) * BigInt(best.seats + 1), r = BigInt(best.votes) * BigInt(u.seats + 1);
        if (l > r || (l === r && u.votes > best.votes)) best = u;
      }
      best.seats++;
    }
  };
  dhondt(units, 120, u => Number((BigInt(u.votes) * 120n) / BigInt(Q)));
  const out: Record<string, number> = {};
  for (const l of input.lists) out[l.id] = 0;
  for (const u of units) {
    if (u.ids.length === 1) { out[u.ids[0]] = u.seats; continue; }
    const members: U[] = u.ids.map(i => ({ ids: [i], votes: passed.find(x => x.id === i)!.votes, seats: 0 }));
    dhondt(members, u.seats, m => Number((BigInt(m.votes) * BigInt(u.seats)) / BigInt(u.votes)));
    members.forEach(m => (out[m.ids[0]] = m.seats));
  }
  return out;
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

describe("fuzz vs exact oracle", () => {
  it("matches on 3000 random elections", () => {
    const rand = rng(42);
    for (let t = 0; t < 3000; t++) {
      const k = 8 + Math.floor(rand() * 8);
      const lists = Array.from({ length: k }, (_, i) => ({ id: `p${i}`, name: `p${i}`, votes: 100000 + Math.floor(rand() * 1100000) }));
      for (let i = 0; i < 10; i++) lists.push({ id: `s${i}`, name: `s${i}`, votes: Math.floor(rand() * 60000) });
      const agreements: [string, string][] = [];
      for (let i = 0; i + 1 < k; i++) if (rand() < 0.5) { agreements.push([`p${i}`, `p${i + 1}`]); i++; }
      const input: EngineInput = { lists, agreements };
      const r = computeSeats(input);
      expect(r.ok, `case ${t}: ${r.errors.join("; ")}`).toBe(true);
      expect(seatsMap(r), `case ${t}`).toEqual(oracle(input));
    }
  });
});

describe("sensitivity", () => {
  it("finds votes needed to gain / lose a seat", () => {
    const s = seatSensitivity(k25, "labor");
    expect(s.toGain).toBeGreaterThan(0);
    expect(s.toLose).toBeGreaterThan(0);
    const lists = k25.lists.map(l => (l.id === "labor" ? { ...l, votes: l.votes + s.toGain! } : l));
    expect(computeSeats({ ...k25, lists }).lists.find(l => l.id === "labor")!.seats).toBe(5);
  });
});
