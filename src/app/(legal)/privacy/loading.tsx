import { LegalDocumentSkeleton, LoadingScreen } from "@/components/skeletons";

// The Privacy Notice: title, date and intro, then its sections.
export default function PrivacyLoading() {
  return (
    <LoadingScreen label="Loading the Privacy Notice">
      <LegalDocumentSkeleton />
    </LoadingScreen>
  );
}
