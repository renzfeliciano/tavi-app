import { AuthFormSkeleton, LoadingScreen } from "@/components/skeletons";

// Forgot password: the heading and what happens next, the email, the button, the way back to sign in.
export default function ForgotPasswordLoading() {
  return (
    <LoadingScreen label="Loading password reset">
      <AuthFormSkeleton title="w-48" description={2} fields={1} footer />
    </LoadingScreen>
  );
}
