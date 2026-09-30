"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { signOutDeviceAction, signOutOtherDevicesAction } from "./actions";

export function SignOutDeviceButton({ sessionId, device }: { sessionId: string; device: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      pending={pending}
      pendingLabel="Signing out…"
      onClick={() =>
        startTransition(async () => {
          const result = await signOutDeviceAction(sessionId);
          if (result.ok) toast.success(`Signed out ${device}.`);
          else toast.error(result.error);
        })
      }
    >
      Sign out
    </Button>
  );
}

/** Signing out several devices at once is confirmed first. */
export function SignOutOthersButton({ count }: { count: number }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const devices = count === 1 ? "1 other device" : `${count} other devices`;
  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        Sign out all other devices
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign out {devices}?</DialogTitle>
            <DialogDescription>
              Anyone using them will need your password to sign in again. This device stays signed in.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button
              type="button"
              pending={pending}
              pendingLabel="Signing out…"
              onClick={() =>
                startTransition(async () => {
                  const result = await signOutOtherDevicesAction();
                  setOpen(false);
                  if (result.ok) {
                    toast.success(
                      result.count === 1 ? "Signed out 1 other device." : `Signed out ${result.count} other devices.`,
                    );
                  } else {
                    toast.error(result.error);
                  }
                })
              }
            >
              Sign out {devices}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
