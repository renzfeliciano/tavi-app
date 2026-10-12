import { AuthFormSkeleton, LoadingScreen } from "@/components/skeletons";

// Choosing a new password: the heading, the password twice, the button.// The Stamp beside the form is the sign-in pages' own life, so no page loader on top.
export default function ResetPasswordLoading() {
  return (
    <LoadingScreen loader={false} label="Loading password reset">
      <AuthFormSkeleton title="w-52" fields={2} />
    </LoadingScreen>
  );
}
