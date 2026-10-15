import { beforeEach, describe, expect, it, vi } from "vitest";

// The daily job's wiring (docs/superpowers/specs/2026-10-15-recurring-invoices-design.md, section 6). Every module call is replaced.

const mocks = vi.hoisted(() => ({
  markOverdueInvoices: vi.fn(),
  runDueSchedules: vi.fn(),
  expireQuotesPastValidity: vi.fn(),
  purgeExpiredTrash: vi.fn(),
  listOrganizationClocks: vi.fn(),
}));

vi.mock("@/modules/invoices", () => ({ markOverdueInvoices: mocks.markOverdueInvoices, runDueSchedules: mocks.runDueSchedules }));
vi.mock("@/modules/quotes", () => ({ expireQuotesPastValidity: mocks.expireQuotesPastValidity }));
vi.mock("@/modules/trash", () => ({ purgeExpiredTrash: mocks.purgeExpiredTrash }));
vi.mock("@/modules/organizations", () => ({ listOrganizationClocks: mocks.listOrganizationClocks }));
vi.mock("@/shared/env", () => ({ env: { CRON_SECRET: "test-secret" } }));
vi.mock("@/shared/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { GET } from "./route";

const request = () => new Request("https://tavi.example/api/cron/daily", { headers: { authorization: "Bearer test-secret" } });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.expireQuotesPastValidity.mockResolvedValue(0);
  mocks.markOverdueInvoices.mockResolvedValue(0);
  mocks.purgeExpiredTrash.mockResolvedValue(0);
  mocks.runDueSchedules.mockResolvedValue({ created: 0, paused: 0 });
});

describe("GET /api/cron/daily", () => {
  it("refuses a request without the secret", async () => {
    const response = await GET(new Request("https://tavi.example/api/cron/daily"));
    expect(response.status).toBe(401);
    expect(mocks.runDueSchedules).not.toHaveBeenCalled();
  });

  it("adds the recurring drafts made and paused to the counts, using each business's own date", async () => {
    mocks.listOrganizationClocks.mockResolvedValue([{ organizationId: "org-1", timezone: "Asia/Manila" }]);
    mocks.runDueSchedules.mockResolvedValue({ created: 2, paused: 1 });
    const body = await (await GET(request())).json();
    expect(body).toMatchObject({ recurringDrafts: 2, recurringPaused: 1, failed: 0 });
    expect(mocks.runDueSchedules).toHaveBeenCalledWith("org-1", expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
  });

  it("carries on with the other businesses when one fails", async () => {
    mocks.listOrganizationClocks.mockResolvedValue([
      { organizationId: "org-1", timezone: "Asia/Manila" },
      { organizationId: "org-2", timezone: "Asia/Manila" },
    ]);
    mocks.runDueSchedules.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce({ created: 3, paused: 0 });
    const body = await (await GET(request())).json();
    expect(body).toMatchObject({ recurringDrafts: 3, failed: 1 });
    expect(mocks.runDueSchedules).toHaveBeenCalledTimes(2);
  });
});
