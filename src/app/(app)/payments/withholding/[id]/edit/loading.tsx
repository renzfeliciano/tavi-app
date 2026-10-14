import { LoadingScreen, PageHeaderSkeleton } from "@/components/skeletons";
import { CertificateFormSkeleton } from "../../_components/certificate-form-skeleton";

// Editing a 2307: the way back, the header, then the form filled in.
export default function EditCertificateLoading() {
  return (
    <LoadingScreen label="Loading the form">
      <PageHeaderSkeleton back title="w-52" description="w-96" wraps="w-24" />
      <CertificateFormSkeleton />
    </LoadingScreen>
  );
}
