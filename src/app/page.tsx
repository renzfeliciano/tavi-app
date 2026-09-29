import { brand } from "@/config/brand";

// Temporary holding page while Phase 0 lays the foundation. Replaced by the
// real entry experience (sign-in / dashboard) in Phase 0.3–0.4.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
        {brand.wordmark}
      </h1>
      <p className="max-w-md text-lg text-pretty text-muted-foreground">
        {brand.taglines.primary}
      </p>
    </main>
  );
}
