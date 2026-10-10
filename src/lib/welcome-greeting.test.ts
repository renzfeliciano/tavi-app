import { describe, expect, it } from "vitest";
import { GREETING_WINDOW_MS, firstName, markWelcome, takeWelcome, welcomeMessage, type GreetingStorage } from "./welcome-greeting";

function fakeStorage(): GreetingStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe("the welcome greeting after sign-in", () => {
  it("plays once for a sign-in, then never again", () => {
    const storage = fakeStorage();
    markWelcome(storage, 1_000);
    expect(takeWelcome(storage, 1_500)).toBe(true);
    expect(takeWelcome(storage, 1_600)).toBe(false);
  });

  it("does not play when nobody just signed in", () => {
    expect(takeWelcome(fakeStorage(), 1_000)).toBe(false);
  });

  it("lets an old mark lapse, so a stale tab never greets later", () => {
    const storage = fakeStorage();
    markWelcome(storage, 1_000);
    expect(takeWelcome(storage, 1_000 + GREETING_WINDOW_MS + 1)).toBe(false);
    expect(storage.data.size).toBe(0);
  });

  it("ignores a mark it cannot read", () => {
    const storage = fakeStorage();
    storage.setItem("tavi:welcome", "garbage");
    expect(takeWelcome(storage, 1_000)).toBe(false);
  });

  it("copes with storage that throws (private windows)", () => {
    const broken: GreetingStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(() => markWelcome(broken, 1)).not.toThrow();
    expect(takeWelcome(broken, 1)).toBe(false);
  });

  it("greets by first name, or plainly without one", () => {
    expect(firstName("Travis Renz")).toBe("Travis");
    expect(welcomeMessage("Travis Renz")).toBe("Welcome back, Travis.");
    expect(welcomeMessage("  ")).toBe("Welcome back.");
  });
});
