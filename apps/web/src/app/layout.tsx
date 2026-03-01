import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import TopBar from "../components/TopBar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Glow Logic v2",
  description: "Smart Stage OS & Nodal Creator",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#0a0c10] flex flex-col h-screen w-screen overflow-hidden text-gray-100 font-sans`}
      >
        <TopBar />
        <main className="flex-1 w-full overflow-hidden relative">
          {children}
        </main>
      </body>
    </html>
  );
}
