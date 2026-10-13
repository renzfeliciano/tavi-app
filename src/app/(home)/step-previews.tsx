import { CheckIcon, LinkIcon, MailIcon } from "lucide-react";
import { StampImprint } from "@/components/brand/stamp-imprint";
import { StatusBadge } from "@/components/status/status-badge";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/shared/money";
import { MAKE_LENGTH, PAY_STATIC, SEND_STATIC, makeScene, payScene, sendScene } from "./scenes";
import { SAMPLE_NUMBER } from "./sample-quotation";

// One small picture for each of the three steps: the quotation's rows, the two
// ways to send it, and a downpayment with the balance left. Made-up figures
// from the sample quotation, always light, and decoration only (the step's own
// words say the same thing), so they are hidden from screen readers.
//
// Each takes the tick of its scene (scenes.ts) and draws that moment: typing,
// a press, a count. Without a tick it draws the resting frame, the finished
// picture, which is what the page shows when nothing moves.

const SHEET = "relative grid gap-2.5 rounded-lg border border-border bg-card p-3 text-xs text-foreground shadow-sm";
const money = (minor: number) => formatMoney(minor, "PHP");
// The same grey as a real field's placeholder (WCAG AA needs 4.5:1; a 60% tint of it measured 2.56:1).
const PLACEHOLDER = "text-muted-foreground";

/** The text cursor, blinking (home.css). */
function Caret() {
  return <span aria-hidden="true" className="home-caret ml-px inline-block h-3 w-px translate-y-0.5 bg-foreground" />;
}

export function MakePreview({ tick = MAKE_LENGTH }: { tick?: number }) {
  const { rows, totalMinor } = makeScene(tick);
  return (
    <div data-theme="light" aria-hidden="true" className={SHEET}>
      {rows.map((row, index) => (
        <div key={index} className="flex min-h-5 items-baseline justify-between gap-3">
          <span className="truncate">
            {row.name || <span className={PLACEHOLDER}>Item</span>}
            {row.typing === "name" && <Caret />}
          </span>
          <span className="tabular-nums">
            {row.amount ?? <span className={PLACEHOLDER}>₱0.00</span>}
            {row.typing === "amount" && <Caret />}
          </span>
        </div>
      ))}
      <div className="flex items-baseline justify-between gap-3 border-t border-border-strong pt-2 font-semibold">
        <span>Total</span>
        <span className="tabular-nums">{money(totalMinor)}</span>
      </div>
    </div>
  );
}

export function SendPreview({ tick = SEND_STATIC }: { tick?: number }) {
  const scene = sendScene(tick);
  const chip = "relative inline-flex items-center justify-center gap-1.5 rounded-md border border-border py-2 font-medium motion-safe:transition-[transform,background-color,border-color] motion-safe:duration-(--duration-fast)";
  const pressed = "scale-95 border-border-strong bg-muted";
  return (
    <div data-theme="light" aria-hidden="true" className={SHEET}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono">{SAMPLE_NUMBER}</span>
        <StatusBadge kind="quote" status={scene.status} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <span className={cn(chip, scene.pressed === "email" && pressed)}>
          <MailIcon className="size-3.5" />
          Email it
          {/* The envelope that leaves when it is sent. */}
          {scene.flying && <MailIcon className="home-fly absolute top-1/2 left-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 text-info" />}
        </span>
        <span className={cn(chip, scene.pressed === "copy" && pressed, scene.copied && "border-success/40 text-success-strong")}>
          {scene.copied ? <CheckIcon className="size-3.5" strokeWidth={3} /> : <LinkIcon className="size-3.5" />}
          {scene.copied ? "Copied" : "Copy link"}
        </span>
      </div>
      <p key={scene.note} className="home-swap min-h-4 text-[0.7rem] text-muted-foreground">
        {scene.note === "emailed" ? "Emailed to Juan Dela Cruz" : scene.note === "copied" ? "Link copied, ready for a chat" : " "}
      </p>
    </div>
  );
}

export function PaidPreview({ tick = PAY_STATIC }: { tick?: number }) {
  const scene = payScene(tick);
  const chip = "inline-flex items-center justify-center rounded-md border border-border px-2.5 py-1.5 font-medium motion-safe:transition-[transform,background-color,border-color] motion-safe:duration-(--duration-fast)";
  return (
    <div data-theme="light" aria-hidden="true" className={SHEET}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium">Payment</span>
        <StatusBadge kind="invoice" status={scene.status} />
      </div>
      <div className="grid min-h-[2.9rem] content-start gap-2.5">
        {scene.payments.map((payment) => (
          <div key={payment.label} className="home-swap flex items-baseline justify-between gap-3">
            <span className="text-muted-foreground">{payment.label}</span>
            <span className="tabular-nums">{money(payment.amountMinor)}</span>
          </div>
        ))}
      </div>
      <div className="flex items-baseline justify-between gap-3 border-t border-border-strong pt-2 font-semibold">
        <span>Balance</span>
        <span className="tabular-nums">{money(scene.balanceMinor)}</span>
      </div>
      {/* Where the next payment is typed in and recorded; once everything is paid, the stamp takes its place. */}
      <div className="flex min-h-8 items-center gap-2">
        {scene.paidStamp ? (
          <StampImprint label="Paid" animated className="mx-auto scale-90" />
        ) : (
          <>
            <span className={cn("flex min-h-8 flex-1 items-center rounded-md border border-border px-2 tabular-nums", scene.field.active ? "border-stamp/60" : PLACEHOLDER)}>
              {scene.field.text ? <span className="text-foreground">{scene.field.text}</span> : "Amount"}
              {scene.field.active && <Caret />}
            </span>
            <span className={cn(chip, scene.pressed && "scale-95 border-border-strong bg-muted")}>Record</span>
          </>
        )}
      </div>
    </div>
  );
}
