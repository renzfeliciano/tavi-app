import { describe, expect, it } from "vitest";
import { currencyOptions, OFFERED_CURRENCIES } from "./currencies";

describe("currencyOptions", () => {
  it("names every offered currency in the viewer's language, the business's own first", () => {
    const options = currencyOptions({ locale: "en-PH", first: "PHP" });

    expect(options[0]).toEqual({ code: "PHP", label: "PHP · Philippine Peso" });
    expect(options.map((o) => o.code).sort()).toEqual([...OFFERED_CURRENCIES].sort());
  });

  it("keeps a business's currency even when it isn't on the offered list", () => {
    const options = currencyOptions({ locale: "en", first: "NZD" });

    expect(options[0]?.code).toBe("NZD");
    expect(options.filter((o) => o.code === "NZD")).toHaveLength(1);
  });
});
