export const fmt = new Intl.NumberFormat("he-IL");
export function n(v: number | null | undefined): string {
  return v === null || v === undefined ? "—" : fmt.format(v);
}
export function pct(v: number | null | undefined, digits = 2): string {
  return v === null || v === undefined ? "—" : `${v.toFixed(digits)}%`;
}
export function signed(v: number): string {
  return (v > 0 ? "+" : v < 0 ? "−" : "") + fmt.format(Math.abs(v));
}
export function time(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
export function clock(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("he-IL", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit" });
}
