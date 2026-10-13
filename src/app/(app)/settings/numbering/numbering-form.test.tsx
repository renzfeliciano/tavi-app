import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NumberingForm } from "./numbering-form";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("./actions", () => ({ saveNumbering: vi.fn() }));

const form = (kind: string) =>
  render(<NumberingForm kind={kind} title="Quotations" description="How they are numbered." prefix="" padding={6} nextValue={1} editable />);

describe("the numbering form's prefix example", () => {
  it.each([
    ["quote", "e.g. QUO"],
    ["invoice", "e.g. INV"],
    ["receipt", "e.g. REC"],
  ])("shows %s numbers starting like %s", (kind, example) => {
    form(kind);

    expect(screen.getByLabelText("Prefix")).toHaveAttribute("placeholder", example);
  });
});
