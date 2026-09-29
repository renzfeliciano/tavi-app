import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/page-header";
import { SectionEmpty } from "@/components/app-shell/section-empty";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title={"Settings"} description={"Your business details, document defaults and team."} />
      <SectionEmpty
        title={"Settings are on the way"}
        description={"Business profile, logo, payment instructions and tax rates arrive with onboarding (Phase 1.1)."}
        expression="waiting"
      />
    </>
  );
}
