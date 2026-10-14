"use client";

import { type ChangeEvent, useActionState, useEffect, useRef, useState } from "react";
import { FileImageIcon, FileTextIcon, LockIcon } from "lucide-react";
import { toast } from "sonner";
import { FormAlert } from "@/components/form-alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import { DOCUMENT_MESSAGES, MAX_UPLOAD_BYTES, MAX_UPLOAD_SIZE_LABEL, REGISTRATION_DOCUMENTS } from "@/modules/files/client";
import { type DocumentState, removeDocumentAction, uploadDocumentAction } from "./actions";

const ACCEPT = "application/pdf,image/png,image/jpeg,image/webp";

export type DocumentRow = {
  id: string;
  kind: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  /** Already formatted for the business's locale. */
  addedOn: string;
};

function size(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentsCard({
  documents,
  kinds,
  editable,
}: {
  documents: DocumentRow[];
  kinds: { code: string; label: string }[];
  editable: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  // A chosen file waits here until it's saved (a save moves `savedAt`, which ends the choice) or cancelled.
  const [pickedFile, setPickedFile] = useState<{ name: string; savedAtPick: number | undefined } | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [state, upload, uploading] = useActionState<DocumentState, FormData>(uploadDocumentAction, {});
  const [removing, setRemoving] = useState<DocumentRow | null>(null);
  const [removePending, setRemovePending] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const kindLabel = (code: string) => kinds.find((k) => k.code === code)?.label ?? code;
  const full = documents.length >= REGISTRATION_DOCUMENTS.maxPerBusiness;

  const picked = pickedFile && pickedFile.savedAtPick === state.savedAt ? pickedFile.name : null;

  useEffect(() => {
    if (state.savedAt) {
      toast.success("Document saved.");
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [state.savedAt]);

  function onChosen(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setClientError(null);
    if (!file) return setPickedFile(null);
    // The server checks the file's bytes; this only saves a slow upload on mobile data.
    if (file.size > MAX_UPLOAD_BYTES) {
      setClientError(DOCUMENT_MESSAGES.tooLarge);
      event.target.value = "";
      return setPickedFile(null);
    }
    setPickedFile({ name: file.name, savedAtPick: state.savedAt });
  }

  async function confirmRemove() {
    if (!removing) return;
    setRemovePending(true);
    const result = await removeDocumentAction(removing.id);
    setRemovePending(false);
    if (result.ok) {
      toast.success("Document removed.");
      setRemoving(null);
    } else setRemoveError(result.error);
  }

  const error = clientError ?? (uploading ? null : state.error);

  return (
    <section id="certificates" aria-labelledby="documents-heading" className="scroll-mt-20 rounded-xl border border-border bg-card shadow-xs">
      <header className="grid gap-0.5 border-b border-border px-5 py-4 sm:px-6">
        <h2 id="documents-heading" className="font-semibold">
          Certificates
        </h2>
        <p className="flex items-start gap-1.5 text-sm text-pretty text-muted-foreground">
          <LockIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          Keep your registration papers in one place. Only owners and admins can see them; customers never do.
        </p>
      </header>

      {documents.length > 0 ? (
        <ul className="divide-y divide-border">
          {documents.map((doc) => {
            const Icon = doc.contentType === "application/pdf" ? FileTextIcon : FileImageIcon;
            return (
              <li key={doc.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                <span className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-surface-sunken text-ink-subtle">
                  <Icon aria-hidden="true" className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{kindLabel(doc.kind)}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {doc.fileName} · {size(doc.byteSize)} · added {doc.addedOn}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <a
                    href={`/api/files/${doc.id}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${doc.fileName}`}
                    className={buttonVariants({ variant: "ghost", size: "sm" })}
                  >
                    Open
                  </a>
                  {editable && (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove ${doc.fileName}`}
                      onClick={() => {
                        setRemoveError(null);
                        setRemoving(doc);
                      }}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-5 py-5 text-sm text-muted-foreground sm:px-6">
          Nothing here yet. Add your Certificate of Registration and business name certificate so they&apos;re on hand when your
          RDO, a bank or a customer asks.
        </p>
      )}

      {editable && (
        <form action={upload} className="grid gap-3 border-t border-border px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label htmlFor="document-kind" className="sr-only">
              Kind of document
            </label>
            <div className="sm:w-72">
              <NativeSelect id="document-kind" name="kind" defaultValue={kinds[0]?.code} disabled={full}>
                {kinds.map((k) => (
                  <option key={k.code} value={k.code}>
                    {k.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <input
              ref={inputRef}
              id="document-file"
              type="file"
              name="file"
              accept={ACCEPT}
              onChange={onChosen}
              className="sr-only"
              aria-label="Document file"
              aria-describedby="document-hint"
              tabIndex={-1}
            />
            {picked ? (
              <>
                <Button type="submit" pending={uploading} pendingLabel="Saving…">
                  Save document
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={uploading}
                  onClick={() => {
                    setPickedFile(null);
                    if (inputRef.current) inputRef.current.value = "";
                  }}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button type="button" variant="outline" disabled={full} onClick={() => inputRef.current?.click()}>
                Choose file
              </Button>
            )}
          </div>
          <p id="document-hint" className="text-sm text-muted-foreground">
            {picked
              ? `${picked}: check the kind, then save.`
              : full
                ? DOCUMENT_MESSAGES.full
                : `PDF, PNG, JPG or WebP, up to ${MAX_UPLOAD_SIZE_LABEL}. Photos are shrunk and stripped of location data.`}
          </p>
          <FormAlert message={error} />
        </form>
      )}

      <Dialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <DialogContent mascot="concerned" tone="danger">
          <DialogHeader>
            <DialogTitle>Remove this document?</DialogTitle>
            <DialogDescription>
              {removing ? `${kindLabel(removing.kind)} (${removing.fileName}) is deleted for good.` : ""} Keep your own copy if you
              still need it.
            </DialogDescription>
          </DialogHeader>
          {removeError && (
            <DialogBody>
              <FormAlert message={removeError} />
            </DialogBody>
          )}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Keep it</DialogClose>
            <Button type="button" variant="destructive" pending={removePending} pendingLabel="Removing…" onClick={() => void confirmRemove()}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
