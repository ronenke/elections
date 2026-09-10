"use client";
import { useMemo, useState } from "react";

export interface HemicycleGroup {
  id: string;
  label: string;
  color: string;
  seats: number;
  /** members in display order, each with its seat count (sum = seats) */
  parts: { id: string; label: string; seats: number }[];
}

/**
 * Parliament diagram: 120 seats on concentric arcs, filled from the right (first group) to the left.
 * Pure SVG, no library. Each seat carries its list name as a tooltip; blocs are labelled in a legend
 * below (identity is never colour-alone).
 */
export function Hemicycle({ groups, total = 120, unassignedColor = "#64748b", unassignedLabel = "ללא גוש" }: { groups: HemicycleGroup[]; total?: number; unassignedColor?: string; unassignedLabel?: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const seats = useMemo(() => layout(total), [total]);

  // seat → (group, part) in order: groups as given, parts within group; leftovers = unassigned
  const owners = useMemo(() => {
    const out: { color: string; label: string; groupId: string; partId: string }[] = [];
    for (const g of groups) for (const p of g.parts) for (let i = 0; i < p.seats; i++) out.push({ color: g.color, label: `${p.label} · ${g.label}`, groupId: g.id, partId: p.id });
    while (out.length < total) out.push({ color: unassignedColor, label: unassignedLabel, groupId: "_", partId: "_" });
    return out.slice(0, total);
  }, [groups, total, unassignedColor, unassignedLabel]);

  const W = 1000, H = 540;
  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`חלוקת ${total} המושבים לפי גושים`}>
        {seats.map((s, i) => {
          const o = owners[i];
          const dim = hover && hover !== o.partId;
          return (
            <circle
              key={i}
              cx={500 + s.x * 460}
              cy={500 - s.y * 460}
              r={s.r * 460}
              fill={o.color}
              opacity={dim ? 0.25 : 1}
              stroke="#0b1220"
              strokeWidth={2}
              onMouseEnter={() => setHover(o.partId)}
              onMouseLeave={() => setHover(null)}
            >
              <title>{`מושב ${i + 1}: ${o.label}`}</title>
            </circle>
          );
        })}
        {/* majority marker at seat 61 (vertical centre line) */}
        <line x1={500} y1={40} x2={500} y2={120} stroke="#ffffff" strokeOpacity={0.35} strokeWidth={2} strokeDasharray="6 6" />
        <text x={500} y={30} textAnchor="middle" fill="#94a3b8" fontSize={22} fontWeight={700}>61</text>
      </svg>
      <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 mt-2 text-sm">
        {groups.map(g => (
          <span key={g.id} className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ background: g.color }} />
            <span className="text-slate-300">{g.label}</span>
            <b className="num text-white">{g.seats}</b>
          </span>
        ))}
        {owners.some(o => o.groupId === "_") && (
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: unassignedColor }} /><span className="text-slate-300">{unassignedLabel}</span><b className="num text-white">{owners.filter(o => o.groupId === "_").length}</b></span>
        )}
      </div>
    </div>
  );
}

/** Seat positions on a half-disc, unit radius 1, sorted from the right (angle 0) to the left (angle π). */
function layout(total: number): { x: number; y: number; r: number; angle: number }[] {
  const rows = total <= 60 ? 3 : total <= 130 ? 5 : 6;
  const inner = 0.42, outer = 1;
  const radii = Array.from({ length: rows }, (_, i) => inner + ((outer - inner) * i) / (rows - 1));
  const circumference = radii.reduce((s, r) => s + Math.PI * r, 0);
  // seats per row proportional to arc length, fixed so the sum is exactly `total`
  let counts = radii.map(r => Math.round((total * Math.PI * r) / circumference));
  let diff = total - counts.reduce((s, c) => s + c, 0);
  for (let i = counts.length - 1; diff !== 0; i = (i - 1 + counts.length) % counts.length) { counts[i] += Math.sign(diff); diff -= Math.sign(diff); }
  const seatR = Math.min(0.5 * ((outer - inner) / (rows - 1)) * 0.82, 0.045);
  const pts: { x: number; y: number; r: number; angle: number }[] = [];
  radii.forEach((r, ri) => {
    const n = counts[ri];
    for (let k = 0; k < n; k++) {
      const angle = n === 1 ? Math.PI / 2 : (Math.PI * k) / (n - 1); // 0 = right, π = left
      pts.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r, r: seatR, angle });
    }
  });
  // fill order: sweep by angle so each bloc forms a contiguous wedge
  return pts.sort((a, b) => a.angle - b.angle || a.r - b.r);
}
