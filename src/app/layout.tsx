import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { connection } from "next/server";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { brand } from "@/config/brand";
import { DEFAULT_MARKET, MARKETS } from "@/config/markets";
import "./globals.css";

// Geist (UI) and Geist Mono (serial numbers), per DESIGN.md. Both pass the
// ₱ glyph and tabular-figure check; ₱ lives in the latin-ext subset.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: {
    default: `${brand.name} — ${brand.taglines.primary}`,
    template: `%s · ${brand.name}`,
  },
  description: brand.description,
  applicationName: brand.name,
  openGraph: {
    siteName: brand.name,
    title: `${brand.name} — ${brand.taglines.primary}`,
    description: brand.description,
    type: "website",
  },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Every page renders per request so each one carries its own CSP nonce
  // (src/proxy.ts). Static pages would ship scripts the policy blocks.
  await connection();
  return (
    <html
      lang={MARKETS[DEFAULT_MARKET].locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
