import { sql } from "drizzle-orm";
import type { Executor } from "@/db";
import {
  DEFAULT_NUMBERING,
  type DocumentKind,
  formatDocumentNumber,
} from "../domain/numbering";
import { documentSequences } from "../schema";

export type AllocatedNumber = { value: number; number: string };

/**
 * Allocates the next document number for an organization in one atomic
 * statement: creates the sequence on first use, otherwise increments it.
 *
 * Call it with the transaction that issues the document. The row lock
 * serializes concurrent issuers, and if the transaction rolls back, the
 * increment rolls back with it, so numbers stay gapless (§B.6). Never derive
 * numbers from `count(*) + 1`.
 */
export async function allocateDocumentNumber(
  executor: Executor,
  organizationId: string,
  kind: DocumentKind,
): Promise<AllocatedNumber> {
  const defaults = DEFAULT_NUMBERING[kind];

  const [row] = await executor
    .insert(documentSequences)
    .values({
      organizationId,
      kind,
      prefix: defaults.prefix,
      padding: defaults.padding,
      // The first allocation takes 1; the row stores the *next* value.
      nextValue: 2,
    })
    .onConflictDoUpdate({
      target: [documentSequences.organizationId, documentSequences.kind],
      set: {
        nextValue: sql`${documentSequences.nextValue} + 1`,
        updatedAt: sql`now()`,
      },
    })
    .returning({
      nextValue: documentSequences.nextValue,
      prefix: documentSequences.prefix,
      padding: documentSequences.padding,
    });

  if (!row) throw new Error("Document number allocation returned no row");

  const value = row.nextValue - 1;
  return { value, number: formatDocumentNumber(row, value) };
}
