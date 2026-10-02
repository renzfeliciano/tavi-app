import { AuthShell } from "@/components/auth-shell";
import { AuthFormSkeleton, LoadingScreen } from "@/components/skeletons";

// An invitation: the sheet of paper with who invited you, and the button to join.
export default function InvitationLoading() {
  return (
    <AuthShell>
      <LoadingScreen label="Loading invitation">
        <AuthFormSkeleton title="w-56" description={2} />
      </LoadingScreen>
    </AuthShell>
  );
}
