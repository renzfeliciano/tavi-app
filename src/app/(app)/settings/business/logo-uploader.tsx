"use client";

import { type ChangeEvent, useActionState, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { FormAlert } from "@/components/form-alert";
import { Button } from "@/components/ui/button";
import { type LogoState, removeLogo, uploadLogo } from "./actions";

const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPT = "image/png,image/jpeg,image/webp";

type Logo = { src: string; width: number; height: number };

export function LogoUploader({
  logo,
  businessName,
  editable,
}: {
  logo: Logo | null;
  businessName: string;
  editable: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [uploadState, upload, uploading] = useActionState<LogoState, FormData>(uploadLogo, {});
  const [removeState, remove, removing] = useActionState<LogoState, FormData>(removeLogo, {});

  useEffect(() => {
    if (uploadState.savedAt) toast.success("Logo updated.");
  }, [uploadState.savedAt]);
  useEffect(() => {
    if (removeState.savedAt) toast.success("Logo removed.");
  }, [removeState.savedAt]);

  function onFileChosen(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setClientError(null);
    if (!file) return;
    // Checked again on the server; this just saves a slow upload on mobile data.
    if (file.size > MAX_BYTES) {
      setClientError("That image is over 2 MB. Try a smaller one.");
      event.target.value = "";
      return;
    }
    formRef.current?.requestSubmit();
  }

  const error = clientError ?? (uploading ? null : uploadState.error) ?? removeState.error;

  return (
    <section aria-labelledby="logo-heading" className="rounded-xl border border-border bg-card shadow-xs">
      <header className="grid gap-0.5 border-b border-border px-5 py-4 sm:px-6">
        <h2 id="logo-heading" className="font-semibold">
          Logo
        </h2>
        <p className="text-sm text-pretty text-muted-foreground">
          Printed at the top of your quotes and billing statements.
        </p>
      </header>
      <div className="grid gap-4 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="grid h-24 w-full max-w-60 place-items-center rounded-lg border border-dashed border-border-strong bg-background p-3">
            {logo ? (
              <Image
                src={logo.src}
                alt={`${businessName} logo`}
                width={logo.width}
                height={logo.height}
                unoptimized
                className="max-h-full w-auto object-contain"
              />
            ) : (
              <span className="flex flex-col items-center gap-1 text-sm text-muted-foreground">
                <ImageIcon aria-hidden="true" className="size-5" />
                No logo yet
              </span>
            )}
          </div>
          {editable && (
            <div className="grid gap-2">
              <form ref={formRef} action={upload} className="flex flex-wrap gap-2">
                <input
                  ref={inputRef}
                  id="logo-file"
                  type="file"
                  name="logo"
                  accept={ACCEPT}
                  onChange={onFileChosen}
                  className="sr-only"
                  aria-label="Logo image"
                  aria-describedby="logo-hint"
                  tabIndex={-1}
                />
                <Button
                  type="button"
                  variant="outline"
                  pending={uploading}
                  pendingLabel="Uploading…"
                  onClick={() => inputRef.current?.click()}
                >
                  {logo ? "Replace logo" : "Upload logo"}
                </Button>
                {logo && (
                  <Button
                    type="submit"
                    formAction={remove}
                    variant="ghost"
                    pending={removing}
                    pendingLabel="Removing…"
                    disabled={uploading}
                  >
                    Remove
                  </Button>
                )}
              </form>
              <p id="logo-hint" className="text-sm text-muted-foreground">
                PNG, JPG or WebP, up to 2 MB. A transparent PNG looks best.
              </p>
            </div>
          )}
        </div>
        <FormAlert message={error} />
      </div>
    </section>
  );
}
