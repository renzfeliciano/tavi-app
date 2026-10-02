import "server-only";
import { cookies, headers } from "next/headers";
import { getDb } from "@/db";
import { recordAuditEvent } from "@/modules/audit";
import { describeDevice } from "../domain/device";
import { getAuth } from "../infra/auth";
import {
  listActiveSessions,
  revokeOtherSessions,
  revokeSessionForUser,
} from "../infra/session-repository";
import { getCurrentSession, requireSession } from "./request-context";

export type DeviceSession = {
  id: string;
  device: string;
  lastActiveAt: Date;
  signedInAt: Date;
  current: boolean;
};

/** The signed-in user's devices, newest activity first. */
export async function listMyDevices(): Promise<DeviceSession[]> {
  const { user, session } = await requireSession();
  const rows = await listActiveSessions(user.id);
  return rows.map((row) => ({
    id: row.id,
    device: describeDevice(row.userAgent),
    lastActiveAt: row.lastActiveAt,
    signedInAt: row.createdAt,
    current: row.id === session.id,
  }));
}

/** Signs out one of the signed-in user's other devices. */
export async function signOutDevice(sessionId: string): Promise<boolean> {
  const { user, session } = await requireSession();
  if (sessionId === session.id) return false;
  const revoked = await revokeSessionForUser(user.id, sessionId);
  if (revoked) {
    await recordAuditEvent(getDb(), {
      action: "auth.session_revoked",
      actorType: "user",
      actorId: user.id,
      entityType: "session",
      entityId: sessionId,
    });
  }
  return revoked;
}

export async function signOutOtherDevices(): Promise<number> {
  const { user, session } = await requireSession();
  const count = await revokeOtherSessions(user.id, session.id);
  if (count > 0) {
    await recordAuditEvent(getDb(), {
      action: "auth.session_revoked",
      actorType: "user",
      actorId: user.id,
      entityType: "session",
      metadata: { scope: "all_other_devices", count },
    });
  }
  return count;
}

/** Ends this session and clears its cookie (via the nextCookies plugin). */
export async function signOutCurrentSession(): Promise<void> {
  const current = await getCurrentSession();
  await getAuth().api.signOut({ headers: await headers() });
  if (current) {
    await recordAuditEvent(getDb(), {
      action: "auth.signed_out",
      actorType: "user",
      actorId: current.user.id,
      entityType: "session",
      entityId: current.session.id,
    });
  }
}

/**
 * Drops this browser's sign-in cookies, for when the session itself is
 * already gone (the account was just closed). Better Auth names them with our
 * `tavi` prefix, plus `__Secure-` over HTTPS.
 */
export async function forgetSessionCookies(): Promise<void> {
  const jar = await cookies();
  for (const cookie of jar.getAll()) {
    if (/^(__Secure-)?tavi\./.test(cookie.name)) jar.delete(cookie.name);
  }
}
