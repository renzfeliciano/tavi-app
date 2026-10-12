import type { Executor } from "@/db";
import { recordAuditEvent } from "@/modules/audit";
import type { OrgActor } from "@/modules/authz";

/**
 * One audit event for a withholding certificate. The metadata holds counts and
 * ids only: never the payor's TIN or name.
 */
export function auditCertificate(
  tx: Executor,
  actor: OrgActor,
  action:
    | "withholding_certificate.recorded"
    | "withholding_certificate.updated"
    | "withholding_certificate.voided"
    | "withholding_certificate.payment_unlinked",
  certificateId: string,
  metadata: Record<string, unknown>,
) {
  return recordAuditEvent(tx, {
    action,
    actorType: "user",
    actorId: actor.userId,
    organizationId: actor.organizationId,
    entityType: "withholding_certificate",
    entityId: certificateId,
    metadata,
  });
}
