import type { ElectionState } from "./types";

/**
 * Initial state for the 26th Knesset election (27 October 2026).
 * Lists closed on 8 Sept 2026. Ballot letters and surplus agreements must be confirmed
 * from https://www.gov.il/he/pages/candidates-lists-26 and the CEC — everything here is editable.
 */
export function seedState(): ElectionState {
  const blocs = [
    { id: "coalition", name: "גוש הקואליציה", color: "#2563eb" },
    { id: "opposition", name: "גוש האופוזיציה", color: "#f59e0b" },
    { id: "arab", name: "המפלגות הערביות", color: "#16a34a" },
  ];
  const names: [string, string, string | null][] = [
    ["likud", "הליכוד", "coalition"],
    ["yashar", "ישר", "opposition"],
    ["beyachad", "ביחד", "opposition"],
    ["democrats", "הדמוקרטים", "opposition"],
    ["utj", "יהדות התורה", "coalition"],
    ["shas", "ש\"ס", "coalition"],
    ["otzma", "עוצמה יהודית", "coalition"],
    ["beiteinu", "ישראל ביתנו", "opposition"],
    ["joint", "הרשימה המשותפת", "arab"],
    ["raam", "רע\"ם", "arab"],
    ["rz", "הציונות הדתית-זהות", "coalition"],
    ["amcha", "עמך ישראל", null],
    ["miluim", "המילואימניקים והכלכלית", null],
  ];
  const parties = names.map(([id, name, blocId], i) => ({ id, name, letters: "", blocId, order: i }));
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    election: { name: "הבחירות לכנסת ה-26", date: "2026-10-27", cecUrl: "https://votes26.bechirot.gov.il/" },
    parties,
    blocs,
    agreements: [],
    votes: Object.fromEntries(parties.map(p => [p.id, 0])),
    otherValidVotes: 0,
    countedPercent: null,
    note: "",
    source: "seed",
  };
}

/** The 2022 election, for rehearsal mode. */
export function rehearsal2022(): ElectionState {
  const rows: [string, string, string, number, string | null][] = [
    ["likud", "הליכוד", "מחל", 1115336, "coalition"],
    ["ya", "יש עתיד", "פה", 847435, "opposition"],
    ["rz", "הציונות הדתית", "ט", 516470, "coalition"],
    ["nu", "המחנה הממלכתי", "כן", 432482, "opposition"],
    ["shas", "ש\"ס", "שס", 392964, "coalition"],
    ["utj", "יהדות התורה", "ג", 280194, "coalition"],
    ["yb", "ישראל ביתנו", "ל", 213687, "opposition"],
    ["raam", "רע\"ם", "עם", 194047, "arab"],
    ["hadash", "חד\"ש-תע\"ל", "ום", 178735, "arab"],
    ["labor", "העבודה", "אמת", 175992, "opposition"],
    ["meretz", "מרצ", "מרצ", 150793, "opposition"],
    ["balad", "בל\"ד", "ד", 138617, "arab"],
    ["jh", "הבית היהודי", "טב", 56775, null],
  ];
  const listed = rows.reduce((s, r) => s + r[3], 0);
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    election: { name: "חזרה גנרלית — הבחירות לכנסת ה-25 (2022)", date: "2022-11-01", cecUrl: "https://votes25.bechirot.gov.il/" },
    parties: rows.map(([id, name, letters, , blocId], i) => ({ id, name, letters, blocId, order: i })),
    blocs: [
      { id: "coalition", name: "גוש הימין", color: "#2563eb" },
      { id: "opposition", name: "גוש המרכז-שמאל", color: "#f59e0b" },
      { id: "arab", name: "המפלגות הערביות", color: "#16a34a" },
    ],
    agreements: [{ a: "labor", b: "meretz" }, { a: "likud", b: "rz" }, { a: "nu", b: "ya" }, { a: "shas", b: "utj" }],
    votes: Object.fromEntries(rows.map(r => [r[0], r[3]])),
    otherValidVotes: 4764742 - listed,
    countedPercent: 100,
    note: "תוצאות סופיות 2022 — לבדיקה בלבד",
    source: "seed",
  };
}
