import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UnitOptions } from "./unit-options";

const units = ["hour", "pc", "sq m"];

function picker(current: string) {
  render(
    <label>
      Unit
      <select value={current} onChange={() => {}}>
        <UnitOptions units={units} current={current} />
      </select>
    </label>,
  );
  const select = screen.getByRole("combobox", { name: "Unit" });
  const options = Array.from((select as HTMLSelectElement).options).map((o) => [o.value, o.text]);
  return { select, options };
}

describe("UnitOptions", () => {
  it("offers only the market's units, the current one selected", () => {
    const { select, options } = picker("pc");
    expect(options).toEqual([
      ["hour", "hour"],
      ["pc", "pc"],
      ["sq m", "sq m"],
    ]);
    expect(select).toHaveValue("pc");
  });

  it("asks for a unit when there's none yet", () => {
    const { select, options } = picker("");
    expect(options[0]).toEqual(["", "Choose a unit"]);
    expect(select).toHaveValue("");
  });

  it("still shows a unit saved before the list, marked as not in it", () => {
    const { select, options } = picker("hrs");
    expect(options[0]).toEqual(["hrs", "hrs (not in the list)"]);
    expect(options).toHaveLength(units.length + 1);
    expect(select).toHaveValue("hrs");
  });
});
