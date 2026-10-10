"use client";

import { ErrorScreen } from "@/components/error-screen";

// A failure before the app shell could render (for example in the signed-in
// layout itself), so there is no navigation to keep: show the whole screen.
export default function RootError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorScreen error={error} retry={retry} variant="page" />;
}
