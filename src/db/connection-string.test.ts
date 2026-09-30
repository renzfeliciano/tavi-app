import { describe, expect, it } from "vitest";
import { withExplicitSslMode } from "./connection-string";

const base = "postgresql://user:pw@ep-x.neon.tech/tavi";

describe("withExplicitSslMode", () => {
  it("spells out the verify-full mode that pg already applies to prefer/require/verify-ca", () => {
    for (const mode of ["prefer", "require", "verify-ca"]) {
      expect(withExplicitSslMode(`${base}?sslmode=${mode}&channel_binding=require`)).toBe(
        `${base}?sslmode=verify-full&channel_binding=require`,
      );
    }
  });

  it("leaves other modes and strings without one alone", () => {
    expect(withExplicitSslMode(`${base}?sslmode=disable`)).toBe(`${base}?sslmode=disable`);
    expect(withExplicitSslMode(`${base}?sslmode=require&uselibpqcompat=true`)).toBe(
      `${base}?sslmode=require&uselibpqcompat=true`,
    );
    expect(withExplicitSslMode(base)).toBe(base);
  });
});
