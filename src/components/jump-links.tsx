// "On this page": a row of links to the sections of a long settings page. Plain in-page anchors, so they work
// before any script has loaded; the sections they point at carry the ids (FormSection's `id`) and leave room above
// themselves when scrolled to. A page with fewer than three sections has nothing worth jumping between.

export type JumpLink = { id: string; label: string };

export const MIN_JUMP_LINKS = 3;

export function JumpLinks({ links }: { links: JumpLink[] }) {
  if (links.length < MIN_JUMP_LINKS) return null;
  return (
    <nav aria-label="On this page" className="mt-6">
      <ul className="flex flex-wrap gap-2">
        {links.map((link) => (
          <li key={link.id}>
            <a
              href={`#${link.id}`}
              className="inline-flex h-8 items-center rounded-md pointer-coarse:h-11 border border-border bg-card px-3 text-sm text-muted-foreground transition-colors duration-(--duration-fast) outline-none hover:bg-accent hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/35"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
