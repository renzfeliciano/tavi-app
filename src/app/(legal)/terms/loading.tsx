import { LegalDocumentSkeleton, LoadingScreen } from "@/components/skeletons";

// The Terms of Service: title, date and intro, then its sections.
export default function TermsLoading() {
  return (
    <LoadingScreen label="Loading the Terms of Service">
      <LegalDocumentSkeleton />
    </LoadingScreen>
  );
}
