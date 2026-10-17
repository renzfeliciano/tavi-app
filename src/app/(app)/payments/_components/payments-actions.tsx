import type { Route } from "next";
import Link from "next/link";
import { FileCheck2Icon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

/**
 * The Payments header's button: Withholding, where the market has withheld tax. The loading skeleton draws the same
 * number of buttons.
 */
export function PaymentsActions({ certificate }: { certificate: string | null }) {
  return (
    <>
      {certificate && (
        <Link href={"/payments/withholding" as Route} className={buttonVariants({ variant: "outline" })}>
          <FileCheck2Icon aria-hidden="true" />
          Withholding ({certificate})
        </Link>
      )}
    </>
  );
}
