import type { Metadata } from "next";
import { can } from "@/modules/authz";
import { getOrganizationLogo } from "@/modules/files";
import { requireOrgContext } from "@/modules/identity";
import { type BusinessProfile, getBusinessProfile } from "@/modules/organizations";
import { ReadOnlyNotice, SettingsPageHeader } from "../_components/settings-page-header";
import type { ProfileFormValues } from "./actions";
import { BusinessProfileForm } from "./business-profile-form";
import { LogoUploader } from "./logo-uploader";

export const metadata: Metadata = { title: "Business profile" };

function toFormValues(profile: BusinessProfile): ProfileFormValues {
  return Object.fromEntries(
    Object.entries(profile).map(([key, value]) => [key, value === null ? "" : String(value)]),
  ) as ProfileFormValues;
}

export default async function BusinessProfilePage() {
  const ctx = await requireOrgContext();
  const [profile, logo] = await Promise.all([getBusinessProfile(ctx), getOrganizationLogo(ctx)]);
  const editable = can(ctx, "organization.manage");

  return (
    <>
      <SettingsPageHeader
        title="Business profile"
        description="What your customers see on quotes and billing statements, and where new ones start from."
      />
      {!editable && <ReadOnlyNotice />}
      <div className="mt-8 grid max-w-3xl gap-8">
        <LogoUploader
          logo={logo && { src: `/api/files/${logo.id}`, width: logo.width, height: logo.height }}
          businessName={profile.name}
          editable={editable}
        />
        <BusinessProfileForm initialValues={toFormValues(profile)} editable={editable} />
      </div>
    </>
  );
}
