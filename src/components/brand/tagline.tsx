import { brand } from "@/config/brand";

/**
 * The primary tagline with its last sentence ("Get paid.") in the brand
 * colour, like the home page's headline. Put it inside the paragraph that
 * carries the surrounding type size and colour.
 */
export function Tagline() {
  const text = brand.taglines.primary;
  const cut = text.slice(0, -1).lastIndexOf(". ") + 2;
  if (cut < 2) return <>{text}</>;
  return (
    <>
      {text.slice(0, cut)}
      <span className="text-primary-text">{text.slice(cut)}</span>
    </>
  );
}
