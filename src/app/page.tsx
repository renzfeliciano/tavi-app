import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { brand } from "@/config/brand";

// Temporary public home until the marketing page is designed. Signed-in
// people use /dashboard; proxy.ts and the app layout route them there.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
        {brand.wordmark}
      </h1>
      <p className="max-w-md text-lg text-pretty text-muted-foreground">{brand.taglines.primary}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <Link href="/sign-up" className={buttonVariants({ size: "lg" })}>
          Create an account
        </Link>
        <Link href="/sign-in" className={buttonVariants({ size: "lg", variant: "outline" })}>
          Sign in
        </Link>
      </div>
    </main>
  );
}
