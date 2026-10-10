"use client";

import { ErrorScreen } from "@/components/error-screen";

// Something failed while loading an app page. Human copy and a retry (§28);
// the server already logged the details under the request ID. The shell and
// navigation stay, so the person can also just go elsewhere.
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="mt-8">
      <ErrorScreen error={error} retry={retry} variant="inline" homeHref="/dashboard" />
    </div>
  );
}
