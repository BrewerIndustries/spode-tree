import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spode Christmas Tree",
  description: "Inventory of the Spode Christmas Tree china line — what's in the collection and what's still to find.",
  appleWebApp: { capable: true, title: "Spode Tree", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1f4d33" },
    { media: "(prefers-color-scheme: dark)", color: "#0f2419" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const isDev = process.env.JARVIS_ENV === "dev";
  return (
    <html lang="en">
      <body>
        {isDev && <div className="env-banner">Development · this is the dev site</div>}
        {children}
      </body>
    </html>
  );
}
