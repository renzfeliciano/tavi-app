import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DashboardLoading from "@/app/(app)/dashboard/loading";

// Development-only: holds a real loading screen on the page so the page loader
// can be looked at (a real one is gone in a blink). The dashboard's skeleton
// with the loader on top, exactly as LoadingScreen renders it.

export const metadata: Metadata = {
  title: "Page loader preview",
  robots: { index: false, follow: false },
};

export default function LoaderPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <p className="mb-6 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        Development preview of the page loader. Below is the dashboard&apos;s real skeleton with the loader on top, held in place. The
        theme icon (top right) switches light and dark.
      </p>
      <DashboardLoading />
    </main>
  );
}
