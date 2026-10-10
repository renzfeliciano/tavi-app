"use client";

import { LogOutIcon } from "lucide-react";
import { useTransition } from "react";
import { createPortal } from "react-dom";
import { BrandMascot } from "@/components/brand/brand-mascot";
import { StampImprint } from "@/components/brand/stamp-imprint";
import { Button } from "@/components/ui/button";
import { firstName } from "@/lib/welcome-greeting";

/**
 * Sign out with a short goodbye (D22). The overlay appears the moment the
 * button is pressed and lasts exactly as long as signing out takes: nothing is
 * delayed for the animation, and the redirect to sign-in ends it.
 */
export function SignOutButton({ action, userName }: { action: () => Promise<void>; userName: string }) {
  const [pending, startTransition] = useTransition();
  const name = firstName(userName);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full justify-center"
        disabled={pending}
        onClick={() => startTransition(() => action())}
      >
        <LogOutIcon aria-hidden="true" />
        Sign out
      </Button>
      {pending &&
        createPortal(
          <div
            role="status"
            className="farewell fixed inset-0 z-[60] grid place-items-center bg-background/85 backdrop-blur-sm"
          >
            <div className="grid justify-items-center gap-4 text-center">
              <div className="relative">
                <BrandMascot expression="happy" size="xl" animated />
                <StampImprint label="Signed out" animated className="absolute -right-24 bottom-3" />
              </div>
              <div className="grid gap-1">
                <p className="text-lg font-semibold tracking-tight">{name ? `See you soon, ${name}.` : "See you soon."}</p>
                <p className="text-sm text-muted-foreground">Signing you out and closing your session.</p>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
