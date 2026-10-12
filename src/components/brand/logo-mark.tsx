import { cn } from "@/lib/utils";

type LogoMarkProps = {
  /** Height in px; the width follows (the stamp is a little taller than wide). */
  size?: number;
  className?: string;
};

/**
 * The TAVI logo: a rubber stamp pressing a violet imprint with a white check.
 * Decorative (the wordmark or page title names the product), so it is
 * aria-hidden. The tool takes the text colour so it stays visible on any
 * ground; the imprint is always the primary violet. This is the logo, not the
 * Stamp mascot (brand-mascot.tsx), which is a separate character.
 *
 * This is the small tool-and-imprint mark used in footers and the PDF (which
 * mirrors it in document-pdf.tsx). TAVI's app logo, tab and home-screen icons
 * are the stamp with TAVI on its body: see app-logo.tsx.
 */
export function LogoMark({ size = 24, className }: LogoMarkProps) {
  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox="88 22 336 468"
      className={cn("shrink-0 text-foreground", className)}
      style={{ height: size, width: size * (336 / 468) }}
    >
      <rect x="190" y="30" width="132" height="118" rx="54" fill="currentColor" />
      <rect x="226" y="136" width="60" height="46" fill="currentColor" />
      <rect x="96" y="176" width="320" height="58" rx="22" fill="currentColor" />
      <rect x="116" y="234" width="280" height="22" rx="8" className="fill-primary" />
      <rect x="96" y="286" width="320" height="196" rx="30" className="fill-primary" />
      <path
        transform="translate(256 388) scale(0.62) translate(-264 -248)"
        d="M110 240 L218 372 L418 125"
        fill="none"
        className="stroke-primary-foreground"
        strokeWidth={40}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
