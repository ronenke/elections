import Link from "next/link";
import { AdminNav } from "@/components/AdminNav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="mx-auto max-w-7xl px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-blue-600 text-white grid place-items-center text-xs font-extrabold">120</div>
            <span className="font-bold">חישוב מנדטים</span>
            <AdminNav />
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="btn-secondary">לוח שידור</Link>
            <form action="/api/logout" method="post"><button className="btn-secondary">יציאה</button></form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
