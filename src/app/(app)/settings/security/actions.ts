"use server";

import { revalidatePath } from "next/cache";
import { signOutDevice, signOutOtherDevices } from "@/modules/identity";

export type SignOutResult = { ok: true; count: number } | { ok: false; error: string };

export async function signOutDeviceAction(sessionId: string): Promise<SignOutResult> {
  const signedOut = sessionId ? await signOutDevice(sessionId) : false;
  revalidatePath("/settings/security");
  return signedOut ? { ok: true, count: 1 } : { ok: false, error: "That device was already signed out." };
}

export async function signOutOtherDevicesAction(): Promise<SignOutResult> {
  const count = await signOutOtherDevices();
  revalidatePath("/settings/security");
  return { ok: true, count };
}
