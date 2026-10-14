import { CardSkeleton, LoadingScreen, PageHeaderSkeleton } from "@/components/skeletons";

// A certificate: the way back, the header with Edit and Void, then the payor, rows, payments and scan cards.
export default function CertificateLoading() {
  return (
    <LoadingScreen label="Loading the certificate">
      <PageHeaderSkeleton back title="w-72" description="w-56" actions={["w-20", "w-20"]} />
      <div className="mt-8 grid max-w-3xl gap-5">
        <CardSkeleton title="w-20" lines={4} />
        <CardSkeleton title="w-64" lines={5} />
        <CardSkeleton title="w-24" lines={3} />
        <CardSkeleton title="w-36" lines={2} />
      </div>
    </LoadingScreen>
  );
}
