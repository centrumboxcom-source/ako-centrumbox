import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CENTRUMBOX AKO — Корпоративна Платформа Навчання",
  description: "Сучасна корпоративна екосистема навчання зі схемною ізоляцією PostgreSQL на Neon. Уроки, контрольні тести, аналітика та гейміфікація.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk" className="light">
      <body className="antialiased min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
