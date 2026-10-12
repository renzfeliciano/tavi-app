import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ModalGallery } from "./gallery";
import { isSampleId } from "./sample-list";

// Development-only: one sample of every kind of modal, drawn by the real
// Dialog, so what is seen here is what ships. `?sample=danger` opens one on
// load (the E2E screenshots use it).

export const metadata: Metadata = {
  title: "Modal samples",
  robots: { index: false, follow: false },
};

export default async function ModalSamplesPage({
  searchParams,
}: {
  searchParams: Promise<{ sample?: string | string[] }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { sample } = await searchParams;
  const first = Array.isArray(sample) ? sample[0] : sample;
  return <ModalGallery initial={isSampleId(first) ? first : null} />;
}
