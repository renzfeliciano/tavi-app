"use server";

import { redirect } from "next/navigation";
import { signOutCurrentSession } from "@/modules/identity";

export async function signOut(): Promise<void> {
  await signOutCurrentSession();
  redirect("/sign-in");
}
