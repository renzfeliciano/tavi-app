"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FormAlert } from "@/components/form-alert";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { ASSIGNABLE_ROLES, type AssignableRole, ROLE_DESCRIPTIONS, ROLE_LABELS, TEAM_LIMITS } from "@/modules/organizations/client";
import { inviteMemberAction } from "./actions";

type Errors = Partial<Record<"email" | "role", string>>;

/** Invite someone by email (users.manage). Keeps what was typed when something's wrong. */
export function InviteForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AssignableRole>("member");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="grid gap-4 sm:grid-cols-[1fr_12rem_auto] sm:items-start"
      onSubmit={(event) => {
        event.preventDefault();
        setErrors({});
        setFormError(null);
        startTransition(async () => {
          const result = await inviteMemberAction({ email, role });
          if (result.ok) {
            toast.success(result.resent ? `Invitation sent again to ${result.email}.` : `Invitation sent to ${result.email}.`);
            setEmail("");
            return;
          }
          if ("fieldErrors" in result) {
            setErrors({ email: result.fieldErrors.email?.[0], role: result.fieldErrors.role?.[0] });
          } else {
            setFormError(result.error);
          }
        });
      }}
    >
      <div className="sm:col-span-3">
        <FormAlert message={formError} />
      </div>
      <FormField name="email" id="invite-email" label="Email" error={errors.email}>
        {(p) => (
          <Input
            {...p}
            type="email"
            inputMode="email"
            autoComplete="off"
            maxLength={TEAM_LIMITS.email}
            placeholder="e.g. ana@santosaircon.ph"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
      </FormField>
      <FormField name="role" id="invite-role" label="Role" hint={ROLE_DESCRIPTIONS[role]} error={errors.role}>
        {(p) => (
          <NativeSelect {...p} value={role} onChange={(e) => setRole(e.target.value as AssignableRole)}>
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      <Button type="submit" pending={pending} pendingLabel="Sending…" className="sm:mt-6">
        Send invitation
      </Button>
    </form>
  );
}
