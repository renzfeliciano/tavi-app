import Image from "next/image";
import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";

type AppLogoProps = {
  /** Width and height in px (it is a square tile). */
  size?: number;
  className?: string;
};

/**
 * TAVI's own logo: the stamp with TAVI on its body, on its paper tile. This is
 * the app's branding (sidebar, top bar, home-screen and tab icons). A
 * business's own logo is only ever printed on its documents, never here.
 */
export function AppLogo({ size = 40, className }: AppLogoProps) {
  return (
    <Image
      src="/icons/tavi-stamp.png"
      alt={brand.wordmark}
      width={size}
      height={size}
      sizes={`${size}px`}
      className={cn("shrink-0 rounded-xl", className)}
    />
  );
}
