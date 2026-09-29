import type { Metadata } from "next";
import { UserPlusIcon } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { SectionEmpty } from "@/components/app-shell/section-empty";

export const metadata: Metadata = { title: "Customers" };

export default function CustomersPage() {
  return (
    <>
      <PageHeader title={"Customers"} description={"The people and businesses you work for."} />
      <SectionEmpty
        title={"No customers yet"}
        description={"Add your first customer to start creating quotes. Their details fill in automatically on every document."}
        action={{ href: "/customers/new", label: "Add customer", icon: UserPlusIcon }}
      />
    </>
  );
}
