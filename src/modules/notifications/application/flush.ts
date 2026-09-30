import "server-only";
import { after } from "next/server";
import { logger } from "@/shared/logger";
import { dispatchOutbox } from "./outbox";

/**
 * Sends queued emails right after the response is sent, so "Quote sent" is
 * instant for the user and delivery still happens within seconds. The cron
 * route retries anything this misses.
 */
export function flushOutboxAfterResponse(): void {
  after(async () => {
    try {
      await dispatchOutbox();
    } catch (error) {
      logger.error("outbox flush failed", { error });
    }
  });
}
