import { AuthFormSkeleton, LoadingScreen } from "@/components/skeletons";

// Sign in: the heading, email and password, the button, then the sign-up line.
export default function SignInLoading() {
  return (
    <LoadingScreen label="Loading sign in">
      <AuthFormSkeleton title="w-48" fields={2} footer />
    </LoadingScreen>
  );
}
