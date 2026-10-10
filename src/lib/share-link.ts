/**
 * Hand a customer link to the phone's own share sheet (Messenger, Viber, SMS)
 * where there is one, otherwise copy it. Free, no accounts, nothing sent
 * through Tavi. `outcome` says what happened so the caller can word its toast.
 */
export type ShareOutcome = "shared" | "copied" | "cancelled" | "manual";

type ShareInput = {
  title: string;
  text: string;
  /** Omit when `text` already contains the link (a ready-made message). */
  url?: string;
  /** What goes on the clipboard when there is no share sheet; the link, or the text, by default. */
  copyText?: string;
};

/** Only touch screens: on a desktop, "copy" is what people expect. */
function prefersShareSheet(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches
  );
}

export async function shareLink({ url, title, text, copyText }: ShareInput): Promise<ShareOutcome> {
  if (prefersShareSheet()) {
    try {
      await navigator.share(url ? { title, text, url } : { title, text });
      return "shared";
    } catch (error) {
      // Closing the sheet is not a failure, and not a reason to copy behind their back.
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    }
  }
  try {
    await navigator.clipboard.writeText(copyText ?? url ?? text);
    return "copied";
  } catch {
    return "manual";
  }
}
