import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  closeTestDb,
  createTestOrganization,
  createTestUser,
  listAllAuditEvents,
  resetTables,
  testDb,
} from "@/db/testing";
import { ForbiddenError, type OrgActor, type Role } from "@/modules/authz";
import { updateBusinessProfile } from "./business-profile";
import { getBusinessRegistration, updateBusinessRegistration } from "./registration";

const complete = {
  taxpayerType: "sole_proprietor",
  incomeTaxOption: "graduated",
  taxOfficeCode: "044",
  taxRegisteredOn: "2026-01-15",
  lineOfBusiness: "Auto repair shop",
  industryCode: "45209",
  nameRegistrationAuthority: "dti",
  nameRegistrationNumber: "7397983",
  nameRegistrationScope: "national",
  nameRegistrationValidFrom: "2025-08-24",
  nameRegistrationValidUntil: "2030-08-24",
};

async function actorFor(role: Role = "owner", org: Parameters<typeof createTestOrganization>[1] = {}): Promise<OrgActor> {
  const organization = await createTestOrganization(testDb(), org);
  const user = await createTestUser(testDb(), { email: `${crypto.randomUUID()}@example.com` });
  return { organizationId: organization.id, userId: user.id, role };
}

beforeEach(async () => {
  await resetTables();
});
afterAll(async () => {
  await closeTestDb();
});

describe("business registration details", () => {
  it("starts empty", async () => {
    const actor = await actorFor();
    expect(await getBusinessRegistration(actor, testDb())).toMatchObject({ taxpayerType: null, nameRegistrationNumber: null });
  });

  it("saves the details, and audits which fields changed but not their values", async () => {
    const actor = await actorFor("owner", { taxRegistration: "vat", taxId: "618-327-286-00000" });

    expect(await updateBusinessRegistration(actor, complete, testDb())).toEqual({ ok: true });

    expect(await getBusinessRegistration(actor, testDb())).toMatchObject({
      ...complete,
      taxId: "618-327-286-00000",
      taxRegistration: "vat",
    });
    const events = await listAllAuditEvents(testDb());
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ action: "organization.updated", entityId: actor.organizationId });
    const changed = (events[0]?.metadata as { changed: string[] }).changed;
    expect(changed).toContain("nameRegistrationNumber");
    expect(JSON.stringify(events[0]?.metadata)).not.toContain("7397983");
  });

  it("doesn't audit a save that changes nothing", async () => {
    const actor = await actorFor();
    await updateBusinessRegistration(actor, complete, testDb());
    await updateBusinessRegistration(actor, complete, testDb());
    expect(await listAllAuditEvents(testDb())).toHaveLength(1);
  });

  it("returns field errors and saves nothing when something is wrong", async () => {
    const actor = await actorFor();
    const result = await updateBusinessRegistration(actor, { ...complete, taxOfficeCode: "44" }, testDb());
    expect(result).toMatchObject({ ok: false, errors: { taxOfficeCode: expect.any(String) } });
    expect(await getBusinessRegistration(actor, testDb())).toMatchObject({ taxOfficeCode: null });
  });

  it("clears a field that is sent blank", async () => {
    const actor = await actorFor();
    await updateBusinessRegistration(actor, complete, testDb());
    await updateBusinessRegistration(actor, { ...complete, lineOfBusiness: "" }, testDb());
    expect(await getBusinessRegistration(actor, testDb())).toMatchObject({ lineOfBusiness: null });
  });

  it("uses the business's own date for 'registered on'", async () => {
    const actor = await actorFor();
    const now = new Date("2026-10-12T00:00:00Z");
    expect(await updateBusinessRegistration(actor, { taxRegisteredOn: "2026-10-12" }, testDb(), now)).toEqual({ ok: true });
    expect(await updateBusinessRegistration(actor, { taxRegisteredOn: "2026-10-14" }, testDb(), now)).toMatchObject({ ok: false });
  });

  it("refuses the 8% option beside percentage tax, and a profile change that would clash with it", async () => {
    const actor = await actorFor("owner", { taxRegistration: "non_vat_exempt" });
    const eight = { taxpayerType: "sole_proprietor", incomeTaxOption: "eight_percent" };
    expect(await updateBusinessRegistration(actor, eight, testDb())).toEqual({ ok: true });

    const profile = {
      name: "Acme", legalName: "", taxId: "", taxRegistration: "non_vat", email: "", phone: "",
      addressLine1: "", addressLine2: "", city: "", region: "", postalCode: "", currency: "PHP",
      taxMode: "inclusive", quoteValidityDays: "30", paymentTermsDays: "15",
      defaultNotes: "", defaultTerms: "", paymentInstructions: "",
    };
    expect(await updateBusinessProfile(actor, profile, testDb())).toMatchObject({
      ok: false,
      fieldErrors: { taxRegistration: [expect.stringContaining("8%")] },
    });
    expect(await updateBusinessProfile(actor, { ...profile, taxRegistration: "non_vat_exempt" }, testDb())).toEqual({ ok: true });
  });

  it("is for owners and admins only", async () => {
    const owner = await actorFor();
    const member: OrgActor = { ...owner, role: "member" };
    await expect(getBusinessRegistration(member, testDb())).rejects.toBeInstanceOf(ForbiddenError);
    await expect(updateBusinessRegistration(member, complete, testDb())).rejects.toBeInstanceOf(ForbiddenError);
  });
});
