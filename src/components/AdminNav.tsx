"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "הזנת קולות" },
  { href: "/admin/import", label: "ייבוא מוועדת הבחירות" },
  { href: "/admin/setup", label: "רשימות והסכמים" },
  { href: "/admin/audit", label: "פירוט החישוב" },
  { href: "/admin/history", label: "היסטוריה" },
  { href: "/admin/elections", label: "מערכות בחירות" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="hidden md:flex items-center gap-1 mr-4">
      {items.map(i => {
        const active = i.href === "/admin" ? path === "/admin" : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100"}`}>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
