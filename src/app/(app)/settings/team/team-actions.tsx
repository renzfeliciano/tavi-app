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
import { NativeSelect } from "@/components/ui/native-select";
import { ASSIGNABLE_ROLES, type AssignableRole, ROLE_LABELS } from "@/modules/organizations/client";
import {
  changeRoleAction,
  inviteMemberAction,
  leaveBusinessAction,
  removeMemberAction,
  revokeInvitationAction,
  transferOwnershipAction,
} from "./actions";

/** Admin ⇄ member, right in the row. Reversible, so no dialog: the toast says what changed. */
export function RoleSelect({ userId, name, role }: { userId: string; name: string; role: AssignableRole }) {
  const [pending, startTransition] = useTransition();
  return (
    <NativeSelect
      aria-label={`Role for ${name}`}
      value={role}
      disabled={pending}
      className="w-32"
      onChange={(event) => {
        const next = event.target.value;
        startTransition(async () => {
          const result = await changeRoleAction(userId, next);
          if (result.ok) toast.success(`${result.name} is now ${next === "admin" ? "an admin" : "a member"}.`);
          else toast.error(result.error);
        });
      }}
    >
      {ASSIGNABLE_ROLES.map((r) => (
        <option key={r} value={r}>
          {ROLE_LABELS[r]}
        </option>
      ))}
    </NativeSelect>
  );
}

function ConfirmButton({
  label,
  title,
  description,
  confirmLabel,
  pendingLabel,
  destructive,
  onConfirm,
}: {
  label: string;
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel: string;
  destructive?: boolean;
  onConfirm: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <Button type="button" variant="ghost" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Cancel</DialogClose>
            <Button
              type="button"
              variant={destructive ? "destructive" : "default"}
              pending={pending}
              pendingLabel={pendingLabel}
              onClick={() =>
                startTransition(async () => {
                  await onConfirm();
                  setOpen(false);
                })
              }
            >
              {confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function RemoveMemberButton({ userId, name, businessName }: { userId: string; name: string; businessName: string }) {
  return (
    <ConfirmButton
      label="Remove"
      title={`Remove ${name}?`}
      description={`${name} loses access to ${businessName} straight away. What they created stays. You can invite them again later.`}
      confirmLabel={`Remove ${name}`}
      pendingLabel="Removing…"
      destructive
      onConfirm={async () => {
        const result = await removeMemberAction(userId);
        if (result.ok) toast.success(`${result.name} removed from ${businessName}.`);
        else toast.error(result.error);
      }}
    />
  );
}

export function TransferOwnershipButton({ userId, name, businessName }: { userId: string; name: string; businessName: string }) {
  return (
    <ConfirmButton
      label="Make owner"
      title={`Make ${name} the owner?`}
      description={`${name} will own ${businessName}, and you'll become an admin. Only the new owner can undo this.`}
      confirmLabel={`Make ${name} the owner`}
      pendingLabel="Transferring…"
      onConfirm={async () => {
        const result = await transferOwnershipAction(userId);
        if (result.ok) toast.success(`${result.name} is now the owner of ${businessName}.`);
        else toast.error(result.error);
      }}
    />
  );
}

export function LeaveBusinessButton({ businessName }: { businessName: string }) {
  return (
    <ConfirmButton
      label="Leave"
      title={`Leave ${businessName}?`}
      description={`You'll lose access to ${businessName}. Someone in the team can invite you again.`}
      confirmLabel={`Leave ${businessName}`}
      pendingLabel="Leaving…"
      destructive
      onConfirm={async () => {
        // On success the action opens the dashboard of your next business.
        const result = await leaveBusinessAction();
        toast.error(result.error);
      }}
    />
  );
}

export function CancelInvitationButton({ invitationId, email }: { invitationId: string; email: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      pending={pending}
      pendingLabel="Cancelling…"
      onClick={() =>
        startTransition(async () => {
          const result = await revokeInvitationAction(invitationId);
          if (result.ok) toast.success(`Invitation to ${email} cancelled.`);
          else toast.error("Couldn't cancel the invitation. Reload the page and try again.");
        })
      }
    >
      Cancel invitation
    </Button>
  );
}

export function ResendInvitationButton({ email, role }: { email: string; role: AssignableRole }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      pending={pending}
      pendingLabel="Sending…"
      onClick={() =>
        startTransition(async () => {
          const result = await inviteMemberAction({ email, role });
          if (result.ok) toast.success(`Invitation sent again to ${email}.`);
          else toast.error("fieldErrors" in result ? (result.fieldErrors.email?.[0] ?? "Couldn't send it.") : result.error);
        })
      }
    >
      Send again
    </Button>
  );
}
