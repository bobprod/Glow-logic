import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Glow Logic v2",
  description: "Smart Stage OS & Nodal Creator",
  manifest: "/manifest.json",
  icons: [{ rel: "icon", url: "/glow-icon.svg", type: "image/svg+xml" }],
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body
        suppressHydrationWarning
        className="antialiased bg-[#0a0c10] flex flex-col h-screen w-screen overflow-hidden text-gray-100 font-sans"
      >
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ("serviceWorker" in navigator) {
                window.addEventListener("load", () => {
                  navigator.serviceWorker.register("/sw.js");
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
