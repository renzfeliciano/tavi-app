import { AuthFormSkeleton, LoadingScreen } from "@/components/skeletons";

// Sign up: the heading and promise, name, email and password, the terms box, the button, the sign-in line.// The Stamp beside the form is the sign-in pages' own life, so no page loader on top.
export default function SignUpLoading() {
  return (
    <LoadingScreen loader={false} label="Loading sign up">
      <AuthFormSkeleton title="w-60" description={2} fields={3} checkbox footer />
    </LoadingScreen>
  );
}
