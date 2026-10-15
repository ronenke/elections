import { n } from "@/lib/format";

export const DANGER = {
  1: { bg: "#16a34a", label: "בטוח מאוד" },
  2: { bg: "#84cc16", label: "בטוח" },
  3: { bg: "#eab308", label: "בינוני" },
  4: { bg: "#f97316", label: "בסכנה" },
  5: { bg: "#dc2626", label: "בסכנה גבוהה" },
} as const;

/** Five-level "how safe is the last seat" indicator: 1 green … 5 red. */
export function DangerDot({ level, toLose, size = 12 }: { level: 1 | 2 | 3 | 4 | 5 | null; toLose: number | null; size?: number }) {
  if (!level) return <span className="text-slate-300">—</span>;
  const d = DANGER[level];
  return (
    <span className="inline-flex items-center gap-1.5" title={`${d.label} — ${toLose !== null ? `${n(toLose)} קולות מעל המנדט האחרון` : ""}`}>
      <span className="inline-block rounded-full shrink-0" style={{ width: size, height: size, background: d.bg, boxShadow: `0 0 0 2px ${d.bg}33` }} />
      <span className="flex gap-0.5" aria-hidden>
        {[1, 2, 3, 4, 5].map(i => <span key={i} className="inline-block h-2 w-1 rounded-sm" style={{ background: i === level ? d.bg : "currentColor", opacity: i === level ? 1 : 0.15 }} />)}
      </span>
    </span>
  );
}

/**
 * Surplus-agreement badge. +1 = the list received the pair's surplus seat in the split between the two partners
 * (the conventional meaning); 0 = in an agreement, surplus seat went to the partner or there was none.
 * The tooltip adds the counterfactual ("without the agreement it would have N").
 */
export function AgreementBadge({ effect, partner, counterfactual, seats, active = true }: { effect: number | null; partner?: string | null; counterfactual?: number | null; seats?: number; active?: boolean }) {
  if (effect === null) return null;
  const withPartner = partner ? ` (הסכם עם ${partner})` : "";
  const cf = counterfactual === null || counterfactual === undefined || seats === undefined ? "" : ` · ללא ההסכם: ${seats - counterfactual} מנדטים`;
  if (!active) return <span className="badge bg-slate-100 text-slate-400" title={`הסכם עודפים${withPartner} — לא פעיל: אחת השותפות לא עברה את אחוז החסימה`}>0</span>;
  if (effect === 0) return <span className="badge bg-slate-100 text-slate-500" title={`בהסכם עודפים${withPartner} — המנדט העודף של הזוג לא הגיע לרשימה זו${cf}`}>0</span>;
  const pos = effect > 0;
  return (
    <span className={`badge ${pos ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"}`} title={pos ? `קיבלה את המנדט העודף של הזוג${withPartner}${cf}` : `מנדט שאבד בגלל הסכם העודפים${withPartner}`}>
      {pos ? `+${effect}` : `−${-effect}`}
    </span>
  );
}
