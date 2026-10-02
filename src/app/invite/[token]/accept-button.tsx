"use client";

import { useState, useTransition } from "react";
import { FormAlert } from "@/components/form-alert";
import { Button } from "@/components/ui/button";
import { acceptInvitationAction } from "./actions";

export function AcceptInvitationButton({ token, businessName }: { token: string; businessName: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="grid gap-4">
      <FormAlert message={error} />
      <Button
        type="button"
        size="lg"
        pending={pending}
        pendingLabel="Joining…"
        onClick={() =>
          startTransition(async () => {
            setError(null);
            // On success the action opens the business's dashboard.
            const result = await acceptInvitationAction(token);
            setError(result.error);
          })
        }
      >
        Join {businessName}
      </Button>
    </div>
  );
}
