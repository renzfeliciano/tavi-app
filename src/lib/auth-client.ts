"use client";

import { createAuthClient } from "better-auth/react";

/** Browser client for Better Auth's endpoints (same origin). */
export const authClient = createAuthClient();
