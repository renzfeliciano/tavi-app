import { BellIcon, CheckIcon, EyeIcon } from "lucide-react";
import { StampImprint } from "@/components/brand/stamp-imprint";
import { Wordmark } from "@/components/brand/wordmark";
import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/shared/money";
import { SAMPLE_BUSINESS, SAMPLE_NUMBER, SAMPLE_TOTAL_MINOR } from "./sample-quotation";
import { EMAIL_STATIC, LINK_STATIC, PDF_STATIC, emailScene, linkScene, pdfScene } from "./scenes";

// Small pictures of what goes out of the app: the email a customer gets, the
// PDF, and the customer's own page. Made-up people and figures, like the sample
// quotation, and always light, like the documents and emails they stand for.
// They are decoration: the words beside each one say the same thing, so the
// pictures are hidden from screen readers.
//
// Each takes the tick of its scene (scenes.ts) and draws that moment: the email
// arriving a piece at a time and its button pressed, the page drawn and its
// payment code scanned, Approve tapped and stamped. Without a tick it draws the
// resting frame, which is what the page shows when nothing moves.

const SHEET = "rounded-lg border border-border bg-card p-4 text-foreground shadow-sm";
const money = (minor: number) => formatMoney(minor, "PHP");
const CUSTOMER = "Juan Dela Cruz";

/** A line that has not arrived yet. */
function Pending({ className }: { className?: string }) {
  return <span className={cn("block h-2 rounded-full bg-muted", className)} />;
}

/** A tap landing on a button: a ring that spreads and fades (home.css). */
function Tap() {
  return (
    <span className="pointer-events-none absolute inset-0 grid place-items-center">
      <span className="home-tap size-8 rounded-full bg-stamp/30" />
    </span>
  );
}

/** The email a customer gets with a link (notifications/domain/document-emails.ts says what is in it). */
export function EmailPreview({ documentName, tick = EMAIL_STATIC }: { documentName: string; tick?: number }) {
  const scene = emailScene(tick);
  const heading = `${documentName} ${SAMPLE_NUMBER}`;
  return (
    <div data-theme="light" aria-hidden="true" className={`${SHEET} grid gap-3 text-sm`}>
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 border-b border-border pb-3 text-xs">
        <dt className="text-muted-foreground">From</dt>
        <dd className="min-h-4 font-medium">
          {scene.header ? (
            <span className="home-swap block">
              {SAMPLE_BUSINESS} via {brand.name}
            </span>
          ) : (
            <Pending className="mt-1 w-3/4" />
          )}
        </dd>
        <dt className="text-muted-foreground">Subject</dt>
        <dd className="min-h-4 font-medium">
          {scene.header ? <span className="home-swap block">{`${heading} from ${SAMPLE_BUSINESS}`}</span> : <Pending className="mt-1 w-full" />}
        </dd>
      </dl>
      <div className="grid min-h-[4.5rem] content-start gap-3">
        {scene.body ? (
          <>
            <p className="home-swap">
              <strong className="font-semibold">{SAMPLE_BUSINESS}</strong> sent you {heading}.
            </p>
            <p className="home-swap text-muted-foreground">
              {heading}: {money(SAMPLE_TOTAL_MINOR)}
            </p>
          </>
        ) : (
          <>
            <Pending className="w-full" />
            <Pending className="w-2/3" />
          </>
        )}
      </div>
      <div className="flex min-h-9 items-center justify-between gap-2">
        {scene.button ? (
          <span
            className={cn(
              "home-swap relative w-fit rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground motion-safe:transition-transform motion-safe:duration-(--duration-fast)",
              scene.pressed && "scale-95",
            )}
          >
            View and approve
            {scene.pressed && <Tap />}
          </span>
        ) : (
          <Pending className="h-9 w-36 rounded-md" />
        )}
        {/* The customer has opened it. */}
        {scene.opened && (
          <span className="home-swap inline-flex shrink-0 items-center gap-1 rounded-full bg-success-subtle px-2 py-1 text-xs font-medium text-success-strong">
            <EyeIcon className="size-3" />
            Opened
          </span>
        )}
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        Sent with <Wordmark size={12} />
      </p>
    </div>
  );
}

const QR_CELLS = [0, 2, 3, 5, 6, 9, 10, 12, 15];

/** A page of the PDF: the letterhead, the rows, the payment code and the total, with a mark in the corner. */
export function PdfPreview({ documentName, tick = PDF_STATIC }: { documentName: string; tick?: number }) {
  const scene = pdfScene(tick);
  return (
    <div data-theme="light" aria-hidden="true" className={`${SHEET} relative mx-auto grid w-full max-w-60 gap-3`}>
      <span
        className={cn(
          "absolute -top-2 -right-2 inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[0.65rem] font-semibold tracking-wide motion-safe:transition-colors",
          scene.saved ? "bg-success text-white" : "bg-foreground text-background",
        )}
      >
        {scene.saved && <CheckIcon className="size-3" strokeWidth={3} />}
        {scene.saved ? "Saved" : "PDF"}
      </span>
      <div className="grid gap-0.5">
        <p className="text-xs font-semibold">{SAMPLE_BUSINESS}</p>
        <p className="text-[0.65rem] text-muted-foreground">{documentName}</p>
      </div>
      <div className="grid gap-2 border-t border-border pt-3">
        {["w-4/5", "w-3/5", "w-2/3"].map((width, index) => (
          <div key={width} className="flex min-h-1.5 items-center justify-between gap-3">
            {scene.lines > index && (
              <>
                <span className={`home-bar h-1.5 origin-left rounded-full bg-border-strong ${width}`} />
                <span className="home-bar h-1.5 w-8 origin-right rounded-full bg-border-strong" />
              </>
            )}
          </div>
        ))}
      </div>
      <div className="flex items-end justify-between gap-3 border-t border-border pt-3">
        <span className="relative size-10 shrink-0 overflow-hidden rounded-sm border border-border p-0.5">
          {scene.qr && (
            <span className="home-swap grid size-full grid-cols-4 gap-px">
              {Array.from({ length: 16 }, (_, i) => (
                <span key={i} className={QR_CELLS.includes(i) ? "bg-foreground" : "bg-transparent"} />
              ))}
            </span>
          )}
          {/* A phone's camera reading the code. */}
          {scene.scanning && <span className="home-scan absolute inset-x-0 top-0 h-px bg-stamp shadow-[0_0_6px_1px] shadow-stamp/60" />}
        </span>
        <span className="min-h-4 flex-1 pb-0.5 text-[0.65rem] font-medium text-stamp">
          {scene.scanning && <span className="home-swap block">Scan to pay</span>}
        </span>
        {scene.total ? <span className="home-swap text-xs font-semibold tabular-nums">{money(SAMPLE_TOTAL_MINOR)}</span> : <Pending className="mb-1 w-14" />}
      </div>
    </div>
  );
}

/** The customer's own page, on a phone: what they are looking at, the two things they can do, and the toast the business gets. */
export function LinkPreview({ documentName, tick = LINK_STATIC }: { documentName: string; tick?: number }) {
  const scene = linkScene(tick);
  return (
    <div data-theme="light" aria-hidden="true" className={`${SHEET} relative mx-auto grid w-full max-w-60 gap-3`}>
      <span className="mx-auto -mt-1.5 h-1 w-10 rounded-full bg-border" />
      <div className="grid gap-0.5">
        <p className="text-xs font-semibold">
          {documentName} from {SAMPLE_BUSINESS}
        </p>
        <p className="text-[0.65rem] text-muted-foreground">{SAMPLE_NUMBER}</p>
      </div>
      <p className="text-lg font-semibold tabular-nums">{money(SAMPLE_TOTAL_MINOR)}</p>
      <div className="grid min-h-[4.5rem] content-center">
        {scene.approved ? (
          <StampImprint label="Approved" animated className="mx-auto" />
        ) : (
          <div className="grid gap-2">
            <span
              className={cn(
                "relative rounded-md bg-primary py-2 text-center text-xs font-medium text-primary-foreground motion-safe:transition-transform motion-safe:duration-(--duration-fast)",
                scene.pressed && "scale-95",
              )}
            >
              Approve
              {scene.pressed && <Tap />}
            </span>
            <span className="rounded-md border border-border py-2 text-center text-xs font-medium">Decline</span>
          </div>
        )}
      </div>
      {/* What the business is told: it drops in over the foot of the page. */}
      {scene.told && (
        <span className="home-swap absolute inset-x-3 -bottom-3 flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1.5 text-[0.65rem] font-medium shadow-md">
          <BellIcon className="size-3 shrink-0 text-stamp" />
          {CUSTOMER} approved it
        </span>
      )}
    </div>
  );
}
