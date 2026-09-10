import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "חישוב מנדטים — הבחירות לכנסת ה-26",
  description: "מערכת לחישוב חלוקת המנדטים (בדר-עופר) לפי תוצאות האמת",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans min-h-screen">{children}</body>
    </html>
  );
}
