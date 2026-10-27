import { describe, it, expect } from "vitest";
import { parseCecText, parseCecHtml, matchRows } from "./parse";

// Exact copy (Ctrl+A, Ctrl+C) of votes26.bechirot.gov.il/nationalresults?lang=he on election night, 28/10/2026 01:03
const copied = `ועדת הבחירות המרכזית לכנסת
הבחירות לכנסת ה-26
תוצאות ארציות
תוצאות נכון ל- 28/10/2026 01:03
מספר בעלי זכות בחירה
7,331,981

קולות עד עתה
14,433

קלפיות עד עתה
78

קולות כשרים עד עתה
14,386

קולות פסולים עד עתה
47
שם הרשימה\tאותיות הרשימה\tאחוז מסך הקולות הכשרים\tקולות כשרים לרשימה
הליכוד בהנהגת בנימין נתניהו לראשות הממשלה\tמחל\t26.50%\t
3,812
ישר! עם איזנקוט לראשות הממשלה מאחדים את ישראל\tדרך\t19.32%\t
2,779
הציונות הדתית בראשות בצלאל סמוטריץ' וזהות בראשות משה פייגלין\tט\t11.25%\t
1,618
הדמוקרטים בראשות יאיר גולן\tאמת\t8.44%\t
1,214
ביחד בראשות נפתלי בנט\tרק\t8.20%\t
1,180
עוצמה יהודית בראשות איתמר בן גביר\tב\t8.15%\t
1,172
ישראל ביתנו בראשות אביגדור ליברמן\tל\t5.05%\t
727
התאחדות הספרדים שומרי תורה תנועתו של מרן הרב עובדיה יוסף זצ"ל\tשס\t4.34%\t
625
המילואימניקים והכלכלית בראשות יועז הנדל וירון זליכה\tדי\t3.16%\t
454
עמך ישראל בראשות עופר וינטר\tך\t2.68%\t
385
יהדות התורה והשבת אגודת ישראל - דגל התורה\tג\t1.79%\t
257
נעם לישראל למען עתיד הילדים בראשות אבי מעוז\tני\t0.32%\t
46
רע"ם - הרשימה הערבית המאוחדת\tעם\t0.18%\t
26
הרשימה המשותפת\tודם\t0.13%\t
19
צבע שחור - מגן עולם התורה\tנר\t0.00%\t
0
`;

const html = `<html><body><div>קולות כשרים עד עתה</div><div class="fw-bold fs-2">14,386</div>
<table class="xx dir-dir"><thead class="sticky-top"><tr><th class="pb-3">שם הרשימה</th><th class="pb-3">אותיות הרשימה</th><th class="pb-3">אחוז מסך הקולות הכשרים</th><th class="pb-3">קולות כשרים לרשימה</th></tr></thead>
<tbody><tr><td class="text-blue" scope="row" title="הליכוד">הליכוד בהנהגת בנימין נתניהו לראשות הממשלה</td><td>מחל</td><td>26.50%</td><td class="text-end pe-table"><div class="d-flex align-items-center"><span class="flex-fill text-start">3,812</span><span class="bar"></span></div></td></tr>
<tr><td class="text-blue" scope="row">ישר! עם איזנקוט לראשות הממשלה מאחדים את ישראל</td><td>דרך</td><td>19.32%</td><td><div><span>2,779</span><span class="bar"></span></div></td></tr></tbody></table></body></html>`;

describe("votes26 (26th Knesset) layout", () => {
  it("parses a Ctrl+A/Ctrl+C copy where the vote count sits on its own line", () => {
    const r = parseCecText(copied);
    expect(r.errors).toEqual([]);
    expect(r.method).toBe("header");
    expect(r.rows.length).toBe(15);
    expect(r.rows[0]).toMatchObject({ letters: "מחל", votes: 3812, percent: 26.5 });
    expect(r.rows.find(x => x.letters === "שס")!.votes).toBe(625);
    expect(r.rows.find(x => x.letters === "נר")!.votes).toBe(0);
    expect(r.totalValidVotes).toBe(14386);
  });
  it("early on election night tiny counts are not mistaken for a mandates column (Galei Tzahal, 2,661 votes)", () => {
    const early = "קולות כשרים עד עתה\n2,661\nשם הרשימה\tאותיות הרשימה\tאחוז מסך הקולות הכשרים\tקולות כשרים לרשימה\nהליכוד\tמחל\t26.49%\t\n705\nביחד בראשות נפתלי בנט\tרק\t6.50%\t\n173\nהתאחדות הספרדים\tשס\t4.81%\t\n128\nנעם לישראל\tני\t0.71%\t\n19\n";
    const r = parseCecText(early);
    expect(r.errors).toEqual([]);
    expect(r.rows.find(x => x.letters === "רק")!.votes).toBe(173);
    // but a real mandates column (final results scale) is still caught
    const bad = "קולות כשרים עד עתה\n4,764,742\nשם הרשימה\tאותיות\tאחוז\tמספר הקולות\nהליכוד\tמחל\t23.41%\t32\nיש עתיד\tפה\t17.79%\t24\nש\"ס\tשס\t8.25%\t11\n";
    expect(parseCecText(bad).errors.length).toBeGreaterThan(0);
  });
  it("parses the server HTML", () => {
    const r = parseCecHtml(html);
    expect(r.errors).toEqual([]);
    expect(r.rows.map(x => [x.letters, x.votes])).toEqual([["מחל", 3812], ["דרך", 2779]]);
    expect(r.totalValidVotes).toBe(14386);
  });
  it("parses a copy where every cell is on its own line", () => {
    const vertical = "שם הרשימה\nאותיות הרשימה\nאחוז מסך הקולות הכשרים\nקולות כשרים לרשימה\nהליכוד בהנהגת בנימין נתניהו\nמחל\n26.50%\n3,812\nישר! עם איזנקוט\nדרך\n19.32%\n2,779\n";
    const r = parseCecText(vertical);
    expect(r.rows.map(x => [x.letters, x.votes])).toEqual([["מחל", 3812], ["דרך", 2779]]);
  });
  it("matches rows to the 2026 lists by letters", () => {
    const parties = [{ id: "likud", name: "הליכוד", letters: "מחל" }, { id: "shas", name: "ש\"ס", letters: "שס" }, { id: "yashar", name: "ישר", letters: "דרך" }];
    const m = matchRows(parseCecText(copied).rows, parties);
    expect(m.find(x => x.letters === "מחל")!.partyId).toBe("likud");
    expect(m.find(x => x.letters === "שס")!.partyId).toBe("shas");
    expect(m.find(x => x.letters === "דרך")!.partyId).toBe("yashar");
  });
});
