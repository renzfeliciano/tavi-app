import "server-only";
import { headers } from "next/headers";
import { describeDevice } from "../domain/device";
import { getAuth } from "../infra/auth";
import {
  listActiveSessions,
  revokeOtherSessions,
  revokeSessionForUser,
} from "../infra/session-repository";
import { requireSession } from "./request-context";

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
  return revokeSessionForUser(user.id, sessionId);
}

export async function signOutOtherDevices(): Promise<number> {
  const { user, session } = await requireSession();
  return revokeOtherSessions(user.id, session.id);
}

/** Ends this session and clears its cookie (via the nextCookies plugin). */
export async function signOutCurrentSession(): Promise<void> {
  await getAuth().api.signOut({ headers: await headers() });
}
