"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { cn } from "cn"

import { BrandMascot, type MascotExpression } from "@/components/brand/brand-mascot"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

// Every modal has the Stamp in its footer, beside the buttons (DESIGN.md,
// "Modals"). The face says what kind of moment it is: concerned for something
// hard to undo, curious for a form, happy for a send or approval, waiting for
// the idle warning. DialogContent sets it once and the footer reads it.
type DialogTone = "default" | "danger"
type DialogMood = { mascot: MascotExpression | null }
const DialogMoodContext = React.createContext<DialogMood>({ mascot: null })

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        // No backdrop blur: it makes the browser re-draw the whole page behind the card, which shows as a
        // blink when the modal closes. The fade runs as long as the card's, so the page never flashes bright.
        "fixed inset-0 isolate z-50 bg-black/10 dark:bg-black/50 duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 data-closed:duration-150 motion-reduce:animate-none motion-reduce:duration-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  mascot = "neutral",
  tone = "default",
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
  /** The Stamp's face in the footer; `null` leaves it out. */
  mascot?: MascotExpression | null
  /** `danger` marks something hard to undo: a red edge on the card. */
  tone?: DialogTone
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        data-tone={tone}
        className={cn(
          // A centred card from sm up; on phones a sheet that rises from the bottom edge.
          "fixed top-1/2 left-1/2 z-50 flex max-h-[92dvh] w-full flex-col max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-200 ease-out outline-none sm:max-w-sm",
          "max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-2xl",
          "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-closed:duration-150",
          "max-sm:data-open:slide-in-from-bottom-full max-sm:data-open:zoom-in-100 max-sm:data-closed:slide-out-to-bottom-full max-sm:data-closed:zoom-out-100",
          "motion-reduce:animate-none motion-reduce:duration-0",
          // Header and footer stay put; only DialogBody scrolls. A form around all three takes no box of its own.
          "[&>form]:contents",
          // Danger: a red edge along the top, so it reads as serious before a word is read.
          "data-[tone=danger]:before:absolute data-[tone=danger]:before:inset-x-0 data-[tone=danger]:before:top-0 data-[tone=danger]:before:h-1 data-[tone=danger]:before:bg-danger",
          className
        )}
        {...props}
      >
        <DialogMoodContext.Provider value={{ mascot }}>{children}</DialogMoodContext.Provider>
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-2 right-2"
                size="icon-sm"
              />
            }
          >
            <XIcon
            />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex shrink-0 flex-col gap-2", className)}
      {...props}
    />
  )
}

/**
 * The part of a modal that scrolls when the content is long, between the
 * header and footer, which stay in view. Extends to the card's edges so the
 * scrollbar sits there, and leaves room for focus rings.
 */
function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [needsFocus, setNeedsFocus] = React.useState(false)
  // Someone who can't use a pointer must be able to scroll what the body hides (WCAG 2.1.1).
  // A body that scrolls and holds nothing to tab to becomes a tab stop itself; one with fields
  // or links in it already has them, and keeps the first field as the first focus.
  React.useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === "undefined") return
    const check = () => setNeedsFocus(el.scrollHeight > el.clientHeight && !el.querySelector(FOCUSABLE))
    const sizes = new ResizeObserver(check)
    const content = new MutationObserver(check)
    sizes.observe(el)
    content.observe(el, { childList: true, subtree: true })
    return () => {
      sizes.disconnect()
      content.disconnect()
    }
  }, [])
  return (
    <div
      ref={ref}
      data-slot="dialog-body"
      tabIndex={needsFocus ? 0 : undefined}
      className={cn(
        "-mx-4 -my-1 min-h-0 flex-1 overflow-y-auto px-4 py-1 outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/35",
        className
      )}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  const { mascot } = React.useContext(DialogMoodContext)
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex shrink-0 flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 max-sm:pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      )}
      {mascot && (
        // Last in the markup, so first in the phone's reversed stack (top left, above the
        // buttons); from sm up it moves to the left end of the button row, facing them.
        <span data-slot="dialog-mascot" aria-hidden="true" className="max-sm:self-start sm:order-first sm:mr-auto">
          <BrandMascot expression={mascot} size="md" />
        </span>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-base leading-none font-medium",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
