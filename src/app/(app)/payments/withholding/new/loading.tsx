import { LoadingScreen, PageHeaderSkeleton } from "@/components/skeletons";
import { CertificateFormSkeleton } from "../_components/certificate-form-skeleton";

// Recording a 2307: the way back, the header, then the form.
export default function NewCertificateLoading() {
  return (
    <LoadingScreen label="Loading the form">
      <PageHeaderSkeleton back title="w-52" description="w-96" wraps="w-24" />
      <CertificateFormSkeleton />
    </LoadingScreen>
  );
}
