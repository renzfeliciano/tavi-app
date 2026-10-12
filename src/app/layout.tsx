import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { brand } from "@/config/brand";
import { DEFAULT_MARKET, MARKETS } from "@/config/markets";
import { htmlThemeAttribute, parseTheme, THEME_COOKIE } from "@/shared/theme/theme";
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
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: { capable: true, title: brand.name, statusBarStyle: "default" },
  openGraph: {
    siteName: brand.name,
    title: `${brand.name} — ${brand.taglines.primary}`,
    description: brand.description,
    type: "website",
  },
};

export const viewport: Viewport = { themeColor: brand.emailColors.accent };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Every page renders per request so each one carries its own CSP nonce
  // (src/proxy.ts). Static pages would ship scripts the policy blocks.
  await connection();
  // The colour theme (D24): an explicit choice pins <html>; "system" leaves it to the browser (CSS only, no script).
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html
      lang={MARKETS[DEFAULT_MARKET].locale}
      data-theme={htmlThemeAttribute(theme)}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider theme={theme}>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster position="top-center" theme={theme} />
        </ThemeProvider>
      </body>
    </html>
  );
}
