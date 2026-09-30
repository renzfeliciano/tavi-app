import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeading } from "@/components/auth-shell";
import { buttonVariants } from "@/components/ui/button";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const { token, error } = await searchParams;

  if (typeof token !== "string" || token.length === 0 || error) {
    return (
      <>
        <AuthHeading
          title="This link has expired"
          description="Reset links work once and expire after 30 minutes. Request a new one and use it from the newest email."
        />
        <Link href="/forgot-password" className={buttonVariants({ size: "lg", className: "w-full" })}>
          Send a new link
        </Link>
      </>
    );
  }

  return (
    <>
      <AuthHeading title="Choose a new password" />
      <ResetPasswordForm token={token} />
    </>
  );
}
