import Image from "next/image";
import { cn } from "@/lib/utils";
import { fitLogo, LOGO_BOXES, type LogoSize } from "@/modules/files/client";

type BusinessLogoProps = {
  logo: { src: string; width: number; height: number };
  /** The business's name, for the image's alt text. */
  name: string;
  /** The box to fit the logo in; the document letterhead's by default. */
  box?: LogoSize;
  className?: string;
};

/**
 * The business's logo, fitted into a box with its own aspect ratio (never
 * stretched, cropped or enlarged). The same rule the PDF uses, so a very wide
 * or very tall logo can't overflow its container on screen or on paper.
 */
export function BusinessLogo({ logo, name, box = LOGO_BOXES.document, className }: BusinessLogoProps) {
  const size = fitLogo(logo, box);
  if (!size) return null;
  return (
    <Image
      src={logo.src}
      alt={`${name} logo`}
      width={size.width}
      height={size.height}
      unoptimized
      className={cn("h-auto max-w-full object-contain object-left", className)}
    />
  );
}
