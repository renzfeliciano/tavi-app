"use server";

import { revalidatePath } from "next/cache";
import { signOutDevice, signOutOtherDevices } from "@/modules/identity";

export async function signOutDeviceAction(formData: FormData): Promise<void> {
  const sessionId = String(formData.get("sessionId") ?? "");
  if (sessionId) await signOutDevice(sessionId);
  revalidatePath("/settings/security");
}

export async function signOutOtherDevicesAction(): Promise<void> {
  await signOutOtherDevices();
  revalidatePath("/settings/security");
}
