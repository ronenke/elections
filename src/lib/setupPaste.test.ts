import { describe, it, expect } from "vitest";
import { parseSetupText, applySetupPaste } from "./setupPaste";
import { rehearsal2022, blankState } from "./seed";

const text = `שם המפלגה | אות | גוש | שותפה להסכם עודפים
הליכוד | מחל | ימין | הציונות הדתית
הציונות הדתית | ט | ימין |
ש"ס | שס | ימין | ג
יהדות התורה | ג | ימין |
יש עתיד | פה | מרכז-שמאל | המחנה הממלכתי
המחנה הממלכתי | כן | מרכז-שמאל | יש עתיד
רע"ם | עם | | `;

describe("parseSetupText", () => {
  it("parses header + rows with | separator, partners by name or letters", () => {
    const r = parseSetupText(text);
    expect(r.errors).toEqual([]);
    expect(r.rows.length).toBe(7);
    expect(r.rows[0]).toEqual({ name: "הליכוד", letters: "מחל", bloc: "ימין", partner: "הציונות הדתית" });
    expect(r.rows[2].partner).toBe("ג");
    expect(r.rows[6]).toEqual({ name: 'רע"ם', letters: "עם", bloc: "", partner: "" });
  });
  it("works without a header and with tabs", () => {
    const r = parseSetupText("הליכוד\tמחל\tימין\nיש עתיד\tפה\tמרכז");
    expect(r.errors).toEqual([]);
    expect(r.rows.map(x => [x.name, x.letters, x.bloc])).toEqual([["הליכוד", "מחל", "ימין"], ["יש עתיד", "פה", "מרכז"]]);
  });
  it("does not mistake a first list whose name contains 'רשימה' for a header", () => {
    const r = parseSetupText("הרשימה המשותפת | ודם | ערבי |\nרע\"ם | עם | ערבי |");
    expect(r.rows.map(x => x.name)).toEqual(["הרשימה המשותפת", 'רע"ם']);
  });
  it("reports unknown partners, contradictions and duplicates", () => {
    const r = parseSetupText("א | אא | ג1 | ב\nב | בב | ג1 | ג\nג | גג | ג1 |\nא | אאא");
    expect(r.errors.some(e => e.includes("מציינת הסכם עם"))).toBe(true);
    expect(r.errors.some(e => e.includes("מופיעה 2 פעמים"))).toBe(true);
    expect(parseSetupText("א | אא | | לא קיימת").errors.some(e => e.includes("לא נמצאה"))).toBe(true);
  });
});

describe("applySetupPaste", () => {
  const rows = parseSetupText(text).rows;
  it("replace: rebuilds lists, blocs and agreements; votes reset", () => {
    const s = applySetupPaste(rehearsal2022(), rows, "replace");
    expect(s.parties.map(p => p.name)).toEqual(["הליכוד", "הציונות הדתית", 'ש"ס', "יהדות התורה", "יש עתיד", "המחנה הממלכתי", 'רע"ם']);
    expect(s.blocs.map(b => b.name)).toEqual(["ימין", "מרכז-שמאל"]);
    expect(s.agreements.length).toBe(3);
    expect(Object.values(s.votes).every(v => v === 0)).toBe(true);
    const id = (n: string) => s.parties.find(p => p.name === n)!.id;
    expect(s.agreements.some(a => new Set([a.a, a.b]).has(id("הליכוד")) && new Set([a.a, a.b]).has(id("הציונות הדתית")))).toBe(true);
    expect(s.parties.find(p => p.name === 'רע"ם')!.blocId).toBeNull();
  });
  it("merge: updates matched lists, keeps votes and unlisted lists, adds new blocs", () => {
    const base = rehearsal2022();
    const s = applySetupPaste(base, parseSetupText("הליכוד | מחל | גוש חדש |\nרשימה חדשה | חח | גוש חדש |").rows, "merge");
    expect(s.parties.length).toBe(base.parties.length + 1);
    expect(s.votes.likud).toBe(base.votes.likud);
    const likud = s.parties.find(p => p.id === "likud")!;
    expect(s.blocs.find(b => b.id === likud.blocId)!.name).toBe("גוש חדש");
    // Likud was pasted without a partner → its agreement with RZ is removed; others kept
    expect(s.agreements.some(a => a.a === "likud" || a.b === "likud")).toBe(false);
    expect(s.agreements.some(a => a.a === "shas" && a.b === "utj")).toBe(true);
  });
  it("replace on a blank election", () => {
    const s = applySetupPaste(blankState("x"), rows, "replace");
    expect(s.parties.length).toBe(7);
  });
});
