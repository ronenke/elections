import { describe, it, expect } from "vitest";
import { compute, dangerLevels } from "./compute";
import { rehearsal2022 } from "./seed";
import { computeSeats } from "./engine/baderOfer";
import { toEngineInput } from "./compute";

describe("agreement indicator (+1 = received the pair's surplus seat)", () => {
  const c = compute(rehearsal2022());
  const row = (id: string) => c.rows.find(r => r.id === id)!;

  it("is null for lists without an agreement and a number for lists with one", () => {
    expect(row("yb").agreementEffect).toBeNull();
    expect(row("raam").agreementEffect).toBeNull();
    for (const id of ["likud", "rz", "nu", "ya", "shas", "utj", "labor", "meretz"]) expect(typeof row(id).agreementEffect).toBe("number");
    expect(row("shas").agreementPartner).toBe("יהדות התורה");
    expect(row("yb").agreementPartner).toBeNull();
  });

  it("2022: Shas, Likud and Yesh Atid received their pairs' surplus seats (Galei Tzahal convention)", () => {
    expect(row("shas").agreementEffect).toBe(1); expect(row("utj").agreementEffect).toBe(0);
    expect(row("likud").agreementEffect).toBe(1); expect(row("rz").agreementEffect).toBe(0);
    expect(row("ya").agreementEffect).toBe(1); expect(row("nu").agreementEffect).toBe(0);
    // Labor–Meretz: Meretz failed the threshold, so the agreement is inactive → both 0
    expect(row("labor").agreementEffect).toBe(0);
    expect(row("meretz").agreementEffect).toBe(0);
  });

  it("matches the engine's pair-split trace exactly", () => {
    for (const ps of c.result.pairSplits) for (const m of ps.members) expect(row(m.id).agreementEffect).toBe(m.finalSeats - m.floorSeats);
  });

  it("counterfactual = seats-with minus seats-without for every pair (2022: Shas 0, Likud +1, Yesh Atid +1)", () => {
    const input = toEngineInput(rehearsal2022());
    const base = computeSeats(input);
    for (const [a, b] of input.agreements) {
      const without = computeSeats({ ...input, agreements: input.agreements.filter(x => x[0] !== a) });
      const seats = (r: typeof base, id: string) => r.lists.find(l => l.id === id)!.seats;
      expect(row(a).agreementCounterfactual).toBe(seats(base, a) - seats(without, a));
      expect(row(b).agreementCounterfactual).toBe(seats(base, b) - seats(without, b));
    }
    expect(row("shas").agreementCounterfactual).toBe(0);
    expect(row("likud").agreementCounterfactual).toBe(1);
    expect(row("ya").agreementCounterfactual).toBe(1);
  });
});

describe("danger levels", () => {
  it("splits 10 lists into 5 levels of 2, safest first", () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, seats: 5, toLose: (10 - i) * 1000 }));
    const lv = dangerLevels(rows);
    expect([...lv.values()]).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
    expect(lv.get("p0")).toBe(1); // largest margin → green
    expect(lv.get("p9")).toBe(5); // smallest margin → red
  });
  it("handles fewer than 5 lists and skips lists without seats", () => {
    const lv = dangerLevels([{ id: "a", seats: 3, toLose: 500 }, { id: "b", seats: 2, toLose: 50 }, { id: "c", seats: 0, toLose: null }]);
    expect(lv.get("a")).toBe(1);
    expect(lv.get("b")).toBe(3);
    expect(lv.has("c")).toBe(false);
  });
  it("2022: the list closest to losing a seat is level 5 and the safest is level 1", () => {
    const c = compute(rehearsal2022());
    const withSeats = c.rows.filter(r => r.seats > 0);
    const safest = [...withSeats].sort((a, b) => b.toLose! - a.toLose!)[0];
    const riskiest = [...withSeats].sort((a, b) => a.toLose! - b.toLose!)[0];
    expect(safest.dangerLevel).toBe(1);
    expect(riskiest.dangerLevel).toBe(5);
    expect(c.closestLoss!.id).toBe(riskiest.id);
    for (const r of c.rows.filter(r => r.seats === 0)) expect(r.dangerLevel).toBeNull();
  });
});
