import Link from "next/link";
import { AdminNav } from "@/components/AdminNav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="mx-auto max-w-7xl px-3 sm:px-4 h-14 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="h-8 w-8 shrink-0 rounded-xl bg-blue-600 text-white grid place-items-center text-xs font-extrabold">120</div>
            <span className="font-bold hidden sm:inline">חישוב מנדטים</span>
            <AdminNav />
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Link href="/" className="btn-secondary !px-2.5 sm:!px-4">לוח שידור</Link>
            <form action="/api/logout" method="post"><button className="btn-secondary !px-2.5 sm:!px-4">יציאה</button></form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-3 sm:px-4 py-4 sm:py-6 pb-28 md:pb-6">{children}</main>
    </div>
  );
}
