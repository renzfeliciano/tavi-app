// The audit vocabulary (docs/foundation-proposal.md §39). One place, so the
// activity feed and reports can rely on it. Phase 1 adds quote, invoice and
// payment actions.
export const AUDIT_ACTIONS = [
  "auth.signed_up",
  "auth.signed_in",
  "auth.signed_out",
  "auth.password_reset",
  "auth.session_revoked",
  "auth.terms_accepted",
  "auth.account_closed",
  "organization.created",
  "organization.updated",
  "organization.logo_updated",
  "organization.logo_removed",
  "organization.exported",
  "organization.closed",
  "team.invited",
  "team.invitation_revoked",
  "team.invitation_accepted",
  "team.role_changed",
  "team.member_removed",
  "team.member_left",
  "team.ownership_transferred",
  "tax_rate.created",
  "tax_rate.updated",
  "tax_rate.archived",
  "tax_rate.restored",
  "tax_rate.default_changed",
  "numbering.updated",
  "customer.created",
  "customer.updated",
  "customer.archived",
  "customer.restored",
  "product.created",
  "product.updated",
  "product.archived",
  "product.restored",
  "service.created",
  "service.updated",
  "service.archived",
  "service.restored",
  "quote.created",
  "quote.deleted",
  "quote.sent",
  "quote.revised",
  "quote.cancelled",
  "quote.link_created",
  "quote.viewed",
  "quote.approved",
  "quote.rejected",
  "quote.expired",
  "quote.converted",
  "invoice.created",
  "invoice.deleted",
  "invoice.sent",
  "invoice.link_created",
  "invoice.viewed",
  "invoice.edited",
  "invoice.voided",
  "invoice.cancelled",
  "invoice.overdue",
  "invoice.registration_saved",
  "invoice.registration_turned_off",
  "payment.recorded",
  "payment.voided",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_ACTOR_TYPES = ["user", "customer", "system"] as const;
export type AuditActorType = (typeof AUDIT_ACTOR_TYPES)[number];

export type AuditEventInput = {
  action: AuditAction;
  actorType: AuditActorType;
  /** The user (or other actor) who did it, when known. */
  actorId?: string | null;
  /** The tenant, when the action belongs to one. */
  organizationId?: string | null;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
};
