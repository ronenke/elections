"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const items = [
  { href: "/admin", label: "הזנת קולות" },
  { href: "/admin/import", label: "ייבוא מוועדת הבחירות" },
  { href: "/admin/setup", label: "רשימות והסכמים" },
  { href: "/admin/audit", label: "פירוט החישוב" },
  { href: "/admin/history", label: "היסטוריה" },
  { href: "/admin/elections", label: "מערכות בחירות" },
  { href: "/admin/status", label: "מצב" },
];

const isActive = (href: string, path: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));

/** Desktop: inline links. Phone: a "תפריט" button that opens a full-width list under the header. */
export function AdminNav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [path]);
  const current = items.find(i => isActive(i.href, path))?.label ?? "תפריט";
  return (
    <>
      <nav className="hidden md:flex items-center gap-1 mr-4">
        {items.map(i => (
          <Link key={i.href} href={i.href} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${isActive(i.href, path) ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100"}`}>
            {i.label}
          </Link>
        ))}
      </nav>
      <button
        type="button"
        className="md:hidden inline-flex items-center gap-1.5 rounded-lg bg-blue-50 text-blue-700 px-2.5 py-1.5 text-sm font-semibold max-w-[46vw]"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls="mobile-nav"
        data-testid="mobile-menu"
      >
        <span className="text-base leading-none">☰</span>
        <span className="truncate">{current}</span>
      </button>
      {open && (
        <>
          <div className="md:hidden fixed inset-0 top-14 bg-slate-900/30 z-20" onClick={() => setOpen(false)} />
          <nav id="mobile-nav" className="md:hidden absolute inset-x-0 top-14 z-30 bg-white border-b border-slate-200 shadow-lg p-2 grid gap-1">
            {items.map(i => (
              <Link key={i.href} href={i.href} onClick={() => setOpen(false)} className={`rounded-xl px-4 py-3 text-base font-medium ${isActive(i.href, path) ? "bg-blue-50 text-blue-700" : "text-slate-700 active:bg-slate-100"}`}>
                {i.label}
              </Link>
            ))}
          </nav>
        </>
      )}
    </>
  );
}
