import { Wordmark } from "@/components/brand/wordmark";

/** The foot of a customer link: "Sent with" and the TAVI wordmark, alone. */
export function PortalSignoff() {
  return (
    <footer className="mt-10 flex items-center justify-center gap-2 text-xs text-muted-foreground">
      Sent with <Wordmark size={12} />
    </footer>
  );
}
