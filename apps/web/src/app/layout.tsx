import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import TopBar from "../components/TopBar";
import ChatAssistant from "../components/ChatAssistant";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Glow Logic - Smart Stage OS",
  description: "Système de contrôle d'éclairage DMX No-Code pour spectacles live",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Glow Logic",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "Glow Logic",
    title: "Glow Logic - Smart Stage OS",
    description: "Système de contrôle d'éclairage DMX No-Code pour spectacles live",
  },
  twitter: {
    card: "summary_large_image",
    title: "Glow Logic - Smart Stage OS",
    description: "Système de contrôle d'éclairage DMX No-Code pour spectacles live",
  },
};

export const viewport: Viewport = {
  themeColor: "#06b6d4",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/icon.svg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#06b6d4" />
      </head>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#0a0c10] flex flex-col h-screen w-screen overflow-hidden text-gray-100 font-sans`}
      >
        <TopBar />
        <main className="flex-1 w-full overflow-hidden relative">
          {children}
        </main>
        <ChatAssistant />
      </body>
    </html>
  );
}
