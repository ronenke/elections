import { describe, it, expect } from "vitest";
import { parseCecHtml, parseCecText, matchRows, normalizeName } from "./parse";

const html = `
<html><body>
<div class="summary">נספרו 92.7% מהקולות. קולות כשרים: 4,412,345</div>
<table>
<tr><th>אות</th><th>שם הרשימה</th><th>קולות</th><th>אחוז</th></tr>
<tr><td>מחל</td><td>הליכוד</td><td>1,115,336</td><td>23.41%</td></tr>
<tr><td>פה</td><td>יש עתיד</td><td>847,435</td><td>17.79%</td></tr>
<tr><td>אמת</td><td>העבודה</td><td>175,992</td><td>3.69%</td></tr>
<tr><td>ום</td><td>חד"ש - תע"ל</td><td>178,735</td><td>3.75%</td></tr>
<tr><td></td><td>סה"כ</td><td>4,764,742</td><td>100%</td></tr>
</table></body></html>`;

describe("CEC html parsing", () => {
  it("extracts rows, counted percent and total", () => {
    const r = parseCecHtml(html);
    expect(r.rows.map(x => [x.letters, x.name, x.votes, x.percent])).toEqual([
      ["מחל", "הליכוד", 1115336, 23.41],
      ["פה", "יש עתיד", 847435, 17.79],
      ["אמת", "העבודה", 175992, 3.69],
      ["ום", 'חד"ש - תע"ל', 178735, 3.75],
    ]);
    expect(r.countedPercent).toBe(92.7);
    expect(r.totalValidVotes).toBe(4412345);
  });
});

describe("pasted text parsing", () => {
  it("handles tab separated copy from the browser", () => {
    const text = "אות\tשם הרשימה\tקולות\tאחוז\nמחל\tהליכוד\t1,115,336\t23.41%\nפה\tיש עתיד\t847,435\t17.79%\n";
    const r = parseCecText(text);
    expect(r.rows.length).toBe(2);
    expect(r.rows[1]).toEqual({ letters: "פה", name: "יש עתיד", votes: 847435, percent: 17.79 });
  });
  it("handles space separated lines without letters", () => {
    const r = parseCecText("הליכוד   1115336   23.4\nיש עתיד   847435   17.8");
    expect(r.rows.map(x => x.votes)).toEqual([1115336, 847435]);
  });
});

describe("matching", () => {
  it("matches by letters, then by normalized name", () => {
    const parties = [
      { id: "likud", name: "הליכוד", letters: "מחל" },
      { id: "hadash", name: 'חד"ש-תע"ל', letters: "" },
      { id: "labor", name: "העבודה", letters: "אמת" },
    ];
    const m = matchRows(parseCecHtml(html).rows, parties);
    expect(m.map(x => x.partyId)).toEqual(["likud", null, "labor", "hadash"]);
    expect(normalizeName('חד"ש - תע"ל')).toBe(normalizeName("חדש-תעל"));
  });
});
