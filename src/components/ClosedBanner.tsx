import Link from "next/link";
export function ClosedBanner() {
  return (
    <div className="rounded-2xl bg-slate-800 text-white p-4 text-sm flex flex-wrap items-center justify-between gap-3">
      <span>🔒 <b>מערכת הבחירות סגורה — התוצאות סופיות.</b> לא ניתן לשנות קולות, רשימות או הסכמים.</span>
      <Link href="/admin/elections" className="underline underline-offset-4">לפתיחה מחדש: מערכות בחירות</Link>
    </div>
  );
}
