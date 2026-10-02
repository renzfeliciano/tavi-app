"use client";

import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";

/** Browser client for Better Auth's endpoints (same origin). */
export const authClient = createAuthClient({
  plugins: [
    // Mirrors `user.additionalFields` in src/modules/identity/infra/create-auth.ts,
    // so sign-up can send the terms version the person agreed to.
    inferAdditionalFields({
      user: {
        termsVersion: { type: "string", required: false, input: true },
        termsAcceptedAt: { type: "date", required: false, input: false },
      },
    }),
  ],
});
