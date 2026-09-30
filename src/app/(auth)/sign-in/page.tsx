import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthHeading } from "@/components/auth-shell";
import { getCurrentSession } from "@/modules/identity";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage() {
  if (await getCurrentSession()) redirect("/dashboard");
  return (
    <>
      <AuthHeading title="Sign in to Tavi" />
      <SignInForm />
    </>
  );
}
