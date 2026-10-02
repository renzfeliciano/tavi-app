import { PortalDocumentSkeleton } from "@/components/skeletons";

// A shared quote: who it's from and its status, then the quote.
export default function SharedQuoteLoading() {
  return <PortalDocumentSkeleton label="Loading quote" />;
}
