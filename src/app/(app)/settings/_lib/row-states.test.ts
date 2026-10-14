import { describe, expect, it } from "vitest";
import { businessProfileState, devicesState, invoiceModeState, registrationState, taxRatesState, teamState } from "./row-states";

describe("businessProfileState", () => {
  const complete = { name: "Santos Aircon", taxId: "123-456-789-000", addressLine1: "12 Rizal St", city: "Quezon City" };

  it("is complete once the tax ID and address are in", () => {
    expect(businessProfileState(complete, "TIN")).toEqual({ text: "Complete", tone: "done" });
  });

  it("asks for the tax ID first, by the market's own name for it", () => {
    expect(businessProfileState({ ...complete, taxId: null }, "TIN")).toEqual({ text: "Add your TIN", tone: "todo" });
    expect(businessProfileState({ ...complete, taxId: "  ", addressLine1: null }, "GSTIN")).toEqual({ text: "Add your GSTIN", tone: "todo" });
  });

  it("then asks for the address", () => {
    expect(businessProfileState({ ...complete, addressLine1: "" }, "TIN")).toEqual({ text: "Add your address", tone: "todo" });
    expect(businessProfileState({ ...complete, city: null }, "TIN")).toEqual({ text: "Add your address", tone: "todo" });
  });
});

describe("registrationState", () => {
  it("is set up once the taxpayer type is chosen", () => {
    expect(registrationState({ taxpayerType: "individual" })).toEqual({ text: "Set up", tone: "done" });
    expect(registrationState({ taxpayerType: null })).toEqual({ text: "Not set up", tone: "todo" });
    expect(registrationState({ taxpayerType: "" })).toEqual({ text: "Not set up", tone: "todo" });
  });
});

describe("taxRatesState", () => {
  it("counts the rates in use and leaves archived ones out", () => {
    const now = new Date();
    expect(taxRatesState([{ archivedAt: null }, { archivedAt: null }, { archivedAt: now }])).toEqual({ text: "2 rates", tone: "info" });
    expect(taxRatesState([{ archivedAt: null }])).toEqual({ text: "1 rate", tone: "info" });
  });

  it("asks for a first rate when there are none", () => {
    expect(taxRatesState([])).toEqual({ text: "No rates yet", tone: "todo" });
    expect(taxRatesState([{ archivedAt: new Date() }])).toEqual({ text: "No rates yet", tone: "todo" });
  });
});

describe("invoiceModeState", () => {
  it("says whether invoice mode is on", () => {
    expect(invoiceModeState({ active: true })).toEqual({ text: "On", tone: "done" });
    expect(invoiceModeState({ active: false })).toEqual({ text: "Off", tone: "info" });
    expect(invoiceModeState(null)).toEqual({ text: "Off", tone: "info" });
  });
});

describe("teamState", () => {
  it("counts the people, and the invitations still waiting", () => {
    expect(teamState(1, 0)).toEqual({ text: "Just you", tone: "info" });
    expect(teamState(3, 0)).toEqual({ text: "3 people", tone: "info" });
    expect(teamState(3, 2)).toEqual({ text: "3 people · 2 invited", tone: "info" });
    expect(teamState(1, 1)).toEqual({ text: "Just you · 1 invited", tone: "info" });
  });
});

describe("devicesState", () => {
  it("counts the devices signed in", () => {
    expect(devicesState(1)).toEqual({ text: "1 device", tone: "info" });
    expect(devicesState(4)).toEqual({ text: "4 devices", tone: "info" });
  });
});
