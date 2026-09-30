import { toNextJsHandler } from "better-auth/next-js";
import { authHandler } from "@/modules/identity";

// Better Auth's HTTP endpoints (/api/auth/*). Sign-in and sign-up go through
// here, rather than server actions, so its rate limiting applies.
export const GET = (request: Request) => toNextJsHandler(authHandler()).GET(request);
export const POST = (request: Request) => toNextJsHandler(authHandler()).POST(request);
