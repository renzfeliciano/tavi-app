import type { Metadata } from "next";
import { FilePlus2Icon } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { SectionEmpty } from "@/components/app-shell/section-empty";

export const metadata: Metadata = { title: "Quotes" };

export default function QuotesPage() {
  return (
    <>
      <PageHeader title={"Quotes"} description={"Price out work, send it as a link, and get it approved."} />
      <SectionEmpty
        title={"No quotes yet"}
        description={"Quotes let customers approve work before you start. Send one as a link and they can approve it from their phone, no account needed."}
        action={{ href: "/quotes/new", label: "New quote", icon: FilePlus2Icon }}
      />
    </>
  );
}
