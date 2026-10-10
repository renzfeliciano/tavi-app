import { describe, expect, it } from "vitest";
import { readFeatureFlags } from "./features";

describe("readFeatureFlags", () => {
  it("is all on by default", () => {
    expect(readFeatureFlags({})).toEqual({ registrationEnabled: true, mascotEnabled: true, mascotInsightsEnabled: true });
  });

  it.each(["off", "OFF", "false", "0", " no "])("reads %j as off", (value) => {
    expect(readFeatureFlags({ FEATURE_REGISTRATION: value }).registrationEnabled).toBe(false);
  });

  it("turns the companion off with the mascot", () => {
    const flags = readFeatureFlags({ FEATURE_MASCOT: "off" });
    expect(flags.mascotEnabled).toBe(false);
    expect(flags.mascotInsightsEnabled).toBe(false);
  });

  it("can turn off just the insights", () => {
    expect(readFeatureFlags({ FEATURE_MASCOT_INSIGHTS: "off" })).toMatchObject({
      mascotEnabled: true,
      mascotInsightsEnabled: false,
    });
  });
});
