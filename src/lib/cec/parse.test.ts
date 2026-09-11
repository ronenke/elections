import { describe, it, expect } from "vitest";
import { parseCecHtml, parseCecText, matchRows, normalizeName } from "./parse";

/** Structure of votes25.bechirot.gov.il national results (final): name | letters | mandates | percent | votes (with a bar div) */
const finalHtml = `
<html><body>
<div class="summary">
  <div><span>סה"כ בעלי זכות בחירה</span><span>6,788,804</span></div>
  <div><span>סה"כ קולות שהוזנו - סופי</span><span>4,794,593</span></div>
  <div><span>שיעור ההצבעה</span><span>70.63%</span></div>
  <div><span>סה"כ הקולות הכשרים שהוזנו - סופי</span><span>4,764,742</span></div>
  <div><span>סה"כ הקולות הפסולים שהוזנו - סופי</span><span>29,851</span></div>
</div>
<table>
<tr><th>שם הרשימה</th><th>אותיות הרשימה</th><th>מנדטים</th><th>אחוז קולות הרשימה מסה"כ הקולות הכשרים</th><th>מספר הקולות הכשרים לרשימה</th></tr>
<tr><td>הליכוד בהנהגת בנימין נתניהו לראשות הממשלה</td><td>מחל</td><td>32</td><td>23.41%</td><td><div class="bar" style="width:100%"></div><span>1,115,336</span></td></tr>
<tr><td>יש עתיד בראשות יאיר לפיד לראשות הממשלה</td><td>פה</td><td>24</td><td>17.79%</td><td><div class="bar"></div>847,435</td></tr>
<tr><td>הציונות הדתית בראשות בצלאל סמוטריץ' ועוצמה יהודית</td><td>ט</td><td>14</td><td>10.84%</td><td>516,470</td></tr>
<tr><td>מרצ</td><td>מרצ</td><td>0</td><td>3.16%</td><td>150,793</td></tr>
<tr><td>הפיראטים</td><td>ףז</td><td>0</td><td>0.03%</td><td>1,223</td></tr>
</table></body></html>`;

/** Same page during the count: no mandates column */
const midHtml = finalHtml.replace("<th>מנדטים</th>", "").replace(/<td>(32|24|14|0)<\/td>/g, "").replace("סופי 4,764,742", "4,000,000").replace("29,851", "20,000");

describe("CEC final results page (with mandates column)", () => {
  const r = parseCecHtml(finalHtml);
  it("identifies columns by header — votes are votes, mandates are mandates", () => {
    expect(r.method).toBe("header");
    expect(r.errors).toEqual([]);
    expect(r.rows.map(x => [x.letters, x.votes, x.seats, x.percent])).toEqual([
      ["מחל", 1115336, 32, 23.41],
      ["פה", 847435, 24, 17.79],
      ["ט", 516470, 14, 10.84],
      ["מרצ", 150793, 0, 3.16],
      ["ףז", 1223, 0, 0.03],
    ]);
    expect(r.totalValidVotes).toBe(4764742);
  });
  it("keeps the full published name", () => {
    expect(r.rows[0].name).toContain("הליכוד");
  });
});

describe("CEC page during the count (no mandates column)", () => {
  it("parses the same rows without seats", () => {
    const r = parseCecHtml(midHtml);
    expect(r.method).toBe("header");
    expect(r.rows.map(x => x.votes)).toEqual([1115336, 847435, 516470, 150793, 1223]);
    expect(r.rows.every(x => x.seats === null)).toBe(true);
  });
});

describe("cross-checks catch a wrong column", () => {
  it("errors when 'votes' look like mandates next to real percentages", () => {
    // a table whose header names nothing useful → heuristic; percentages disagree with tiny 'votes'
    const bad = "<table><tr><th>א</th><th>ב</th><th>ג</th></tr><tr><td>הליכוד</td><td>32</td><td>23.41%</td></tr><tr><td>יש עתיד</td><td>24</td><td>17.79%</td></tr><tr><td>שס</td><td>11</td><td>8.25%</td></tr></table>";
    const r = parseCecHtml(bad);
    expect(r.method).toBe("heuristic");
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.errors.join(" ")).toContain("עמודה שגויה");
  });
  it("errors when percentages do not match votes / total", () => {
    const wrong = finalHtml.replace("1,115,336", "2,115,336").replace("847,435", "247,435").replace("516,470", "916,470");
    const r = parseCecHtml(wrong);
    expect(r.errors.some(e => e.includes("האחוזים אינם תואמים"))).toBe(true);
  });
  it("accepts consistent numbers without a header (heuristic picks the largest integer as votes)", () => {
    const text = "הליכוד\tמחל\t32\t23.41%\t1,115,336\nיש עתיד\tפה\t24\t17.79%\t847,435\nהציונות הדתית\tט\t14\t10.84%\t516,470";
    const r = parseCecText(text);
    expect(r.method).toBe("heuristic");
    expect(r.rows.map(x => [x.votes, x.seats])).toEqual([[1115336, 32], [847435, 24], [516470, 14]]);
    expect(r.errors).toEqual([]);
    expect(r.warnings.some(w => w.includes("ניחוש"))).toBe(true);
  });
});

describe("pasted text with header", () => {
  it("handles tab separated copy including the header row", () => {
    const text = "שם הרשימה\tאותיות הרשימה\tמנדטים\tאחוז קולות הרשימה\tמספר הקולות\nהליכוד\tמחל\t32\t23.41%\t1,115,336\nיש עתיד\tפה\t24\t17.79%\t847,435\n";
    const r = parseCecText(text);
    expect(r.method).toBe("header");
    expect(r.rows[1]).toEqual({ letters: "פה", name: "יש עתיד", votes: 847435, percent: 17.79, seats: 24 });
  });
});

describe("matching", () => {
  it("matches by letters, then by normalized name, including long CEC names", () => {
    const parties = [
      { id: "likud", name: "הליכוד", letters: "מחל" },
      { id: "rz", name: "הציונות הדתית", letters: "" },
      { id: "meretz", name: "מרצ", letters: "מרצ" },
    ];
    const m = matchRows(parseCecHtml(finalHtml).rows, parties);
    expect(m.map(x => x.partyId)).toEqual(["likud", null, "rz", "meretz", null]);
    expect(normalizeName('חד"ש - תע"ל')).toBe(normalizeName("חדש-תעל"));
  });
});
