import { AuthFormSkeleton, LoadingScreen } from "@/components/skeletons";

// Choosing a new password: the heading, the password twice, the button.
export default function ResetPasswordLoading() {
  return (
    <LoadingScreen label="Loading password reset">
      <AuthFormSkeleton title="w-52" fields={2} />
    </LoadingScreen>
  );
}
