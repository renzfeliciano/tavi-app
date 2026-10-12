import { AuthFormSkeleton, LoadingScreen } from "@/components/skeletons";

// Sign in: the heading, email and password, the button, then the sign-up line.// The Stamp beside the form is the sign-in pages' own life, so no page loader on top.
export default function SignInLoading() {
  return (
    <LoadingScreen loader={false} label="Loading sign in">
      <AuthFormSkeleton title="w-48" fields={2} footer />
    </LoadingScreen>
  );
}
