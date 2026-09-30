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
import { getBusinessProfile, updateBusinessProfile } from "./business-profile";

const validInput = {
  name: "Acme Aircon Services",
  legalName: "Acme Aircon Services OPC",
  taxId: "123-456-789-00000",
  taxRegistration: "vat",
  email: "Billing@Acme.ph",
  phone: "+63 917 555 0100",
  addressLine1: "12 Mabini St.",
  addressLine2: "",
  city: "Quezon City",
  region: "Metro Manila",
  postalCode: "1100",
  currency: "PHP",
  taxMode: "exclusive",
  quoteValidityDays: "14",
  paymentTermsDays: "7",
  defaultNotes: "Thank you for your business!",
  defaultTerms: "",
  paymentInstructions: "GCash 0917 555 0100 (Maria S.)",
};

async function actorFor(role: Role = "owner"): Promise<OrgActor> {
  const org = await createTestOrganization();
  const user = await createTestUser();
  return { organizationId: org.id, userId: user.id, role };
}

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closeTestDb();
});

describe("getBusinessProfile", () => {
  it("returns the organization's profile with its defaults", async () => {
    const actor = await actorFor("member");

    const profile = await getBusinessProfile(actor, testDb());

    expect(profile).toMatchObject({
      name: "Acme Aircon Services",
      currency: "PHP",
      taxMode: "inclusive",
      quoteValidityDays: 30,
      paymentTermsDays: 15,
      legalName: null,
      paymentInstructions: null,
    });
  });
});

describe("updateBusinessProfile", () => {
  it("saves the normalized profile and audits which fields changed", async () => {
    const actor = await actorFor("admin");

    const result = await updateBusinessProfile(actor, validInput, testDb());

    expect(result).toEqual({ ok: true });
    expect(await getBusinessProfile(actor, testDb())).toMatchObject({
      legalName: "Acme Aircon Services OPC",
      taxRegistration: "vat",
      email: "billing@acme.ph",
      addressLine2: null,
      taxMode: "exclusive",
      quoteValidityDays: 14,
      paymentTermsDays: 7,
      paymentInstructions: "GCash 0917 555 0100 (Maria S.)",
    });
    const events = await listAllAuditEvents(testDb());
    expect(events).toEqual([
      expect.objectContaining({
        action: "organization.updated",
        actorId: actor.userId,
        organizationId: actor.organizationId,
        entityType: "organization",
        entityId: actor.organizationId,
      }),
    ]);
    expect(events[0]?.metadata).toEqual({
      changed: expect.arrayContaining(["legalName", "taxId", "taxMode", "paymentInstructions"]),
    });
    expect(events[0]?.metadata.changed).not.toContain("name");
  });

  it("does nothing and records nothing when nothing changed", async () => {
    const actor = await actorFor();
    await updateBusinessProfile(actor, validInput, testDb());

    const result = await updateBusinessProfile(actor, validInput, testDb());

    expect(result).toEqual({ ok: true });
    expect(await listAllAuditEvents(testDb())).toHaveLength(1);
  });

  it("returns field errors for invalid input", async () => {
    const actor = await actorFor();

    const result = await updateBusinessProfile(
      actor,
      { ...validInput, name: " ", email: "nope", quoteValidityDays: "0" },
      testDb(),
    );

    expect(result).toEqual({
      ok: false,
      fieldErrors: {
        name: ["Enter your business name."],
        email: ["Enter a valid email address."],
        quoteValidityDays: ["Choose between 1 and 365 days."],
      },
    });
  });

  it("refuses members, who can't manage the business", async () => {
    const actor = await actorFor("member");

    await expect(updateBusinessProfile(actor, validInput, testDb())).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(await getBusinessProfile(actor, testDb())).toMatchObject({ legalName: null });
  });

  it("only changes the actor's own organization", async () => {
    const actor = await actorFor();
    const other = await createTestOrganization(testDb(), { name: "Other Business" });

    await updateBusinessProfile(actor, validInput, testDb());

    const otherProfile = await getBusinessProfile(
      { organizationId: other.id, userId: actor.userId, role: "owner" },
      testDb(),
    );
    expect(otherProfile).toMatchObject({ name: "Other Business", legalName: null, taxMode: "inclusive" });
  });
});
