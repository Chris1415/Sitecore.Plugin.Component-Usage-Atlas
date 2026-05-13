import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { HahnSoloFooter } from "@/components/hahn-solo-footer";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Component Usage Atlas",
  description: "Tenant-wide atlas of rendering and datasource usage for SitecoreAI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* T002 — Toaster mounted once at the root layout. Both /widget and
            /panel routes share this layout, so a single mount covers both
            surfaces. Per ADR-0021, toasts are reserved for cross-cutting
            failures (e.g. blob construction) — no per-action wiring at this
            stage. MarketplaceProvider has moved down into per-extension-point
            layouts (/widget/layout.tsx, /panel/layout.tsx) so the root
            IntroPage at `/` can render standalone outside the iframe. */}
        <Toaster />
        {children}
        <HahnSoloFooter />
      </body>
    </html>
  );
}
