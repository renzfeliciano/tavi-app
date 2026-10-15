import type { Route } from "next";
import Link from "next/link";
import { FileCheck2Icon, HandCoinsIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

/**
 * The Payments header's buttons: Receipts (money received that isn't an invoice payment) and, where the market has
 * withheld tax, Withholding. The loading skeleton draws the same number of buttons.
 */
export function PaymentsActions({ certificate }: { certificate: string | null }) {
  return (
    <>
      <Link href={"/receipts" as Route} className={buttonVariants({ variant: "outline" })}>
        <HandCoinsIcon aria-hidden="true" />
        Receipts
      </Link>
      {certificate && (
        <Link href={"/payments/withholding" as Route} className={buttonVariants({ variant: "outline" })}>
          <FileCheck2Icon aria-hidden="true" />
          Withholding ({certificate})
        </Link>
      )}
    </>
  );
}
