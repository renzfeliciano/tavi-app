import { BrandMascot } from "@/components/brand/brand-mascot";

/** One calm page for a customer link that can't be shown (unknown, revoked, expired, rate-limited). */
export function PortalUnavailable({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto grid min-h-dvh max-w-md place-items-center px-4 py-12 text-center">
      <div className="grid justify-items-center gap-3">
        <BrandMascot expression="curious" size="lg" />
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-sm text-pretty text-muted-foreground">{body}</p>
      </div>
    </main>
  );
}

export const LINK_UNAVAILABLE = {
  title: "This link isn't available",
  body: "It may have expired or been replaced by a newer version. Ask the business to send you the latest link.",
};

export const TOO_MANY_REQUESTS = {
  title: "Too many requests",
  body: "Please wait a minute, then open the link again.",
};

/** Opens of customer links per IP per minute (§I). */
export const PORTAL_RATE_LIMIT = { windowSeconds: 60, max: 60 };
