import { AuthFormSkeleton, LoadingScreen } from "@/components/skeletons";

// Updated terms: the heading and what changed, the agreement box, the button, then sign out.
export default function AcceptTermsLoading() {
  return (
    <LoadingScreen label="Loading updated terms">
      <AuthFormSkeleton title="w-56" description={3} checkbox footer />
    </LoadingScreen>
  );
}
