import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AsyncCombobox } from "./async-combobox";

type Item = { id: string; name: string };

const ITEMS: Item[] = [
  { id: "1", name: "Aircon cleaning" },
  { id: "2", name: "Roof survey" },
  { id: "3", name: "Site inspection" },
];

/** Answers a little later, the way a server does, with the items whose name contains the query. */
function searchOf(items: Item[] = ITEMS) {
  return vi.fn(async (query: string) => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    return items.filter((item) => item.name.toLowerCase().includes(query.toLowerCase()));
  });
}

function renderPicker(search: (query: string) => Promise<Item[]>, onValueChange = vi.fn()) {
  render(
    <AsyncCombobox<Item>
      label="Add item"
      placeholder="Search items"
      value={null}
      onValueChange={onValueChange}
      search={search}
      itemKey={(item) => item.id}
      itemLabel={(item) => item.name}
      resetAfterSelect
    />,
  );
  return { input: screen.getByRole("combobox", { name: "Add item" }) as HTMLInputElement, onValueChange };
}

/** Typing or pasting, as a browser reports it (an event without `inputType` is read as autofill and doesn't open the list). */
const type = async (input: HTMLInputElement, text: string) => {
  await act(async () => {
    fireEvent.input(input, { target: { value: text }, inputType: "insertText" });
  });
};

const names = () => screen.queryAllByRole("option").map((option) => option.textContent);

describe("AsyncCombobox", () => {
  it("lists everything when opened empty", async () => {
    const search = searchOf();
    renderPicker(search);

    fireEvent.click(screen.getByRole("button", { name: "Show add item options" }));

    await waitFor(() => expect(names()).toEqual(["Aircon cleaning", "Roof survey", "Site inspection"]));
    expect(search).toHaveBeenCalledWith("");
  });

  it("shows only the matches for what was typed, not the unfiltered list that opening it would fetch", async () => {
    const search = searchOf();
    const { input } = renderPicker(search);

    // A name pasted or typed in one go opens the list and changes the text together.
    await type(input, "survey");

    await waitFor(() => expect(names()).toEqual(["Roof survey"]));
    expect(search).toHaveBeenLastCalledWith("survey");
    // Settled: nothing later replaces the matches with the full list.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(names()).toEqual(["Roof survey"]);
  });

  it("starts again from the full list after something is picked and the picker is reopened", async () => {
    const search = searchOf();
    const { input, onValueChange } = renderPicker(search);
    await type(input, "survey");
    await waitFor(() => expect(names()).toEqual(["Roof survey"]));

    fireEvent.click(screen.getByRole("option", { name: "Roof survey" }));
    expect(onValueChange).toHaveBeenCalledWith(ITEMS[1]);
    await waitFor(() => expect(input.value).toBe(""));
    fireEvent.click(screen.getByRole("button", { name: "Show add item options" }));

    await waitFor(() => expect(names()).toEqual(["Aircon cleaning", "Roof survey", "Site inspection"]));
  });
});
