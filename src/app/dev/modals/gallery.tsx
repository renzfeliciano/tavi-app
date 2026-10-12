"use client";

import { useState } from "react";
import { BrandMascot } from "@/components/brand/brand-mascot";
import { ThemeMenu } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { SAMPLES, type SampleId } from "./sample-list";
import { SampleModal } from "./samples";

export function ModalGallery({ initial }: { initial: SampleId | null }) {
  const [openId, setOpenId] = useState<SampleId | null>(initial);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:py-14">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div className="grid gap-2">
          <h1 className="font-heading text-3xl font-medium">Modal samples</h1>
          <p className="max-w-2xl text-pretty text-muted-foreground">
            Development preview. Each card opens the real dialog with sample copy, so what you see is what ships. Use the theme
            menu for light and dark. Below 640px wide (a phone, or the browser&apos;s device mode) every modal becomes a
            bottom sheet.
          </p>
        </div>
        <ThemeMenu />
      </header>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SAMPLES.map((sample) => (
          <li key={sample.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <BrandMascot expression={sample.mascot} size="md" follow={false} idle={false} />
              <h2 className="font-heading text-base font-medium">{sample.title}</h2>
            </div>
            <p className="text-sm text-pretty text-muted-foreground">{sample.when}</p>
            <Button type="button" variant="outline" className="mt-auto self-start" onClick={() => setOpenId(sample.id)}>
              Open
            </Button>
          </li>
        ))}
      </ul>
      {SAMPLES.map((sample) => (
        <SampleModal
          key={sample.id}
          id={sample.id}
          open={openId === sample.id}
          onOpenChange={(open) => setOpenId(open ? sample.id : null)}
        />
      ))}
    </main>
  );
}
