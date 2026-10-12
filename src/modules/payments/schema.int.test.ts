import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, resetTables, testDb } from "@/db/testing";
import { isCheckViolation, isUniqueViolation } from "@/db/errors";
import { files } from "@/db/schema";
import { issuedStatement, testBusiness, testCustomer, withheldPayment } from "./application/certificate-fixtures";
import { withholdingCertificateLines, withholdingCertificatePayments, withholdingCertificates } from "./schema";

// The constraints the database itself keeps for withholding certificates
// (spec section 4), so no code path can store an impossible certificate.

beforeEach(async () => {
  await resetTables();
});
afterAll(async () => {
  await closeTestDb();
});

async function setup() {
  const actor = await testBusiness();
  const customerId = await testCustomer(actor);
  const invoiceId = await issuedStatement(actor, customerId);
  const paymentId = await withheldPayment(actor, invoiceId);
  const certificate = (overrides: Partial<typeof withholdingCertificates.$inferInsert> = {}) => ({
    organizationId: actor.organizationId,
    customerId,
    payorTin: "987-654-321-000",
    payorName: "Dela Cruz Trading",
    periodFrom: "2026-07-01",
    periodTo: "2026-09-30",
    receivedOn: "2026-10-01",
    currency: "PHP",
    ...overrides,
  });
  const insertCertificate = async (overrides: Partial<typeof withholdingCertificates.$inferInsert> = {}) => {
    const [row] = await testDb().insert(withholdingCertificates).values(certificate(overrides)).returning({ id: withholdingCertificates.id });
    if (!row) throw new Error("certificate");
    return row.id;
  };
  const line = (certificateId: string, overrides: Partial<typeof withholdingCertificateLines.$inferInsert> = {}) => ({
    organizationId: actor.organizationId,
    certificateId,
    position: 1,
    atcCode: "WI160",
    rateBps: 200,
    month1Minor: 0,
    month2Minor: 300_000,
    month3Minor: 0,
    totalMinor: 300_000,
    taxWithheldMinor: 6000,
    ...overrides,
  });
  return { actor, customerId, paymentId, certificate, insertCertificate, line };
}

const rejection = async (promise: Promise<unknown>) => promise.then(() => null, (error: unknown) => error);

describe("withholding_certificates", () => {
  it("stores a certificate whose period is one calendar quarter, or part of one", async () => {
    const { insertCertificate } = await setup();
    await expect(insertCertificate()).resolves.toBeTruthy();
    await expect(insertCertificate({ periodFrom: "2026-08-01", periodTo: "2026-08-31" })).resolves.toBeTruthy();
  });

  it("refuses a period that runs across two quarters, or backwards", async () => {
    const { insertCertificate } = await setup();
    expect(isCheckViolation(await rejection(insertCertificate({ periodFrom: "2026-09-15", periodTo: "2026-10-15" })), "withholding_certificates_one_quarter")).toBe(true);
    expect(isCheckViolation(await rejection(insertCertificate({ periodFrom: "2026-09-30", periodTo: "2026-07-01" })), "withholding_certificates_period")).toBe(true);
  });

  it("refuses a void without a reason", async () => {
    const { insertCertificate } = await setup();
    expect(isCheckViolation(await rejection(insertCertificate({ voidedAt: new Date() })), "withholding_certificates_void_reason")).toBe(true);
    await expect(insertCertificate({ voidedAt: new Date(), voidReason: "Wrong customer" })).resolves.toBeTruthy();
  });
});

describe("withholding_certificate_lines", () => {
  it("stores a row whose months add up to its total", async () => {
    const { insertCertificate, line } = await setup();
    const id = await insertCertificate();
    await testDb().insert(withholdingCertificateLines).values(line(id));
    expect(await testDb().select().from(withholdingCertificateLines).where(eq(withholdingCertificateLines.certificateId, id))).toHaveLength(1);
  });

  it("refuses a total that is not the three months added", async () => {
    const { insertCertificate, line } = await setup();
    const id = await insertCertificate();
    const error = await rejection(testDb().insert(withholdingCertificateLines).values(line(id, { totalMinor: 299_999 })));
    expect(isCheckViolation(error, "withholding_lines_total")).toBe(true);
  });

  it("refuses tax withheld above the income payments, or none at all", async () => {
    const { insertCertificate, line } = await setup();
    const id = await insertCertificate();
    expect(isCheckViolation(await rejection(testDb().insert(withholdingCertificateLines).values(line(id, { taxWithheldMinor: 300_001 }))), "withholding_lines_tax")).toBe(true);
    expect(isCheckViolation(await rejection(testDb().insert(withholdingCertificateLines).values(line(id, { taxWithheldMinor: 0 }))), "withholding_lines_tax")).toBe(true);
  });

  it("refuses a rate outside 0.01% to 100%, a bad ATC and a sixth row", async () => {
    const { insertCertificate, line } = await setup();
    const id = await insertCertificate();
    expect(isCheckViolation(await rejection(testDb().insert(withholdingCertificateLines).values(line(id, { rateBps: 0 }))), "withholding_lines_rate")).toBe(true);
    expect(isCheckViolation(await rejection(testDb().insert(withholdingCertificateLines).values(line(id, { rateBps: 10_001 }))), "withholding_lines_rate")).toBe(true);
    expect(isCheckViolation(await rejection(testDb().insert(withholdingCertificateLines).values(line(id, { atcCode: "wi 160" }))), "withholding_lines_atc")).toBe(true);
    expect(isCheckViolation(await rejection(testDb().insert(withholdingCertificateLines).values(line(id, { position: 6 }))), "withholding_lines_position")).toBe(true);
  });

  it("keeps one row per position", async () => {
    const { insertCertificate, line } = await setup();
    const id = await insertCertificate();
    await testDb().insert(withholdingCertificateLines).values(line(id));
    const error = await rejection(testDb().insert(withholdingCertificateLines).values(line(id)));
    expect(isUniqueViolation(error, "withholding_lines_position_unique")).toBe(true);
  });
});

describe("withholding_certificate_payments", () => {
  it("lets a payment sit under only one certificate", async () => {
    const { actor, paymentId, insertCertificate } = await setup();
    const first = await insertCertificate();
    const second = await insertCertificate({ receivedOn: "2026-10-01" });
    const link = (certificateId: string) => ({ organizationId: actor.organizationId, certificateId, paymentId });
    await testDb().insert(withholdingCertificatePayments).values(link(first));
    const error = await rejection(testDb().insert(withholdingCertificatePayments).values(link(second)));
    expect(isUniqueViolation(error, "withholding_certificate_payments_payment_unique")).toBe(true);
  });

  it("goes with its certificate when the certificate is deleted", async () => {
    const { actor, paymentId, insertCertificate } = await setup();
    const id = await insertCertificate();
    await testDb().insert(withholdingCertificatePayments).values({ organizationId: actor.organizationId, certificateId: id, paymentId });
    await testDb().delete(withholdingCertificates).where(eq(withholdingCertificates.id, id));
    expect(await testDb().select().from(withholdingCertificatePayments)).toHaveLength(0);
  });
});

describe("files with the withholding_certificate purpose", () => {
  const file = (organizationId: string, overrides: Partial<typeof files.$inferInsert> = {}) => ({
    organizationId,
    purpose: "withholding_certificate" as const,
    contentType: "application/pdf",
    byteSize: 4,
    sha256: "a".repeat(64),
    data: Buffer.from("%PDF"),
    ...overrides,
  });

  it("needs a file name and no document kind", async () => {
    const { actor } = await setup();
    expect(isCheckViolation(await rejection(testDb().insert(files).values(file(actor.organizationId))), "files_purpose_shape")).toBe(true);
    expect(isCheckViolation(await rejection(testDb().insert(files).values(file(actor.organizationId, { fileName: "2307.pdf", docKind: "cor" }))), "files_purpose_shape")).toBe(true);
    await expect(testDb().insert(files).values(file(actor.organizationId, { fileName: "2307.pdf" }))).resolves.toBeTruthy();
  });
});
