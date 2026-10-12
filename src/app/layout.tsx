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
  // The tab icons are not here but in <head> below (see TAB_ICONS): metadata is
  // swapped on every navigation, which leaves the page with no icon for a few
  // milliseconds, and the browser then shows an old or default one.
  icons: { apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: brand.name, statusBarStyle: "default" },
  openGraph: {
    siteName: brand.name,
    title: `${brand.name} — ${brand.taglines.primary}`,
    description: brand.description,
    type: "website",
  },
};

export const viewport: Viewport = { themeColor: brand.emailColors.accent };

/**
 * The tab icon, as plain links in the root layout's <head>. The root layout is
 * not re-rendered when moving between pages, so these links stay put and the
 * browser never has a moment without an icon. All three are the same tile; the
 * 192 and 512 px icons belong to the web manifest. `?v=` makes a browser drop
 * any copy it kept of an earlier design: raise it when the icon changes.
 */
const ICON_VERSION = "2";
const TAB_ICONS = [
  { href: `/favicon.ico?v=${ICON_VERSION}`, sizes: "16x16 32x32 48x48", type: "image/x-icon" },
  { href: `/icons/favicon-32.png?v=${ICON_VERSION}`, sizes: "32x32", type: "image/png" },
  { href: `/icons/favicon-48.png?v=${ICON_VERSION}`, sizes: "48x48", type: "image/png" },
] as const;

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
      <head>
        {TAB_ICONS.map((icon) => (
          <link key={icon.href} rel="icon" {...icon} />
        ))}
      </head>
      <body className="flex min-h-full flex-col">
        <ThemeProvider theme={theme}>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster position="top-center" theme={theme} />
        </ThemeProvider>
      </body>
    </html>
  );
}
