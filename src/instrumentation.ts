import type { Instrumentation } from "next";
import { isClientAbort } from "@/shared/errors/client-abort";
import { logger } from "@/shared/logger";

/**
 * Every unhandled server error, logged once with enough context to find it
 * (§K). Deliberately not logged: headers (cookies) and the query string
 * (password-reset and portal tokens). An error tracker (Sentry) plugs in here
 * once its DSN exists.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const requestId = request.headers["x-request-id"];
  const fields = {
    requestId: Array.isArray(requestId) ? requestId[0] : requestId,
    method: request.method,
    path: request.path.split("?")[0],
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
