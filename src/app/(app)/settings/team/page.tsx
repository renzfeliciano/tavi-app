import type { Metadata } from "next";
import { MailIcon } from "lucide-react";
import { can } from "@/modules/authz";
import { requireOrgContext } from "@/modules/identity";
import { listTeam, ROLE_LABELS, TEAM_LIMITS } from "@/modules/organizations";
import { ReadOnlyNotice, SettingsPageHeader } from "../_components/settings-page-header";
import { InviteForm } from "./invite-form";
import {
  CancelInvitationButton,
  LeaveBusinessButton,
  RemoveMemberButton,
  ResendInvitationButton,
  RoleSelect,
  TransferOwnershipButton,
} from "./team-actions";

export const metadata: Metadata = { title: "Team" };

// Who works in the business, and inviting more people (Phase 2.1, D17).
export default async function TeamPage() {
  const ctx = await requireOrgContext();
  const { members, invitations } = await listTeam(ctx);
  const canManage = can(ctx, "users.manage");
  const canTransfer = can(ctx, "ownership.transfer");
  const date = new Intl.DateTimeFormat(ctx.locale, { dateStyle: "medium", timeZone: ctx.timezone });
  const used = members.length + invitations.filter((i) => i.state === "open").length;

  return (
    <>
      <SettingsPageHeader
        title="Team"
        description={`The people who work in ${ctx.organizationName}, and what each of them can do.`}
      />

      {canManage ? (
        <section
          aria-labelledby="invite-heading"
          className="mt-8 grid gap-4 rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6"
        >
          <div className="grid gap-1">
            <h2 id="invite-heading" className="font-semibold">
              Invite someone
            </h2>
            <p className="text-sm text-muted-foreground">
              They get an email with a link to join. {used} of {TEAM_LIMITS.maxPeople} places used.
            </p>
          </div>
          <InviteForm />
        </section>
      ) : (
        <ReadOnlyNotice />
      )}

      <section aria-labelledby="members-heading" className="mt-8">
        <h2 id="members-heading" className="mb-3 font-semibold">
          People
        </h2>
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          {members.map((m) => {
            const self = m.userId === ctx.userId;
            const assignable = m.role === "owner" ? null : m.role;
            const manageable = canManage && !self && assignable !== null;
            return (
              <li key={m.userId} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <span className="truncate font-medium">
                    {m.name}
                    {self && <span className="font-normal text-muted-foreground"> (you)</span>}
                  </span>
                  <span className="truncate text-sm text-muted-foreground">{m.email}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {manageable && assignable ? (
                    <RoleSelect userId={m.userId} name={m.name} role={assignable} />
                  ) : (
                    <span className="text-sm font-medium text-ink-subtle">{ROLE_LABELS[m.role]}</span>
                  )}
                  {canTransfer && !self && (
                    <TransferOwnershipButton userId={m.userId} name={m.name} businessName={ctx.organizationName} />
                  )}
                  {manageable && (
                    <RemoveMemberButton userId={m.userId} name={m.name} businessName={ctx.organizationName} />
                  )}
                  {self && m.role !== "owner" && <LeaveBusinessButton businessName={ctx.organizationName} />}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {invitations.length > 0 && (
        <section aria-labelledby="invitations-heading" className="mt-8">
          <h2 id="invitations-heading" className="mb-3 font-semibold">
            Invitations
          </h2>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            {invitations.map((i) => (
              <li key={i.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <MailIcon aria-hidden="true" className="mt-1 size-4 shrink-0 text-muted-foreground" />
                  <div className="grid min-w-0 gap-0.5">
                    <span className="truncate font-medium">{i.email}</span>
                    <span className="text-sm text-muted-foreground">
                      {ROLE_LABELS[i.role]} ·{" "}
                      {i.state === "open" ? `Expires ${date.format(i.expiresAt)}` : `Expired ${date.format(i.expiresAt)}`}
                    </span>
                  </div>
                </div>
                {canManage && (
                  <div className="flex flex-wrap gap-2">
                    {i.state === "expired" && <ResendInvitationButton email={i.email} role={i.role} />}
                    <CancelInvitationButton invitationId={i.id} email={i.email} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
