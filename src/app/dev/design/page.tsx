import type { ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InfoIcon, PlusIcon } from "lucide-react";
import { BrandMascot, MASCOT_EXPRESSIONS } from "@/components/brand/brand-mascot";
import { StampImprint } from "@/components/brand/stamp-imprint";
import { Wordmark } from "@/components/brand/wordmark";
import { DocumentNumber } from "@/components/document-number";
import { EmptyState } from "@/components/empty-state";
import { MoneyAmount } from "@/components/money-amount";
import { StatusBadge } from "@/components/status/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { INVOICE_STATUSES } from "@/modules/invoices";
import { QUOTE_STATUSES } from "@/modules/quotes";
import { PendingDemo, StampMomentDemo, ToastDemo } from "./interactive-demos";

// Development-only living reference for the Carbon Copy design system.
// DESIGN.md documents the rules; this page shows them rendered.

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false, follow: false },
};

const COLOR_TOKENS: { name: string; role: string }[] = [
  { name: "background", role: "Bond paper: the app canvas" },
  { name: "card", role: "The sheet: documents, panels, fields" },
  { name: "surface-sunken", role: "Recessed areas" },
  { name: "sidebar", role: "Navigation chrome" },
  { name: "foreground", role: "Blue-black ink: text" },
  { name: "ink-subtle", role: "Secondary ink" },
  { name: "muted-foreground", role: "Tertiary text, captions" },
  { name: "border", role: "Hairline rules" },
  { name: "border-strong", role: "Field outlines, emphasis rules" },
  { name: "stamp", role: "The one accent: stamp-pad violet" },
  { name: "stamp-subtle", role: "Selection, current step" },
  { name: "info", role: "Sent / viewed (carbon-copy blue)" },
  { name: "success", role: "Approved / paid" },
  { name: "warning", role: "Partially paid" },
  { name: "danger", role: "Overdue / declined / destructive" },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 border-t border-border pt-8">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default function DesignSystemPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-10 px-4 py-10 sm:px-6 lg:py-14">
      <header className="grid gap-3">
        <Wordmark size={28} />
        <h1 className="text-3xl font-semibold tracking-tight">Design system</h1>
        <p className="max-w-prose text-pretty text-muted-foreground">
          Carbon Copy: bond paper, blue-black ink, hairline rules and one accent,
          stamp-pad violet, used only where real ink would go. Development only.
        </p>
      </header>

      <Section title="Colour">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {COLOR_TOKENS.map((token) => (
            <li key={token.name} className="grid gap-1.5 text-xs">
              <span
                className="h-12 rounded-md border border-border"
                style={{ background: `var(--${token.name})` }}
              />
              <span className="font-mono text-foreground">{token.name}</span>
              <span className="text-muted-foreground">{token.role}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Type">
        <div className="grid gap-3">
          <p className="text-3xl font-semibold tracking-tight">Page title · 30</p>
          <p className="text-2xl font-semibold tracking-tight">Section title · 24</p>
          <p className="text-base font-semibold">Card heading · 16</p>
          <p className="text-sm">Body text in the app is 14px Geist. Public portals use 15–16px.</p>
          <p className="text-xs text-muted-foreground">Caption · 12</p>
          <p className="font-mono text-sm text-stamp">Nº QUO-000124 · Geist Mono for serials</p>
          <p className="text-2xl font-semibold tabular-nums">₱1,234,567.89 · €99.00 · ¥800</p>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-2">
          <Button>
            <PlusIcon aria-hidden="true" />
            New quote
          </Button>
          <Button variant="outline">Download PDF</Button>
          <Button variant="secondary">Save draft</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="destructive">Void invoice</Button>
          <Button variant="link">View history</Button>
          <Button disabled>Disabled</Button>
          <PendingDemo />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm">Small</Button>
          <Button>Default</Button>
          <Button size="lg">Large</Button>
        </div>
      </Section>

      <Section title="Form fields">
        <div className="grid max-w-md gap-5">
          <Field>
            <FieldLabel htmlFor="demo-name">
              Customer name <span className="text-danger" aria-hidden="true">*</span>
            </FieldLabel>
            <Input id="demo-name" placeholder="e.g. Dela Cruz Residence" required />
          </Field>
          <Field data-invalid="true">
            <FieldLabel htmlFor="demo-email">Email</FieldLabel>
            <Input
              id="demo-email"
              type="email"
              defaultValue="maria@"
              aria-invalid="true"
              aria-describedby="demo-email-error"
            />
            <FieldError id="demo-email-error">Enter a valid customer email.</FieldError>
          </Field>
          <Field>
            <FieldLabel htmlFor="demo-notes">Notes</FieldLabel>
            <Textarea id="demo-notes" placeholder="e.g. Includes parts and labour. Valid for 30 days." />
            <FieldDescription>Shown on the quote, below the totals.</FieldDescription>
          </Field>
        </div>
      </Section>

      <Section title="Status">
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            {QUOTE_STATUSES.map((status) => (
              <StatusBadge key={status} kind="quote" status={status} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {INVOICE_STATUSES.map((status) => (
              <StatusBadge key={status} kind="invoice" status={status} />
            ))}
          </div>
        </div>
      </Section>

      <Section title="Money and serials">
        <dl className="grid max-w-sm grid-cols-[1fr_auto] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="text-right"><MoneyAmount amountMinor={750_000} currency="PHP" /></dd>
          <dt className="text-muted-foreground">VAT 12% (included)</dt>
          <dd className="text-right"><MoneyAmount amountMinor={90_000} currency="PHP" /></dd>
          <dt className="font-semibold">Total</dt>
          <dd className="text-right text-lg font-semibold"><MoneyAmount amountMinor={840_000} currency="PHP" /></dd>
          <dt className="text-muted-foreground">Quote</dt>
          <dd className="text-right"><DocumentNumber number="QUO-000124" /></dd>
          <dt className="text-muted-foreground">Invoice (unissued)</dt>
          <dd className="text-right"><DocumentNumber number={null} /></dd>
        </dl>
      </Section>

      <Section title="Brand">
        <div className="flex flex-wrap items-end gap-8">
          <Wordmark size={40} />
          <Wordmark size={24} />
          <Wordmark size={16} />
        </div>
        <ul className="flex flex-wrap gap-6">
          {MASCOT_EXPRESSIONS.map((expression) => (
            <li key={expression} className="grid justify-items-center gap-2 text-xs text-muted-foreground">
              <BrandMascot expression={expression} size="lg" />
              {expression}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-end gap-4">
          {(["xs", "sm", "md", "lg", "xl"] as const).map((size) => (
            <BrandMascot key={size} size={size} />
          ))}
        </div>
        <div className="flex flex-wrap gap-6">
          <StampImprint label="Approved" date="30 Sep 2026" />
          <StampImprint label="Paid" date="30 Sep 2026" />
        </div>
        <StampMomentDemo />
      </Section>

      <Section title="Feedback">
        <Alert>
          <InfoIcon aria-hidden="true" />
          <AlertTitle>Add your business address</AlertTitle>
          <AlertDescription>Your quote will show it under your business name.</AlertDescription>
        </Alert>
        <ToastDemo />
        <div className="grid max-w-md gap-2" aria-hidden="true">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="rounded-xl border border-border bg-card shadow-xs">
          <EmptyState
            title="No customers yet"
            description="Add your first customer to start creating quotes."
            action={<Button><PlusIcon aria-hidden="true" />Add customer</Button>}
          />
        </div>
      </Section>
    </main>
  );
}
