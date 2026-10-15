import { eq } from "drizzle-orm";
import { marketFor } from "@/config/markets";
import { type Database, type Executor, getDb } from "@/db";
import { recordAuditEvent } from "@/modules/audit";
import { assertCan, type OrgActor } from "@/modules/authz";
import { todayIn } from "@/shared/dates/calendar";
import {
  parseQuestionnaire,
  type QuestionnaireValue,
  questionnaireChanges,
  readQuestionnaire,
} from "../domain/questionnaire";
import { organizations, taxQuestionnaires } from "../schema";

/** The worksheet with the time it was last saved (null while the business has saved nothing). */
export type Questionnaire = QuestionnaireValue & { updatedAt: Date | null };

export type SaveQuestionnaireResult =
  | { ok: true; changed: string[]; /** What is now stored (blanks and dropped parts removed). */ value: QuestionnaireValue }
  | { ok: false; errors: Record<string, string> };

/** The business's RDO/CPA worksheet. Owners and admins only: it sits beside the tax details. */
export async function getQuestionnaire(actor: OrgActor, db: Database = getDb()): Promise<Questionnaire> {
  assertCan(actor, "organization.manage");
  const [org] = await db.select({ countryCode: organizations.countryCode }).from(organizations).where(eq(organizations.id, actor.organizationId));
  if (!org) throw new Error("Organization not found");
  const config = marketFor(org.countryCode).registration?.questionnaire;
  if (!config) return { facts: {}, questions: {}, updatedAt: null };

  const [row] = await db.select().from(taxQuestionnaires).where(eq(taxQuestionnaires.organizationId, actor.organizationId));
  if (!row) return { facts: {}, questions: {}, updatedAt: null };
  return { ...readQuestionnaire(config, row.facts, row.questions), updatedAt: row.updatedAt };
}

/**
 * Saves the whole worksheet. A save that changes nothing writes nothing. The
 * audit row names the codes that changed, never an answer, a note or a date.
 */
export async function saveQuestionnaire(
  actor: OrgActor,
  input: unknown,
  db: Database = getDb(),
  now: Date = new Date(),
): Promise<SaveQuestionnaireResult> {
  assertCan(actor, "organization.manage");

  return db.transaction(async (tx): Promise<SaveQuestionnaireResult> => {
    const [org] = await tx
      .select({ countryCode: organizations.countryCode, timezone: organizations.timezone })
      .from(organizations)
      .where(eq(organizations.id, actor.organizationId))
      .for("update");
    if (!org) throw new Error("Organization not found");

    const config = marketFor(org.countryCode).registration?.questionnaire;
    if (!config) return { ok: false, errors: { form: "The worksheet isn't available in your country yet." } };

    const parsed = parseQuestionnaire(config, input, { today: todayIn(org.timezone, now) });
    if (!parsed.ok) return parsed;

    const [row] = await tx.select().from(taxQuestionnaires).where(eq(taxQuestionnaires.organizationId, actor.organizationId));
    const before = row ? readQuestionnaire(config, row.facts, row.questions) : { facts: {}, questions: {} };
    const changed = questionnaireChanges(before, parsed.value);
    if (changed.length === 0) return { ok: true, changed, value: parsed.value };

    await tx
      .insert(taxQuestionnaires)
      .values({ organizationId: actor.organizationId, ...parsed.value, updatedBy: actor.userId })
      .onConflictDoUpdate({
        target: taxQuestionnaires.organizationId,
        set: { ...parsed.value, updatedBy: actor.userId, updatedAt: now },
      });
    await recordAuditEvent(tx, {
      action: "questionnaire.updated",
      actorType: "user",
      actorId: actor.userId,
      organizationId: actor.organizationId,
      entityType: "questionnaire",
      entityId: actor.organizationId,
      metadata: { changed },
    });
    return { ok: true, changed, value: parsed.value };
  });
}

/**
 * The worksheet as stored, for "Download your data" (D16): the fact and
 * question codes with what was written under them. Null when nothing was
 * saved. No ids beyond the business's own.
 */
export async function exportQuestionnaire(executor: Executor, organizationId: string) {
  const [row] = await executor
    .select({ facts: taxQuestionnaires.facts, questions: taxQuestionnaires.questions, updatedAt: taxQuestionnaires.updatedAt })
    .from(taxQuestionnaires)
    .where(eq(taxQuestionnaires.organizationId, organizationId));
  return row ?? null;
}
