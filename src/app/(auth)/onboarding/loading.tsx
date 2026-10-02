import { AuthFormSkeleton, LoadingScreen } from "@/components/skeletons";

// Onboarding: the welcome, the business name, country and currency, the button.
export default function OnboardingLoading() {
  return (
    <LoadingScreen label="Loading business setup">
      <AuthFormSkeleton title="w-44" description={2} fields={3} />
    </LoadingScreen>
  );
}
