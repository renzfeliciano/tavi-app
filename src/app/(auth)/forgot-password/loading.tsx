import { AuthFormSkeleton, LoadingScreen } from "@/components/skeletons";

// Forgot password: the heading and what happens next, the email, the button, the way back to sign in.// The Stamp beside the form is the sign-in pages' own life, so no page loader on top.
export default function ForgotPasswordLoading() {
  return (
    <LoadingScreen loader={false} label="Loading password reset">
      <AuthFormSkeleton title="w-48" description={2} fields={1} footer />
    </LoadingScreen>
  );
}
