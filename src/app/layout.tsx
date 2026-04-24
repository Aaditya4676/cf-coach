import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "CF Coach — Codeforces Coaching Agent",
  description: "AI-powered Codeforces mentor that analyzes your submissions, tracks progress, and generates personalized practice ladders to level up your competitive programming rating.",
  keywords: ["codeforces", "competitive programming", "coaching", "mentor", "practice", "rating"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="app-layout">
          <Sidebar />
          <main className="main-content">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
