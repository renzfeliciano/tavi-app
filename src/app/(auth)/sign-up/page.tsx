import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthHeading } from "@/components/auth-shell";
import { brand } from "@/config/brand";
import { getCurrentSession } from "@/modules/identity";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignUpPage() {
  if (await getCurrentSession()) redirect("/dashboard");
  return (
    <>
      <AuthHeading
        title={`Create your ${brand.name} account`}
        description="Send your first quote in a few minutes. No card needed."
      />
      <SignUpForm />
    </>
  );
}
