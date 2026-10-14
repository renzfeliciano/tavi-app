"use client";

import { type ChangeEvent, useActionState, useEffect, useRef, useState } from "react";
import { ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { BusinessLogo } from "@/components/document/business-logo";
import { FormAlert } from "@/components/form-alert";
import { Button } from "@/components/ui/button";
import {
  ACCEPTED_IMAGE_NAMES,
  ACCEPTED_IMAGES,
  LOGO_BOXES,
  logoLooksExtreme,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_SIZE_LABEL,
  UPLOAD_MESSAGES,
} from "@/modules/files/client";
import { type LogoState, removeLogo, uploadLogo } from "./actions";

const ACCEPT = ACCEPTED_IMAGES.map((i) => i.type).join(",");
const ACCEPTED_TYPES: readonly string[] = ACCEPTED_IMAGES.map((i) => i.type);
const UNREADABLE = "We couldn't read that image. Try saving it again as a PNG or JPG.";

type Logo = { src: string; width: number; height: number };

export function LogoUploader({
  logo,
  businessName,
  description,
  editable,
}: {
  logo: Logo | null;
  businessName: string;
  description: string;
  editable: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  // A chosen file waits here, previewed, until the person saves it (or cancels).
  const [picked, setPicked] = useState<(Logo & { savedAtPick: number | undefined }) | null>(null);
  const [uploadState, upload, uploading] = useActionState<LogoState, FormData>(uploadLogo, {});
  const [removeState, remove, removing] = useActionState<LogoState, FormData>(removeLogo, {});
  // A save moves `savedAt`, which ends the pending choice without an effect.
  const chosen = picked && picked.savedAtPick === uploadState.savedAt ? picked : null;

  const chosenUrl = picked?.src;
  useEffect(() => {
    // Frees the preview's blob when it is replaced, cancelled, saved or the page closes.
    return () => {
      if (chosenUrl) URL.revokeObjectURL(chosenUrl);
    };
  }, [chosenUrl]);

  useEffect(() => {
    if (uploadState.savedAt) {
      toast.success("Logo updated.");
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [uploadState.savedAt]);
  useEffect(() => {
    if (removeState.savedAt) toast.success("Logo removed.");
  }, [removeState.savedAt]);

  function reset() {
    setPicked(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function onFileChosen(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setClientError(null);
    if (!file) return;
    // Checked again on the server (by the file's bytes); this just saves a slow upload on mobile data.
    if (file.size > MAX_UPLOAD_BYTES) {
      setClientError(UPLOAD_MESSAGES.tooLarge);
      reset();
      return;
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setClientError(UPLOAD_MESSAGES.wrongType);
      reset();
      return;
    }
    const src = URL.createObjectURL(file);
    const probe = new window.Image();
    probe.onload = () =>
      setPicked({ src, width: probe.naturalWidth, height: probe.naturalHeight, savedAtPick: uploadState.savedAt });
    probe.onerror = () => {
      URL.revokeObjectURL(src);
      setClientError(UNREADABLE);
      reset();
    };
    probe.src = src;
  }

  const error = clientError ?? (uploading ? null : uploadState.error) ?? removeState.error;
  const shown = chosen ?? logo;
  const extreme = shown ? logoLooksExtreme(shown) : false;

  return (
    <section id="logo" aria-labelledby="logo-heading" className="scroll-mt-20 rounded-xl border border-border bg-card shadow-xs">
      <header className="grid gap-0.5 border-b border-border px-5 py-4 sm:px-6">
        <h2 id="logo-heading" className="font-semibold">
          Logo
        </h2>
        <p className="text-sm text-pretty text-muted-foreground">{description}</p>
      </header>
      <div className="grid gap-4 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          {/* The preview is a letterhead-sized window: the logo is fitted into the same box the documents use. */}
          <div
            data-testid="logo-preview"
            className="grid min-h-24 w-full max-w-60 min-w-0 place-items-center overflow-hidden rounded-lg border border-dashed border-border-strong bg-background p-3"
          >
            {shown ? (
              <BusinessLogo logo={shown} name={businessName} box={LOGO_BOXES.document} className="object-center" />
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
                {chosen ? (
                  <>
                    <Button type="submit" pending={uploading} pendingLabel="Saving…">
                      Save logo
                    </Button>
                    <Button type="button" variant="ghost" disabled={uploading} onClick={reset}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button type="button" variant="outline" disabled={removing} onClick={() => inputRef.current?.click()}>
                      {logo ? "Replace logo" : "Upload logo"}
                    </Button>
                    {logo && (
                      <Button
                        type="submit"
                        formAction={remove}
                        variant="ghost"
                        pending={removing}
                        pendingLabel="Removing…"
                      >
                        Remove
                      </Button>
                    )}
                  </>
                )}
              </form>
              <p id="logo-hint" className="text-sm text-muted-foreground">
                {ACCEPTED_IMAGE_NAMES}, up to {MAX_UPLOAD_SIZE_LABEL}. A transparent PNG looks best.
                {chosen && " Check the preview, then save."}
              </p>
              {extreme && (
                <p role="status" className="text-sm text-warning-strong">
                  This logo is very {shown && shown.width > shown.height ? "wide" : "tall"}, so it will print small. A
                  squarer version fits your documents better.
                </p>
              )}
            </div>
          )}
        </div>
        <FormAlert message={error} />
      </div>
    </section>
  );
}
