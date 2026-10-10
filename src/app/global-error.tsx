"use client";

import { ErrorScreen } from "@/components/error-screen";
import "./globals.css";

// The last resort: the root layout itself failed, so this replaces it and has
// to bring its own <html>. No fonts or providers here, only the Stamp and a
// way back in.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground antialiased">
        <ErrorScreen error={error} retry={retry} variant="page" homeHref="/" />
      </body>
    </html>
  );
}
