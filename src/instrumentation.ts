import type { Instrumentation } from "next";
import { isClientAbort } from "@/shared/errors/client-abort";
import { loggablePath } from "@/shared/http/loggable-path";
import { logger } from "@/shared/logger";
import { acceptRequestId } from "@/shared/security/headers";

/**
 * Every unhandled server error, logged once with enough context to find it
 * (§K). Deliberately not logged: headers (cookies), the query string
 * (password-reset tokens) and customer-link tokens in the path
 * (`loggablePath`). An error tracker (Sentry) plugs in here once its DSN
 * exists.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const requestId = request.headers["x-request-id"];
  const fields = {
    // API routes skip proxy.ts, so their header is still the client's own.
    requestId: acceptRequestId(Array.isArray(requestId) ? requestId[0] : requestId) ?? undefined,
    method: request.method,
    path: loggablePath(request.path),
    routePath: context.routePath,
  };
  // The browser left before the response finished: routine, so no error alert.
  if (isClientAbort(error)) {
    logger.info("request aborted by the client", fields);
    return;
  }
  logger.error("unhandled server error", {
    ...fields,
    routeType: context.routeType,
    digest:
      typeof error === "object" && error !== null && "digest" in error
        ? String((error as { digest: unknown }).digest)
        : undefined,
    error,
  });
};
